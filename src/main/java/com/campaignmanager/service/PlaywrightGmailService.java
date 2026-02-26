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

        // ── Step 4: Fill Body (above Gmail signature) ───────────────────────────
        // Click the body area to focus it, then use JS to:
        //   1. Locate the Gmail signature element (class=gmail_signature or
        //      data-smartmail="gmail_signature").
        //   2. Walk up from the signature to its direct child of the body div.
        //   3. Position the cursor right before that container using Range/Selection.
        //   4. Call execCommand('insertText') to inject the body text above the sig,
        //      followed by two newlines so there is a blank line between body and sig.
        // If no signature is present the cursor is placed at the very start of the
        // body and the text is inserted there (same as before).
        page.click("div[aria-label='Message Body']");
        page.waitForTimeout(300);
        page.evaluate(
            "(text) => {" +
            "  const body = document.querySelector('div[aria-label=\"Message Body\"]');" +
            "  if (!body) return;" +
            "  body.focus();" +
            "  const sig = body.querySelector('.gmail_signature, [data-smartmail=\"gmail_signature\"]');" +
            "  const sel = window.getSelection();" +
            "  const range = document.createRange();" +
            "  if (sig) {" +
            "    let sigTop = sig;" +
            "    while (sigTop.parentElement && sigTop.parentElement !== body) sigTop = sigTop.parentElement;" +
            "    range.setStartBefore(sigTop);" +
            "    range.collapse(true);" +
            "    sel.removeAllRanges();" +
            "    sel.addRange(range);" +
            "    document.execCommand('insertText', false, text + '\\n\\n');" +
            "  } else {" +
            "    range.setStart(body, 0);" +
            "    range.collapse(true);" +
            "    sel.removeAllRanges();" +
            "    sel.addRange(range);" +
            "    document.execCommand('insertText', false, text);" +
            "  }" +
            "}",
            body);

        // ── Step 5: Send ─────────────────────────────────────────────────────────
        // Primary: click Gmail's Send button (.aoO is the compose Send button class).
        // This is more reliable than keyboard shortcuts because it does not depend
        // on which element currently has keyboard focus.
        // Fallback: Ctrl+Enter if the button cannot be located.
        log.info("Clicking Send for job to={} subject='{}'", to, subject);
        boolean clickedSend = false;
        try {
            page.click(".T-I.aoO", new Page.ClickOptions().setTimeout(6_000));
            clickedSend = true;
            log.info("Clicked Send button (.aoO) for {}", to);
        } catch (Exception e) {
            log.warn("Send button (.aoO) not clickable for {} — trying Ctrl+Enter fallback", to);
        }
        if (!clickedSend) {
            page.keyboard().press("Control+Enter");
        }

        // Give Gmail 1 second to process the send before checking the compose window
        page.waitForTimeout(1_000);

        // ── Step 6: Confirm compose window closed ────────────────────────────────
        // Gmail's compose container (div.T-P) disappears when the email is accepted.
        // If it stays open, Gmail is showing a validation error.
        try {
            page.waitForSelector("div.T-P", new Page.WaitForSelectorOptions()
                    .setState(WaitForSelectorState.HIDDEN)
                    .setTimeout(15_000));
        } catch (Exception e) {
            throw new RuntimeException(
                    "Compose window did not close after Send — email NOT sent to " + to +
                    ". Check Gmail for a validation error (invalid recipient address?).", e);
        }

        // ── Step 7: Require snackbar confirmation ────────────────────────────────
        // The .vh snackbar ("Message sent") appears ONLY on a successful send, NOT
        // on a draft save. Treating its absence as a failure prevents emails silently
        // ending up in Drafts instead of being delivered.
        try {
            page.waitForSelector(".vh", new Page.WaitForSelectorOptions().setTimeout(8_000));
            log.info("'Message sent' snackbar confirmed for {}", to);
        } catch (Exception e) {
            throw new RuntimeException(
                    "Gmail did not confirm send for " + to +
                    " — email may have been saved as Draft. Job will be retried.", e);
        }
    }
}
