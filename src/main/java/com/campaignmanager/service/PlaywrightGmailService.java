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
        String toEmail     = job.getCampaignContact().getContact().getEmail();
        String senderEmail = job.getCampaignContact().getCampaign().getGmailEmail();

        // Route to the campaign-specific session.
        // If no account is assigned: allow fallback only when exactly 1 session exists
        // (backward compat for campaigns created before multi-session support).
        // With 2+ sessions and no assignment, fail clearly rather than silently
        // sending from the wrong account.
        BrowserContext context;
        if (senderEmail != null && !senderEmail.isBlank()) {
            context = sessionService.getSessionContext(senderEmail);
        } else {
            java.util.List<String> available = sessionService.listConnectedEmails();
            if (available.size() == 1) {
                context = sessionService.getSessionContext(available.get(0));
            } else if (available.isEmpty()) {
                throw new Exception("No Gmail session connected. Go to Settings → Gmail Sessions and upload a session file.");
            } else {
                throw new Exception("This campaign has no Gmail account assigned. " +
                        "Edit the campaign and set 'Send From' to a specific Gmail account before sending.");
            }
        }

        Page page = context.newPage();

        try {
            page.navigate("https://mail.google.com/mail/u/0/");

            // If session expired and redirected to login, invalidate only that account's context
            if (page.url().contains("accounts.google.com")) {
                invalidateContext(senderEmail);
                throw new Exception(
                        "Gmail session has expired for " +
                        (senderEmail != null ? senderEmail : "the connected account") +
                        ". Go to Settings → Gmail Sessions and upload a new session.");
            }

            composeAndSend(page, toEmail, job.getSubject(), job.getBody());
            log.info("Email sent via Gmail to {} from {} (job id: {})",
                    toEmail, senderEmail != null ? senderEmail : "default", job.getId());

        } catch (Exception e) {
            invalidateContext(senderEmail);
            throw new Exception("Playwright Gmail send failed: " + e.getMessage(), e);
        } finally {
            try { page.close(); } catch (Exception ignored) {}
        }
    }

    private void invalidateContext(String senderEmail) {
        if (senderEmail != null && !senderEmail.isBlank()) {
            sessionService.invalidateCachedContext(senderEmail);
        } else {
            sessionService.invalidateCachedContext();
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
        // Uses direct DOM manipulation (no execCommand) to avoid Chrome's Trusted Types
        // policy which blocks execCommand('insertHTML', false, plainString).
        // Builds a styled wrapper div from text nodes + <br> elements so the font
        // colour is explicitly black regardless of Gmail's compose theme.
        page.click("div[aria-label='Message Body']");
        page.waitForTimeout(300);
        page.evaluate(
            "(text) => {" +
            "  const body = document.querySelector('div[aria-label=\"Message Body\"]');" +
            "  if (!body) return;" +
            "  body.focus();" +
            "  const wrapper = document.createElement('div');" +
            "  wrapper.style.color = '#000000';" +
            "  wrapper.style.fontFamily = 'Arial,sans-serif';" +
            "  wrapper.style.fontSize = '14px';" +
            "  const lines = text.split('\\n');" +
            "  lines.forEach((line, i) => {" +
            "    if (line) wrapper.appendChild(document.createTextNode(line));" +
            "    if (i < lines.length - 1) wrapper.appendChild(document.createElement('br'));" +
            "  });" +
            "  const sig = body.querySelector('.gmail_signature, [data-smartmail=\"gmail_signature\"]');" +
            "  if (sig) {" +
            "    let sigTop = sig;" +
            "    while (sigTop.parentElement && sigTop.parentElement !== body) sigTop = sigTop.parentElement;" +
            "    const frag = document.createDocumentFragment();" +
            "    frag.appendChild(wrapper);" +
            "    frag.appendChild(document.createElement('br'));" +
            "    frag.appendChild(document.createElement('br'));" +
            "    body.insertBefore(frag, sigTop);" +
            "  } else {" +
            "    body.insertBefore(wrapper, body.firstChild);" +
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
