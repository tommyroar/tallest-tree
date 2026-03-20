/**
 * Playwright smoke test for PNW Canopy Height Explorer.
 *
 * Requires Flask server running on port 5111.
 * Run: npx playwright test --project=smoke
 */

const { test, expect } = require('@playwright/test');

test.describe('Smoke Tests', () => {
  test('page loads with correct title', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(/PNW Canopy Height Explorer/);
  });

  test('map renders with tile pane', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('.leaflet-tile-pane')).toBeVisible();
  });

  test('sidebar has expected structure', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('Statistics');
    await expect(page.locator('#stat-max')).toBeVisible();
    await expect(page.locator('#forest-viz')).toBeVisible();
  });

  test('hint is displayed', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const hint = page.locator('#hint');
    await expect(hint).toContainText('Click anywhere');
  });

  test('map click triggers analysis and populates results', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/', { waitUntil: 'networkidle' });

    // Trigger map click at Olympic NP
    await page.evaluate(() => {
      window._map.fire('click', { latlng: L.latLng(47.8, -123.9) });
    });

    // Wait for forest profile to populate (S3 fetch can be slow)
    await expect(page.locator('#forest-viz .tree-sil').first()).toBeVisible({ timeout: 90_000 });

    // Stats should be updated
    const maxText = await page.locator('#stat-max').textContent();
    expect(maxText).not.toBe('—');
    expect(maxText).not.toBe('---');

    // Map should have interactive elements
    await expect(page.locator('.leaflet-interactive').first()).toBeVisible();
  });
});
