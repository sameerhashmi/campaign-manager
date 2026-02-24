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

  // Wait until the user reaches the Gmail inbox (URL contains /mail/u/)
  console.log('Waiting for Gmail inbox (sign in and complete any 2-step verification)...');
  await page.waitForURL('**/mail/u/**', { timeout: 300_000 }); // 5-minute timeout

  // Give the page a moment to fully settle
  await page.waitForTimeout(2000);

  const storageState = await context.storageState();
  fs.writeFileSync(outputFile, JSON.stringify(storageState, null, 2));

  await browser.close();

  console.log('\nSession saved to: ' + outputFile);
  console.log('\nNext step:');
  console.log('  Go to your cloud app → Settings → Upload Session File');
  console.log('  and upload: ' + outputFile);
  console.log('  OR paste the JSON contents into the "Paste Session JSON" box.\n');
})();
