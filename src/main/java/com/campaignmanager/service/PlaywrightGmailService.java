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
        // ── Step 1: Open compose window ──────────────────────────────────────────
        page.waitForSelector("[gh='cm'], .T-I.T-I-KE", new Page.WaitForSelectorOptions().setTimeout(15_000));
        page.click("[gh='cm'], .T-I.T-I-KE");
        page.waitForSelector("div[aria-label='To']", new Page.WaitForSelectorOptions().setTimeout(10_000));

        // ── Step 2: Fill the To field ────────────────────────────────────────────
        // Click the To area, type the address, then press Tab.
        // Tab is Gmail's standard mechanism to confirm the address as a chip
        // and move focus to the Subject field. We wait 1 second after Tab
        // to let Gmail render the chip before we proceed.
        page.click("div[aria-label='To']");
        page.keyboard().type(to);
        page.keyboard().press("Tab");
        page.waitForTimeout(1_000);

        // ── Step 3: Fill Subject ─────────────────────────────────────────────────
        // page.fill() is reliable for standard input elements and does not depend
        // on keyboard focus.
        page.fill("input[name='subjectbox']", subject);

        // ── Step 4: Fill Body ────────────────────────────────────────────────────
        // Click the contenteditable body area to give it focus, then type.
        page.click("div[aria-label='Message Body']");
        page.waitForTimeout(300);
        page.keyboard().type(body);

        // ── Step 5: Send ─────────────────────────────────────────────────────────
        // Primary: click Gmail's Send button (.aoO is the compose Send button class).
        // This is more reliable than keyboard shortcuts because it does not depend
        // on which element currently has keyboard focus.
        // Fallback: Ctrl+Enter if the button cannot be located.
        boolean clickedSend = false;
        try {
            page.click(".T-I.aoO", new Page.ClickOptions().setTimeout(6_000));
            clickedSend = true;
            log.debug("Clicked Send button (.aoO) for {}", to);
        } catch (Exception e) {
            log.warn("Send button (.aoO) not clickable for {} — trying Ctrl+Enter fallback", to);
        }
        if (!clickedSend) {
            page.keyboard().press("Control+Enter");
        }

        // ── Step 6: Confirm compose window closed ────────────────────────────────
        // Gmail's compose container (div.T-P) disappears when the email is accepted.
        // If it stays open, Gmail is showing a validation error (invalid address, etc.)
        // and the email was NOT sent — we throw so the job is marked FAILED.
        try {
            page.waitForSelector("div.T-P", new Page.WaitForSelectorOptions()
                    .setState(WaitForSelectorState.HIDDEN)
                    .setTimeout(15_000));
        } catch (Exception e) {
            throw new RuntimeException(
                    "Compose window did not close after Send — email NOT sent to " + to +
                    ". Check Gmail for a validation error (invalid recipient address?).", e);
        }

        // ── Step 7: Optional snackbar confirmation ───────────────────────────────
        // The .vh snackbar appears on a successful send but NOT on a draft save.
        // We log a warning if absent but do NOT fail — the compose window close
        // in Step 6 is the primary confirmation.
        try {
            page.waitForSelector(".vh", new Page.WaitForSelectorOptions().setTimeout(5_000));
            log.debug("'Message sent' snackbar confirmed for {}", to);
        } catch (Exception e) {
            log.warn("Send snackbar (.vh) not detected for {} — verify email in Gmail Sent folder", to);
        }
    }
}
