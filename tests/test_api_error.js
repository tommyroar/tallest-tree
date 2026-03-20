/**
 * Playwright test: map click shows graceful error when backend is unavailable.
 *
 * Runs against Vite dev server (no Flask backend), so /api/analyze
 * returns HTML instead of JSON. Verifies the app catches the parse error
 * and shows an alert rather than silently failing.
 *
 * Requires Vite running on port 5180 (no Flask).
 * Run: npx playwright test --project=api-error
 */

const { test, expect } = require('@playwright/test');

test.describe('API Error Handling', () => {
  test('shows error alert when backend is unavailable', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(/PNW Canopy Height Explorer/);

    // Capture the alert dialog
    const dialogPromise = page.waitForEvent('dialog');

    // Click the map — backend is not running, so /api/analyze will fail
    await page.evaluate(() => {
      window._map.fire('click', { latlng: L.latLng(47.8, -123.9) });
    });

    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Analysis failed');
    await dialog.dismiss();

    // Loading indicator should not be stuck
    const loadingActive = await page.locator('#loading').evaluate(
      el => el.classList.contains('active')
    );
    expect(loadingActive).toBe(false);
  });
});
