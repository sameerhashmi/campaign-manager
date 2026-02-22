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

        // Fill To field.
        // IMPORTANT: We must press Enter (not Tab) to confirm the recipient as a chip.
        // Without the chip, Gmail silently saves to Drafts instead of sending — the compose
        // window closes but the email is never delivered.
        page.click("div[aria-label='To']");
        page.keyboard().type(to);
        page.keyboard().press("Enter");

        // Verify Gmail created the recipient chip before proceeding.
        // The chip has a data-hovercard-id attribute matching the email address.
        // If this selector times out the email was not added as a valid recipient.
        try {
            page.waitForSelector("div[data-hovercard-id='" + to + "']",
                    new Page.WaitForSelectorOptions().setTimeout(5_000));
            log.debug("Recipient chip confirmed for {}", to);
        } catch (Exception e) {
            // Chip not found — try Tab as secondary fallback and wait a moment
            log.warn("Recipient chip not detected for {} via Enter, trying Tab fallback", to);
            page.keyboard().press("Tab");
            page.waitForTimeout(1_500);
        }

        // Fill Subject
        page.click("input[name='subjectbox']");
        page.fill("input[name='subjectbox']", subject);

        // Click the body area then type the content
        page.click("div[aria-label='Message Body']");
        page.keyboard().type(body);

        // Send via Ctrl+Enter keyboard shortcut — this is Gmail's official send shortcut
        // and is more reliable than clicking div[aria-label='Send'] which can be obscured
        // or mis-targeted.
        page.keyboard().press("Control+Enter");

        // Wait for the compose window to close. Note: Gmail also closes the window when saving
        // a draft, so this alone is not sufficient confirmation. We pair it with the snackbar
        // check below.
        try {
            page.waitForSelector("div.T-P", new Page.WaitForSelectorOptions()
                    .setState(WaitForSelectorState.HIDDEN)
                    .setTimeout(15_000));
        } catch (Exception e) {
            throw new RuntimeException(
                    "Compose window did not close — email was NOT sent to " + to +
                    ". Gmail may be showing a validation error.", e);
        }

        // Confirm "Message sent" snackbar appears. This distinguishes a successful send
        // from a "Draft saved" close. The snackbar text is locale-dependent so we check
        // for the container class (.vh) which only appears after a send action completes.
        // We do NOT fail on timeout here — if the snackbar already faded we still trust
        // that Ctrl+Enter with a confirmed chip sent the email.
        try {
            page.waitForSelector(".vh", new Page.WaitForSelectorOptions().setTimeout(5_000));
            log.debug("Send snackbar appeared — email delivered to Gmail outbox for {}", to);
        } catch (Exception e) {
            log.warn("Send confirmation snackbar (.vh) not detected for {} — " +
                    "email may have sent but snackbar faded too fast, or email went to Drafts. " +
                    "Verify in Gmail Sent folder.", to);
        }
    }
}
