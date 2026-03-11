#!/usr/bin/env node
/**
 * Standalone Gmail session capture script.
 *
 * Use this when you can't run the full Java app locally but need a
 * gmail-session.json to upload to a cloud deployment.
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
const fs = require('fs');
const path = require('path');

(async () => {
  const outputDir  = path.join(__dirname, '..', 'data');
  const outputFile = path.join(outputDir, 'gmail-session.json');

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log('Opening Chrome — please log into Gmail...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto('https://mail.google.com');

  console.log('Waiting for Gmail inbox (sign in and complete any 2-step verification)...');
  console.log('The session will be captured automatically once you reach your inbox.\n');

  // Poll every 2 seconds until we see a Gmail inbox indicator.
  // Checks the URL (mail/u/ pattern) AND the presence of the compose button
  // so we handle redirects, account pickers, and slow page loads.
  const TIMEOUT_MS = 300_000; // 5 minutes
  const POLL_MS    = 2_000;
  const deadline   = Date.now() + TIMEOUT_MS;
  let captured     = false;

  while (Date.now() < deadline) {
    await page.waitForTimeout(POLL_MS);

    const url = page.url();
    const onGmail = url.includes('mail.google.com') &&
                    (url.includes('/mail/u/') || url.includes('/mail/r/'));

    let hasInbox = false;
    if (onGmail) {
      // Look for the compose button or the inbox label — reliable signals the inbox loaded
      hasInbox = await page.locator('[gh="cm"], [data-tooltip="Compose"], div[role="navigation"]')
                           .first()
                           .isVisible({ timeout: 1000 })
                           .catch(() => false);
    }

    if (onGmail && hasInbox) {
      // Give the page a moment to settle all cookies
      await page.waitForTimeout(2000);
      const storageState = await context.storageState();
      fs.writeFileSync(outputFile, JSON.stringify(storageState, null, 2));
      captured = true;
      break;
    }
  }

  await browser.close();

  if (captured) {
    console.log('\nSession saved to: ' + outputFile);
    console.log('\nNext step:');
    console.log('  Go to your cloud app → Settings → Upload Session File');
    console.log('  and upload: ' + outputFile + '\n');
  } else {
    console.error('\nTimed out waiting for Gmail inbox. Please try again.');
    console.error('Make sure you fully log in and reach your inbox before the 5-minute limit.\n');
    process.exit(1);
  }
})();
