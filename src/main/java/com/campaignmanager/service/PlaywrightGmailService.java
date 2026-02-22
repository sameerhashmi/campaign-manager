package com.campaignmanager.service;

import com.campaignmanager.model.EmailJob;
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.LoadState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Sends emails by automating Gmail web UI using Playwright.
 *
 * Uses the persistent Gmail session managed by {@link PlaywrightSessionService}.
 * No credentials are stored here — the user logs in once via the Settings page.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PlaywrightGmailService {

    private final PlaywrightSessionService sessionService;

    /**
     * Sends a single email job via Gmail web UI using the stored session.
     * Throws an exception if sending fails.
     */
    public void send(EmailJob job) throws Exception {
        String toEmail = job.getCampaignContact().getContact().getEmail();

        BrowserContext context = sessionService.getSessionContext();
        Page page = context.newPage();

        try {
            // Navigate to Gmail
            page.navigate("https://mail.google.com/mail/u/0/");
            page.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(30_000));

            // If session expired and we're redirected to login, invalidate and fail
            if (page.url().contains("accounts.google.com")) {
                sessionService.invalidateCachedContext();
                throw new Exception(
                        "Gmail session has expired. Go to Settings → Connect Gmail to re-establish the session.");
            }

            composeAndSend(page, toEmail, job.getSubject(), job.getBody());
            log.info("Email sent via Gmail to {} (job id: {})", toEmail, job.getId());

        } catch (Exception e) {
            // Invalidate context so next attempt gets a fresh one
            sessionService.invalidateCachedContext();
            throw new Exception("Playwright Gmail send failed: " + e.getMessage(), e);
        } finally {
            try { page.close(); } catch (Exception ignored) {}
        }
    }

    private void composeAndSend(Page page, String to, String subject, String body) {
        // Click Compose button
        page.waitForSelector("[gh='cm'], .T-I.T-I-KE", new Page.WaitForSelectorOptions().setTimeout(15_000));
        page.click("[gh='cm'], .T-I.T-I-KE");

        // Wait for compose window
        page.waitForSelector("div[aria-label='To']", new Page.WaitForSelectorOptions().setTimeout(10_000));

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
            page.waitForSelector(".bAq", new Page.WaitForSelectorOptions().setTimeout(5_000));
        } catch (Exception e) {
            log.debug("Send confirmation snackbar not detected (may have sent anyway)");
        }
    }
}
