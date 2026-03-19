package com.campaignmanager.service;

import com.microsoft.playwright.*;
import com.microsoft.playwright.options.LoadState;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

/**
 * Manages persistent Gmail browser sessions using Playwright's storageState.
 *
 * Supports multiple sessions — one per Gmail account — stored under
 * {@code ./data/sessions/{email}.json}.  Campaigns reference a session by the
 * {@code gmailEmail} column; the scheduler looks up the matching context before
 * sending.  If a campaign has no Gmail email assigned it falls back to the first
 * available session (backward-compatible with single-session deployments).
 *
 * On startup the service automatically migrates the legacy single-session file
 * {@code ./data/gmail-session.json} to the new per-email layout.
 */
@Service
@DependsOn("playwrightSystemDepsInstaller")
@RequiredArgsConstructor
@Slf4j
public class PlaywrightSessionService {

    private static final String SESSIONS_DIR   = "./data/sessions";
    private static final String LEGACY_SESSION = "./data/gmail-session.json";
    private final PlaywrightSystemDepsInstaller systemDepsInstaller;

    @Value("${playwright.headless:false}")
    private boolean headless;

    private Playwright playwright;
    private Browser browser;

    /** BrowserContext pool — one per Gmail account email. */
    private final Map<String, BrowserContext> sessionContexts = new ConcurrentHashMap<>();

    /** Email address of the most recently connected/uploaded account. */
    private volatile String lastConnectedEmail = null;

    // Async connect state
    private final AtomicBoolean connecting = new AtomicBoolean(false);
    private final AtomicReference<String> connectError = new AtomicReference<>(null);

    // ─── Playwright Factory ───────────────────────────────────────────────────

    private Playwright createPlaywright() {
        String libPath = systemDepsInstaller.getLibraryPath();
        if (libPath != null) {
            Map<String, String> env = new HashMap<>(System.getenv());
            env.put("LD_LIBRARY_PATH", libPath);
            log.info("Playwright: creating with CF LD_LIBRARY_PATH={}", libPath);
            return Playwright.create(new Playwright.CreateOptions().setEnv(env));
        }
        return Playwright.create();
    }

    private BrowserType.LaunchOptions launchOptions(boolean headless) {
        BrowserType.LaunchOptions opts = new BrowserType.LaunchOptions().setHeadless(headless);
        if (systemDepsInstaller.isCloudFoundry()) {
            opts.setArgs(List.of("--no-sandbox", "--disable-setuid-sandbox"));
        }
        return opts;
    }

    // ─── Init / Migration ─────────────────────────────────────────────────────

    @PostConstruct
    public synchronized void initialize() {
        log.info("Playwright: initializing and verifying browser binaries...");
        try {
            if (playwright == null) playwright = createPlaywright();
            log.info("Playwright: browser binaries ready.");
        } catch (Exception e) {
            log.warn("Playwright: initialization warning: {}", e.getMessage());
        }

        // Migrate legacy single-session file to per-email layout
        Path legacy = Paths.get(LEGACY_SESSION);
        if (Files.exists(legacy)) {
            log.info("Migrating legacy gmail-session.json to per-email layout...");
            try {
                Files.createDirectories(Paths.get(SESSIONS_DIR));
                String email = detectEmailSync(legacy);
                if (email != null) {
                    Path dest = getSessionPath(email);
                    Files.move(legacy, dest, StandardCopyOption.REPLACE_EXISTING);
                    lastConnectedEmail = email;
                    log.info("Migrated legacy session → sessions/{}.json", email);
                } else {
                    log.warn("Could not detect Gmail email from legacy session; leaving file in place.");
                }
            } catch (Exception e) {
                log.warn("Legacy session migration failed: {}", e.getMessage());
            }
        }
    }

    // ─── Session Paths & Discovery ────────────────────────────────────────────

    /** Path for a specific Gmail account's session file. */
    public Path getSessionPath(String email) {
        return Paths.get(SESSIONS_DIR, email + ".json");
    }

    /** Returns true if a session file exists for the given email. */
    public boolean isSessionActive(String email) {
        return Files.exists(getSessionPath(email));
    }

    /** Returns true if ANY session file exists. */
    public boolean hasAnySession() {
        return !listConnectedEmails().isEmpty();
    }

    /** Scans the sessions directory and returns all connected email addresses. */
    public List<String> listConnectedEmails() {
        Path dir = Paths.get(SESSIONS_DIR);
        if (!Files.exists(dir)) return List.of();
        try (var stream = Files.list(dir)) {
            return stream
                    .filter(p -> p.toString().endsWith(".json")
                              && !p.getFileName().toString().startsWith("upload-")
                              && !p.getFileName().toString().startsWith("connecting-"))
                    .map(p -> p.getFileName().toString().replace(".json", ""))
                    .sorted()
                    .collect(Collectors.toList());
        } catch (IOException e) {
            log.warn("listConnectedEmails failed: {}", e.getMessage());
            return List.of();
        }
    }

