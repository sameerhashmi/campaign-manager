package com.campaignmanager.service;

import com.microsoft.playwright.*;
import com.microsoft.playwright.options.LoadState;
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

/**
 * Manages a persistent Gmail browser session using Playwright's storageState.
 *
 * The user logs in once via a visible browser window (Settings page → Connect Gmail).
 * Playwright saves the session cookies/localStorage to disk. Subsequent email sends
 * reuse the saved session — no credentials are ever stored in the campaign.
 */
@Service
@Slf4j
public class PlaywrightSessionService {

    private static final String SESSION_DIR = "./data";
    private static final String SESSION_FILE = "gmail-session.json";

    @Value("${playwright.headless:false}")
    private boolean headless;

    @Value("${playwright.gmail.timeout:30000}")
    private int timeout;

    private Playwright playwright;
    private Browser browser;
    private BrowserContext sessionContext;

    /**
     * Opens a visible (non-headless) browser for the user to log into Gmail.
     * Waits up to 90 seconds for a successful login, then saves the session.
     * Throws an exception if login is not detected within the timeout.
     */
    public synchronized void connectSession() throws Exception {
        log.info("Starting Gmail session setup — opening browser for user login");

        // Ensure data directory exists
        Files.createDirectories(Paths.get(SESSION_DIR));

        if (playwright == null) {
            playwright = Playwright.create();
        }

        // Always launch non-headless so the user can interact
        Browser connectBrowser = playwright.chromium().launch(
                new BrowserType.LaunchOptions().setHeadless(false)
        );

        BrowserContext context = connectBrowser.newContext(
                new Browser.NewContextOptions().setViewportSize(1280, 900)
        );

        Page page = context.newPage();
        page.setDefaultTimeout(90_000);

        try {
            page.navigate("https://mail.google.com/mail/u/0/");
            log.info("Navigated to Gmail — waiting for user to log in (up to 90 seconds)...");

            // Wait until we land on the Gmail inbox (not the accounts.google.com login page)
            page.waitForURL(url -> url.contains("mail.google.com") && !url.contains("accounts.google.com"),
                    new Page.WaitForURLOptions().setTimeout(90_000));
            page.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(30_000));

            log.info("Gmail login detected — saving session state");
            Path sessionPath = getSessionPath();
            context.storageState(new BrowserContext.StorageStateOptions().setPath(sessionPath));
            log.info("Session saved to: {}", sessionPath.toAbsolutePath());

        } finally {
            try { page.close(); } catch (Exception ignored) {}
            try { context.close(); } catch (Exception ignored) {}
            try { connectBrowser.close(); } catch (Exception ignored) {}

            // Invalidate cached session context so next send reloads the new state
            invalidateCachedContext();
        }
    }

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

    /**
     * Returns a BrowserContext loaded with the saved session state.
     * The context is cached and reused across multiple send operations.
     * If the session file has been updated, the context is refreshed.
     *
     * @throws IllegalStateException if no session has been established
     */
    public synchronized BrowserContext getSessionContext() {
        if (!isSessionActive()) {
            throw new IllegalStateException(
                    "No Gmail session found. Go to Settings → Connect Gmail to establish a session first.");
        }

        if (playwright == null) {
            playwright = Playwright.create();
        }
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

    /** Closes and nullifies the cached BrowserContext so it will be recreated next call. */
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
