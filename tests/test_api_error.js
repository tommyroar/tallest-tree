/**
 * Playwright test: map click shows graceful error when backend is unavailable.
 *
 * Runs against the Vite dev server (no Flask backend), so /api/analyze
 * returns HTML instead of JSON. Verifies the app catches the parse error
 * and shows an alert rather than silently failing.
 *
 * Run: node tests/test_api_error.js
 *
 * Expects Vite dev server already running on port 5180 (see vite.config.js).
 * Set VITE_PORT env var to override.
 */

const { chromium } = require('playwright');

const PORT = process.env.VITE_PORT || 5180;
const BASE = `http://localhost:${PORT}`;

function log(msg) {
  console.log(`[api-error] ${msg}`);
}

function fail(msg) {
  console.error(`[api-error] FAIL: ${msg}`);
  process.exit(1);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Load the page
    log(`Loading ${BASE}...`);
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });

    const title = await page.title();
    if (!title.includes('PNW Canopy Height Explorer')) {
      fail(`Unexpected page title: "${title}"`);
    }
    log('✓ Page loaded');

    // Set up dialog handler to capture the alert
    let dialogMessage = null;
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    // Click the map — backend is not running, so /api/analyze will return HTML
    log('Clicking map (no Flask backend — expecting JSON parse error)...');
    await page.evaluate(() => {
      window._map.fire('click', { latlng: L.latLng(47.8, -123.9) });
    });

    // Wait for the alert to appear (fetch + parse error)
    const deadline = Date.now() + 10000;
    while (!dialogMessage && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 200));
    }

    if (!dialogMessage) {
      fail('No error alert shown after map click with unavailable backend');
    }

    log(`Alert message: "${dialogMessage}"`);

    // The error should mention "Analysis failed" (from the catch block)
    if (!dialogMessage.includes('Analysis failed')) {
      fail(`Expected alert to contain "Analysis failed", got: "${dialogMessage}"`);
    }
    log('✓ Error alert shown with "Analysis failed" message');

    // Verify the specific JSON parse error is surfaced
    if (dialogMessage.includes('is not valid JSON') || dialogMessage.includes('Unexpected token')) {
      log('✓ JSON parse error detected — backend returned HTML instead of JSON');
    } else {
      // Could be a network error if nothing is listening — also acceptable
      log(`✓ Error caught (message: ${dialogMessage})`);
    }

    // Verify loading indicator is dismissed (not stuck)
    const loadingVisible = await page.$eval('#loading', el =>
      el.classList.contains('active')
    );
    if (loadingVisible) {
      fail('Loading indicator still active after error — UI is stuck');
    }
    log('✓ Loading indicator dismissed after error');

    log('');
    log('All API error handling tests passed!');

  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  fail(err.message || err);
});