    /** Returns the file modification time for the given account's session. */
    public LocalDateTime getSessionCreatedAt(String email) {
        Path p = getSessionPath(email);
        if (!Files.exists(p)) return null;
        try {
            Instant modified = Files.getLastModifiedTime(p).toInstant();
            return LocalDateTime.ofInstant(modified, ZoneId.systemDefault());
        } catch (IOException e) {
            return null;
        }
    }

    // ─── Async Connect ────────────────────────────────────────────────────────

    public boolean isConnecting() { return connecting.get(); }
    public String getConnectError() { return connectError.get(); }

    /**
     * Starts an async Gmail login (visible browser window).
     * The frontend polls GET /status to detect completion.
     */
    public void startConnectSession() {
        if (connecting.compareAndSet(false, true)) {
            connectError.set(null);
            Thread thread = new Thread(() -> {
                try {
                    doConnectSession();
                } catch (Exception e) {
                    log.error("Gmail session setup failed: {}", e.getMessage());
                    connectError.set(e.getMessage());
                } finally {
                    connecting.set(false);
                }
            }, "playwright-connect");
            thread.setDaemon(true);
            thread.start();
        }
    }

    private void doConnectSession() throws Exception {
        log.info("Starting Gmail session setup — opening browser for user login");
        Files.createDirectories(Paths.get(SESSIONS_DIR));

        synchronized (this) {
            if (playwright == null) playwright = createPlaywright();
        }

        Browser connectBrowser = playwright.chromium().launch(launchOptions(false));
        BrowserContext context = connectBrowser.newContext(
                new Browser.NewContextOptions().setViewportSize(1280, 900));
        Page page = context.newPage();
        page.setDefaultTimeout(120_000);

        try {
            page.navigate("https://mail.google.com/mail/u/0/");
            log.info("Browser open — waiting for Gmail login (up to 2 minutes)...");

            try {
                page.waitForURL(
                        url -> url.contains("mail.google.com") && !url.contains("accounts.google.com"),
                        new Page.WaitForURLOptions().setTimeout(120_000));
            } catch (Exception e) {
                String msg = e.getMessage() != null && e.getMessage().contains("closed")
                        ? "Browser window was closed before login completed."
                        : "Login timed out (2 minutes). Click 'Connect Gmail' again.";
                throw new Exception(msg);
            }

            try {
                page.waitForLoadState(LoadState.LOAD,
                        new Page.WaitForLoadStateOptions().setTimeout(15_000));
            } catch (Exception ignored) {}

            log.info("Gmail login detected — saving session state");

            // Save to temp file, then rename to {email}.json
            Path tempPath = Paths.get(SESSIONS_DIR, "connecting-temp.json");
            context.storageState(new BrowserContext.StorageStateOptions().setPath(tempPath));

            String detectedEmail = extractEmailFromTitle(page.title());
            if (detectedEmail != null) {
                Path finalPath = getSessionPath(detectedEmail);
                Files.move(tempPath, finalPath, StandardCopyOption.REPLACE_EXISTING);
                lastConnectedEmail = detectedEmail;
                log.info("Session saved → sessions/{}.json", detectedEmail);
            } else {
                // Fallback if title parsing fails
                Path fallback = Paths.get(SESSIONS_DIR, "unknown.json");
                Files.move(tempPath, fallback, StandardCopyOption.REPLACE_EXISTING);
                lastConnectedEmail = "unknown";
                log.warn("Could not detect email from page title; saved as unknown.json");
            }

        } finally {
            try { page.close(); }         catch (Exception ignored) {}
            try { context.close(); }      catch (Exception ignored) {}
            try { connectBrowser.close(); } catch (Exception ignored) {}
            // Don't invalidate ALL contexts — only this temp connect browser is closing
        }
    }

    // ─── BrowserContext Pool ──────────────────────────────────────────────────

    /**
     * Returns (or creates) a cached BrowserContext for the given Gmail account.
     * Throws if no session file exists for that email.
     */
    public synchronized BrowserContext getSessionContext(String email) {
        if (!isSessionActive(email)) {
            throw new IllegalStateException(
                    "No Gmail session for " + email +
                    ". Upload a session file in Settings → Gmail Sessions.");
        }
        if (playwright == null) playwright = createPlaywright();
        if (browser == null || !browser.isConnected()) {
            browser = playwright.chromium().launch(launchOptions(headless));
            sessionContexts.clear();
        }
        return sessionContexts.computeIfAbsent(email, e ->
                browser.newContext(new Browser.NewContextOptions()
                        .setStorageStatePath(getSessionPath(e))
                        .setViewportSize(1280, 900)));
    }

