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

function setupKeyCapture(onEnter) {
  if (!process.stdin.isTTY) return () => {};
  try {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (key) => {
      if (key === '\r' || key === '\n' || key === ' ') onEnter();
      if (key === '\u0003') { console.log('\nAborted.'); process.exit(0); }
    });
  } catch (_) {}
  return () => {
    try { process.stdin.setRawMode(false); } catch (_) {}
    process.stdin.pause();
  };
}

async function main() {
  const outputDir  = path.join(__dirname, '..', 'data');
  const outputFile = path.join(outputDir, 'gmail-session.json');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  let manualCapture = false;
  const releaseStdin = setupKeyCapture(() => { manualCapture = true; });

  console.log('Opening Chrome — please log into Gmail...\n');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  // Auto-close popup windows that aren't Gmail or Google login (e.g. Google Chat).
  // waitForURL(predicate) receives a URL object — using a poll loop instead to
  // avoid the TypeError from calling string methods on a URL object.
  async function closeIfNotGmail(newPage) {
    try {
      let url = '';
      for (let i = 0; i < 20; i++) {
        url = newPage.url();
        if (url && url !== 'about:blank' && url !== 'about:newtab') break;
        await sleep(400);
      }
      if (!url || url.startsWith('about:')) return;
      if (url.includes('mail.google.com') || url.includes('accounts.google.com')) return;
      console.log('\n  [auto-close popup] ' + url.substring(0, 80));
      await newPage.close();
    } catch (_) {}
  }

  context.on('page', closeIfNotGmail);

  const page = await context.newPage();
  // Also catch window.open() popups fired directly from the Gmail page
  page.on('popup', closeIfNotGmail);
  await page.goto('https://mail.google.com');

  console.log('──────────────────────────────────────────────────────');
  console.log(' Sign in to Gmail in the browser that just opened.');
  console.log(' Any Google Chat / Meet popups will be closed for you.');
  console.log(' Session saves automatically once your inbox is visible.');
  console.log(' Or press Enter / Space to capture manually at any time.');
  console.log('──────────────────────────────────────────────────────\n');

  const inboxSelectors = [
    '[gh="cm"]',
    '[data-tooltip="Compose"]',
    'div[role="main"]',
    '.nH',
    'div[data-view-id]',
  ];

  const TIMEOUT_MS = 300_000;
  const POLL_MS    = 2_000;
  const deadline   = Date.now() + TIMEOUT_MS;
  let captured     = false;

  while (Date.now() < deadline) {
    await sleep(POLL_MS);

    if (manualCapture) {
      process.stdout.write('\n');
      console.log('Manual capture triggered — saving session...');
      captured = true;
      break;
    }

    // Find the Gmail page (in case focus moved to another tab)
    let gmailPage = null;
    for (const p of context.pages()) {
      try {
        const u = p.url();
        if (u.includes('mail.google.com')) { gmailPage = p; break; }
      } catch (_) {}
    }
    if (!gmailPage) continue;

    const url = gmailPage.url();
    process.stdout.write('\r  URL: ' + url.substring(0, 72).padEnd(72));

    // Bring Gmail to front so selectors are active
    try { await gmailPage.bringToFront(); } catch (_) {}

    for (const sel of inboxSelectors) {
      try {
        const visible = await gmailPage.locator(sel).first().isVisible({ timeout: 300 });
        if (visible) {
          process.stdout.write('\n');
          console.log('Inbox detected — saving session...');
          await sleep(2000);
          captured = true;
          break;
        }
      } catch (_) {}
    }

    if (captured) break;
  }

  releaseStdin();

  if (captured) {
    const storageState = await context.storageState();
    fs.writeFileSync(outputFile, JSON.stringify(storageState, null, 2));
    await browser.close();
    console.log('\n✓ Session saved to: ' + outputFile);
    console.log('Next step: Settings → Upload Session File → upload that file\n');
  } else {
    await browser.close();
    console.error('\n✗ Timed out. Please try again and log in within 5 minutes.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nError:', err.message || err);
  process.exit(1);
});
