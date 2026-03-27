#!/usr/bin/env node
/**
 * Standalone Gmail session capture script.
 *
 * Requirements (one-time setup):
 *   npm install playwright
 *   npx playwright install chromium
 *
 * Run:
 *   node scripts/capture-gmail-session.js
 *
 * Output:
 *   ./data/gmail-session.json   ← upload this file to Settings → Upload Session File
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const outputDir  = path.join(__dirname, '..', 'data');
  const outputFile = path.join(outputDir, 'gmail-session.json');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log('Opening Chrome — please log into Gmail...\n');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://mail.google.com');

  console.log('──────────────────────────────────────────────────────');
  console.log(' Sign in to Gmail in the browser that just opened.');
  console.log(' The session will be saved automatically 5 seconds');
  console.log(' after your inbox or any Gmail page loads.');
  console.log('──────────────────────────────────────────────────────\n');

  // Must be fully in the Gmail inbox — /mail/u/ confirms SSO is complete.
  function isLoggedIn(url) {
    if (!url) return false;
    // Require /mail/u/ — rules out the SSO-redirect hop through mail.google.com
    if (!url.includes('mail.google.com/mail/u/')) return false;
    if (url.includes('/SignOutOptions') || url.includes('/Logout')) return false;
    return true;
  }

  const TIMEOUT_MS = 300_000;
  const deadline   = Date.now() + TIMEOUT_MS;
  let loggedInAt   = null;
  const SETTLE_MS  = 10_000; // wait 10s after inbox detected (SSO may still be settling)

  while (Date.now() < deadline) {
    await sleep(1_000);

    // Check all pages for an authenticated Gmail URL
    let gmailUrl = null;
    for (const p of context.pages()) {
      try {
        const u = p.url();
        if (isLoggedIn(u)) { gmailUrl = u; break; }
      } catch (_) {}
    }

    if (gmailUrl) {
      if (!loggedInAt) {
        loggedInAt = Date.now();
        process.stdout.write('\n');
        console.log('Gmail inbox detected: ' + gmailUrl.substring(0, 80));
        console.log('Waiting 10 seconds for session to fully settle...');
      }

      const remaining = Math.ceil((SETTLE_MS - (Date.now() - loggedInAt)) / 1000);
      if (remaining > 0) {
        process.stdout.write('\r  Capturing in ' + remaining + 's...  ');
      } else {
        process.stdout.write('\n');
        console.log('Saving session...');

        // context.storageState() hangs because it evaluates JS on every open
        // page to read localStorage. Use context.cookies() instead — it reads
        // directly from the browser cookie store without touching any page.
        // The resulting format matches what Playwright's storageState produces.
        const cookies = await context.cookies();
        const storageState = { cookies, origins: [] };

        fs.writeFileSync(outputFile, JSON.stringify(storageState, null, 2));
        await browser.close();
        console.log('\n✓ Session saved to: ' + outputFile);
        console.log('Next step: Settings → Upload Session File → upload that file\n');
        return;
      }
    } else {
      // Still waiting for login
      try {
        const u = page.url();
        process.stdout.write('\r  Waiting for login... ' + u.substring(0, 55).padEnd(55));
      } catch (_) {}
      loggedInAt = null; // reset if navigated away
    }
  }

  await browser.close();
  console.error('\n✗ Timed out. Please try again and log in within 5 minutes.');
  process.exit(1);
}

main().catch((err) => {
  console.error('\nError:', err.message || err);
  process.exit(1);
});