    /**
     * Backward-compatible no-arg version — returns context for the first
     * available session. Used by campaigns with no gmailEmail assigned.
     */
    public synchronized BrowserContext getSessionContext() {
        List<String> emails = listConnectedEmails();
        if (emails.isEmpty()) {
            throw new IllegalStateException(
                    "No Gmail session found. Go to Settings → Connect Gmail first.");
        }
        return getSessionContext(emails.get(0));
    }

    /** Invalidates the cached context for one email (on send failure / expiry). */
    public synchronized void invalidateCachedContext(String email) {
        BrowserContext ctx = sessionContexts.remove(email);
        if (ctx != null) {
            try { ctx.close(); } catch (Exception ignored) {}
            log.info("Invalidated cached context for {}", email);
        }
    }

    /** Invalidates ALL cached contexts (e.g. on browser restart). */
    public synchronized void invalidateCachedContext() {
        sessionContexts.forEach((email, ctx) -> {
            try { ctx.close(); } catch (Exception ignored) {}
        });
        sessionContexts.clear();
    }

    // ─── Disconnect ───────────────────────────────────────────────────────────

    /** Removes the session file and context for a specific Gmail account. */
    public synchronized void disconnectSession(String email) throws IOException {
        invalidateCachedContext(email);
        Path p = getSessionPath(email);
        if (Files.exists(p)) {
            Files.delete(p);
            log.info("Gmail session deleted for {}", email);
        }
        if (email.equals(lastConnectedEmail)) lastConnectedEmail = null;
    }

    // ─── Email Detection ──────────────────────────────────────────────────────

    /**
     * Opens a temporary browser context from the given session file,
     * navigates to Gmail, and extracts the account email from the page title.
     * Returns null if detection fails or times out.
     * Used synchronously during upload/import to name the session file correctly.
     */
    public String detectEmailSync(Path sessionPath) {
        try {
            synchronized (this) {
                if (playwright == null) playwright = createPlaywright();
                if (browser == null || !browser.isConnected()) {
                    browser = playwright.chromium().launch(launchOptions(headless));
                }
            }
            BrowserContext tempCtx = browser.newContext(
                    new Browser.NewContextOptions()
                            .setStorageStatePath(sessionPath)
                            .setViewportSize(1280, 900));
            Page page = tempCtx.newPage();
            try {
                page.navigate("https://mail.google.com/mail/u/0/");
                page.waitForSelector("[gh='cm'], .T-I.T-I-KE",
                        new Page.WaitForSelectorOptions().setTimeout(20_000));
                String email = extractEmailFromTitle(page.title());
                if (email != null) log.info("detectEmailSync: detected {}", email);
                else log.warn("detectEmailSync: could not parse email from title '{}'", page.title());
                return email;
            } finally {
                try { page.close(); }    catch (Exception ignored) {}
                try { tempCtx.close(); } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            log.warn("detectEmailSync failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Parses the Gmail account email from the Gmail inbox page title.
     * Typical formats:
     *   "Inbox - user@example.com - Gmail"
     *   "Inbox (5) - user@example.com - Gmail"
     */
    private String extractEmailFromTitle(String title) {
        if (title == null) return null;
        for (String part : title.split(" - ")) {
            part = part.trim();
            if (part.contains("@") && part.contains(".")) {
                return part;
            }
        }
        return null;
    }

    // ─── Backward-Compat Accessors ────────────────────────────────────────────

    /**
     * Returns the most recently connected email, or the first available.
     * Used by SettingsController.buildStatus() for backward compat.
     */
    public String getConnectedEmail() {
        if (lastConnectedEmail != null && isSessionActive(lastConnectedEmail)) {
            return lastConnectedEmail;
        }
        List<String> emails = listConnectedEmails();
        return emails.isEmpty() ? null : emails.get(0);
    }

    /** @deprecated Use getSessionCreatedAt(String email) */
    public LocalDateTime getSessionCreatedAt() {
        String email = getConnectedEmail();
        return email != null ? getSessionCreatedAt(email) : null;
    }

    // ─── Cleanup ──────────────────────────────────────────────────────────────

    @PreDestroy
    public void cleanup() {
        invalidateCachedContext();
        if (browser != null) {
            try { browser.close(); } catch (Exception ignored) {}
            browser = null;
        }
        if (playwright != null) {
            try { playwright.close(); } catch (Exception ignored) {}
            playwright = null;
        }
    }
}
