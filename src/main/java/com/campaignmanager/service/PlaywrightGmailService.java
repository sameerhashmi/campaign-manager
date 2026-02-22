package com.campaignmanager.service;

import com.campaignmanager.model.EmailJob;
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.WaitForSelectorState;
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
            // Navigate to Gmail — page.navigate already waits for the load event.
            // NETWORKIDLE is never reached because Gmail holds persistent WebSocket connections,
            // so we rely on waitForSelector for the compose button instead.
            page.navigate("https://mail.google.com/mail/u/0/");

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

        // Wait for compose window To field to appear
        page.waitForSelector("div[aria-label='To']", new Page.WaitForSelectorOptions().setTimeout(10_000));

        // Fill To field — type the address then Tab to confirm the recipient chip
        page.click("div[aria-label='To']");
        page.keyboard().type(to);
        page.keyboard().press("Tab");
        // Short pause to let Gmail register the recipient chip before moving on
        page.waitForTimeout(800);

        // Fill Subject
        page.click("input[name='subjectbox']");
        page.fill("input[name='subjectbox']", subject);

        // Fill Body
        page.click("div[aria-label='Message Body']");
        page.keyboard().type(body);

        // Click Send
        page.click("div[aria-label='Send']");

        // Wait for the compose window to close — this is the definitive confirmation that Gmail
        // accepted and queued the email. If the window stays open, Gmail showed a validation error
        // (e.g. invalid recipient, attachment too large) and the email was NOT sent.
        try {
            page.waitForSelector("div.T-P", new Page.WaitForSelectorOptions()
                    .setState(WaitForSelectorState.HIDDEN)
                    .setTimeout(15_000));
            log.debug("Compose window closed — email queued for delivery to {}", to);
        } catch (Exception e) {
            throw new RuntimeException(
                    "Compose window did not close after clicking Send — email was NOT sent to " + to +
                    ". Gmail may be showing a validation error (check for invalid recipient address).", e);
        }
    }
}
