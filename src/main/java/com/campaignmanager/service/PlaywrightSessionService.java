package com.campaignmanager.service;

import com.microsoft.playwright.*;
import com.microsoft.playwright.options.LoadState;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Manages a persistent Gmail browser session using Playwright's storageState.
 *
 * The user logs in once via a visible browser window (Settings page → Connect Gmail).
 * Playwright saves the session cookies/localStorage to disk. Subsequent email sends
 * reuse the saved session — no credentials are ever stored in the campaign.
 *
 * The connect flow is ASYNCHRONOUS: the browser opens in a background thread,
 * and the frontend polls GET /api/settings/gmail/status to detect completion.
 */
@Service
@Slf4j
public class PlaywrightSessionService {

    private static final String SESSION_DIR = "./data";
    private static final String SESSION_FILE = "gmail-session.json";

    @Value("${playwright.headless:false}")
    private boolean headless;

    private Playwright playwright;
    private Browser browser;
    private BrowserContext sessionContext;

    // Async connect state
    private final AtomicBoolean connecting = new AtomicBoolean(false);
    private final AtomicReference<String> connectError = new AtomicReference<>(null);

    /** Pre-warms Playwright at startup so browser binaries are ready before any HTTP request. */
    @PostConstruct
    public synchronized void initialize() {
        log.info("Playwright: initializing and verifying browser binaries...");
        try {
            if (playwright == null) {
                playwright = Playwright.create();
            }
            log.info("Playwright: browser binaries ready.");
        } catch (Exception e) {
            log.warn("Playwright: initialization warning: {}", e.getMessage());
        }
    }

    // ─── Async Connect ────────────────────────────────────────────────────────

    /** @return true while a connect-browser session is in progress */
    public boolean isConnecting() { return connecting.get(); }

    /** @return error message from the most recent failed connect attempt, or null */
    public String getConnectError() { return connectError.get(); }

    /**
     * Starts the Gmail session setup asynchronously.
     * Opens a visible browser window in a background thread; the frontend polls
     * {@code GET /api/settings/gmail/status} to detect when login completes.
     * Safe to call multiple times — ignored if a connect is already in progress.
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

    /** Actual blocking connect logic, runs in the background thread. */
    private void doConnectSession() throws Exception {
        log.info("Starting Gmail session setup — opening browser for user login");
        Files.createDirectories(Paths.get(SESSION_DIR));

        synchronized (this) {
            if (playwright == null) playwright = Playwright.create();
        }

        Browser connectBrowser = playwright.chromium().launch(
                new BrowserType.LaunchOptions().setHeadless(false)
        );

        BrowserContext context = connectBrowser.newContext(
                new Browser.NewContextOptions().setViewportSize(1280, 900)
        );

        Page page = context.newPage();
        page.setDefaultTimeout(120_000);

        try {
            page.navigate("https://mail.google.com/mail/u/0/");
            log.info("Browser open — waiting for Gmail login (up to 2 minutes)...");

            try {
                page.waitForURL(
                        url -> url.contains("mail.google.com") && !url.contains("accounts.google.com"),
                        new Page.WaitForURLOptions().setTimeout(120_000)
                );
            } catch (Exception e) {
                String msg = e.getMessage() != null && e.getMessage().contains("closed")
                        ? "Browser window was closed before login completed. Click 'Connect Gmail' and complete login without closing the browser."
                        : "Login timed out (2 minutes). Click 'Connect Gmail' again and log in promptly.";
                throw new Exception(msg);
            }

            // Wait for the basic page load; Gmail keeps making background requests
            // so NETWORKIDLE never fires — LOAD is sufficient to confirm the inbox is ready.
            try {
                page.waitForLoadState(LoadState.LOAD,
                        new Page.WaitForLoadStateOptions().setTimeout(15_000));
            } catch (Exception ignored) {
                // If even LOAD times out, the URL check already confirmed login — proceed.
            }

            log.info("Gmail login detected — saving session state");
            Path sessionPath = getSessionPath();
            context.storageState(new BrowserContext.StorageStateOptions().setPath(sessionPath));
            log.info("Session saved to: {}", sessionPath.toAbsolutePath());

        } finally {
            try { page.close(); }         catch (Exception ignored) {}
            try { context.close(); }      catch (Exception ignored) {}
            try { connectBrowser.close(); } catch (Exception ignored) {}
            invalidateCachedContext();
        }
    }

    // ─── Session Status ───────────────────────────────────────────────────────

    /** Returns true if a saved session file exists on disk. */
    public boolean isSessionActive() {
        return Files.exists(getSessionPath());
    }

    /** Returns the modification time of the saved session, or null. */
    public LocalDateTime getSessionCreatedAt() {
        Path p = getSessionPath();
        if (!Files.exists(p)) return null;
        try {
            Instant modified = Files.getLastModifiedTime(p).toInstant();
            return LocalDateTime.ofInstant(modified, ZoneId.systemDefault());
        } catch (IOException e) {
            return null;
        }
    }

    /** Deletes the saved session file and closes any cached context. */
    public synchronized void disconnectSession() throws IOException {
        invalidateCachedContext();
        Path p = getSessionPath();
        if (Files.exists(p)) {
            Files.delete(p);
            log.info("Gmail session deleted");
        }
    }

    // ─── Send-time Context ────────────────────────────────────────────────────

    /**
     * Returns a BrowserContext loaded with the saved session for sending emails.
     * The context is cached and reused across sends.
     *
     * @throws IllegalStateException if no session has been established
     */
    public synchronized BrowserContext getSessionContext() {
        if (!isSessionActive()) {
            throw new IllegalStateException(
                    "No Gmail session found. Go to Settings → Connect Gmail first.");
        }

        if (playwright == null) playwright = Playwright.create();

        if (browser == null || !browser.isConnected()) {
            browser = playwright.chromium().launch(
                    new BrowserType.LaunchOptions().setHeadless(headless)
            );
            invalidateCachedContext();
        }
        if (sessionContext == null) {
            sessionContext = browser.newContext(
                    new Browser.NewContextOptions()
                            .setStorageStatePath(getSessionPath())
                            .setViewportSize(1280, 900)
            );
            log.info("Loaded Gmail session context from {}", getSessionPath().toAbsolutePath());
        }
        return sessionContext;
    }

    /** Closes the cached BrowserContext so it will be recreated on the next send. */
    public synchronized void invalidateCachedContext() {
        if (sessionContext != null) {
            try { sessionContext.close(); } catch (Exception ignored) {}
            sessionContext = null;
        }
    }

    public Path getSessionPath() {
        return Paths.get(SESSION_DIR, SESSION_FILE);
    }

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
