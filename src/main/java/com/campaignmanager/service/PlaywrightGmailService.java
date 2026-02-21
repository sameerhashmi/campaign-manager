package com.campaignmanager.service;

import com.campaignmanager.model.EmailJob;
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.LoadState;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Sends emails by automating Gmail web UI using Playwright.
 *
 * Uses one Browser instance per Gmail account (keyed by email address)
 * to avoid repeated logins. If a session expires, it re-authenticates.
 */
@Service
@Slf4j
public class PlaywrightGmailService {

    @Value("${playwright.headless}")
    private boolean headless;

    @Value("${playwright.gmail.timeout}")
    private int timeout;

    private Playwright playwright;
    private Browser browser;

    // Per-account browser contexts (key = gmail email)
    private final Map<String, BrowserContext> contexts = new HashMap<>();

    private synchronized Browser getBrowser() {
        if (playwright == null) {
            playwright = Playwright.create();
        }
        if (browser == null || !browser.isConnected()) {
            browser = playwright.chromium().launch(
                    new BrowserType.LaunchOptions().setHeadless(headless)
            );
        }
        return browser;
    }

    private synchronized BrowserContext getContext(String gmailEmail) {
        return contexts.computeIfAbsent(gmailEmail, k ->
                getBrowser().newContext(new Browser.NewContextOptions()
                        .setViewportSize(1280, 900))
        );
    }

    /**
     * Sends a single email job via Gmail web UI.
     * Throws an exception if sending fails.
     */
    public void send(EmailJob job) throws Exception {
        String gmailEmail = job.getCampaignContact().getCampaign().getGmailEmail();
        String gmailPassword = job.getCampaignContact().getCampaign().getGmailPassword();
        String toEmail = job.getCampaignContact().getContact().getEmail();

        BrowserContext context = getContext(gmailEmail);
        Page page = context.newPage();
        page.setDefaultTimeout(timeout);

        try {
            // Navigate to Gmail
            page.navigate("https://mail.google.com/mail/u/0/");
            page.waitForLoadState(LoadState.NETWORKIDLE);

            // Check if login is needed
            if (page.url().contains("accounts.google.com")) {
                log.info("Logging into Gmail for: {}", gmailEmail);
                login(page, gmailEmail, gmailPassword);
            }

            // Compose and send
            composeAndSend(page, toEmail, job.getSubject(), job.getBody());
            log.info("Email sent via Gmail to {} (job id: {})", toEmail, job.getId());

        } catch (Exception e) {
            // Invalidate context on failure so we re-login next time
            contexts.remove(gmailEmail);
            try { context.close(); } catch (Exception ignored) {}
            throw new Exception("Playwright Gmail send failed: " + e.getMessage(), e);
        } finally {
            try { page.close(); } catch (Exception ignored) {}
        }
    }

    private void login(Page page, String email, String password) {
        // Enter email
        page.waitForSelector("input[type='email']");
        page.fill("input[type='email']", email);
        page.click("#identifierNext, [id='identifierNext']");

        // Enter password
        page.waitForSelector("input[type='password']", new Page.WaitForSelectorOptions().setTimeout(10000));
        page.fill("input[type='password']", password);
        page.click("#passwordNext, [id='passwordNext']");

        // Wait for inbox to load
        page.waitForURL("**/mail.google.com/**", new Page.WaitForURLOptions().setTimeout(20000));
        page.waitForLoadState(LoadState.NETWORKIDLE);
        log.info("Gmail login successful for: {}", email);
    }

    private void composeAndSend(Page page, String to, String subject, String body) {
        // Click Compose button
        page.waitForSelector("[gh='cm'], .T-I.T-I-KE", new Page.WaitForSelectorOptions().setTimeout(15000));
        page.click("[gh='cm'], .T-I.T-I-KE");

        // Wait for compose window
        page.waitForSelector("div[aria-label='To']", new Page.WaitForSelectorOptions().setTimeout(10000));

        // Fill To field
        page.click("div[aria-label='To']");
        page.keyboard().type(to);
        page.keyboard().press("Tab");

        // Fill Subject
        page.click("input[name='subjectbox']");
        page.fill("input[name='subjectbox']", subject);

        // Fill Body
        page.click("div[aria-label='Message Body']");
        page.keyboard().type(body);

        // Send
        page.click("div[aria-label='Send']");

        // Wait briefly to confirm send (snackbar appears)
        try {
            page.waitForSelector(".bAq", new Page.WaitForSelectorOptions().setTimeout(5000));
        } catch (Exception e) {
            // Snackbar selector may differ; proceed anyway
            log.debug("Send confirmation snackbar not detected (may have sent anyway)");
        }
    }

    @PreDestroy
    public void cleanup() {
        contexts.values().forEach(ctx -> {
            try { ctx.close(); } catch (Exception ignored) {}
        });
        contexts.clear();
        if (browser != null) {
            try { browser.close(); } catch (Exception ignored) {}
        }
        if (playwright != null) {
            try { playwright.close(); } catch (Exception ignored) {}
        }
    }
}
