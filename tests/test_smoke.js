/**
 * Playwright headless browser smoke test for PNW Canopy Height Explorer.
 *
 * Spawns the Flask server, opens the page in headless Chromium,
 * validates the UI loads and a map click produces tree results.
 *
 * Run: node tests/test_smoke.js
 */

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 5111;
const BASE = `http://localhost:${PORT}`;
const SERVER_TIMEOUT = 20000;   // 20s to start server
const ANALYSIS_TIMEOUT = 90000; // 90s for S3 analysis

let serverProc = null;

function log(msg) {
  console.log(`[smoke] ${msg}`);
}

function fail(msg) {
  console.error(`[smoke] FAIL: ${msg}`);
  cleanup();
  process.exit(1);
}

function cleanup() {
  if (serverProc) {
    serverProc.kill('SIGTERM');
    serverProc = null;
  }
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });

/** Poll the health endpoint until server is ready. */
function waitForServer() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + SERVER_TIMEOUT;
    const check = () => {
      if (Date.now() > deadline) return reject(new Error('Server did not start in time'));
      http.get(`${BASE}/api/health`, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.status === 'ok') return resolve();
          } catch {}
          setTimeout(check, 500);
        });
      }).on('error', () => setTimeout(check, 500));
    };
    check();
  });
}

async function run() {
  // 1. Start Flask server
  log('Starting Flask server...');
  const projectDir = path.resolve(__dirname, '..');
  const venvPython = path.join(projectDir, '.venv', 'bin', 'python');
  serverProc = spawn(venvPython, ['server.py'], {
    cwd: projectDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  serverProc.stderr.on('data', (d) => {
    const line = d.toString().trim();
    if (line && !line.includes('GET /') && !line.includes('POST /')) {
      // Only show non-request log lines
    }
  });

  serverProc.on('exit', (code) => {
    if (code !== null && code !== 0) {
      fail(`Server exited with code ${code}`);
    }
  });

  await waitForServer();
  log('Server is ready.');

  // 2. Launch browser
  log('Launching headless Chromium...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 3. Load page
    log('Loading page...');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });

    // 4. Check title
    const title = await page.title();
    if (!title.includes('PNW Canopy Height Explorer')) {
      fail(`Expected title to contain "PNW Canopy Height Explorer", got "${title}"`);
    }
    log('✓ Page title correct');

    // 5. Check map rendered
    const tilePane = await page.$('.leaflet-tile-pane');
    if (!tilePane) fail('Leaflet tile pane not found');
    log('✓ Map rendered');

    // 6. Check sidebar
    const sidebar = await page.$('#sidebar');
    if (!sidebar) fail('Sidebar not found');
    const sidebarText = await sidebar.textContent();
    if (!sidebarText.includes('Statistics')) fail('Sidebar missing Statistics section');
    const statMax = await page.$('#stat-max');
    if (!statMax) fail('#stat-max element not found');
    const forestViz = await page.$('#forest-viz');
    if (!forestViz) fail('#forest-viz element not found');
    log('✓ Sidebar structure correct');

    // 7. Check hint
    const hint = await page.$('#hint');
    if (hint) {
      const hintText = await hint.textContent();
      if (!hintText.includes('Click anywhere')) fail('Hint text unexpected');
      log('✓ Hint displayed');
    }

    // 8. Trigger map click via Leaflet API (use window._map exposed globally)
    log('Triggering map click at Olympic NP (47.8, -123.9)...');
    await page.evaluate(() => {
      const m = window._map;
      const latlng = L.latLng(47.8, -123.9);
      m.fire('click', { latlng: latlng });
    });

    // 9. Wait for forest profile to populate (S3 fetch can be slow)
    log('Waiting for analysis results (this may take up to 60s)...');
    await page.waitForSelector('#forest-viz .tree-sil', { timeout: ANALYSIS_TIMEOUT });

    const treeCount = await page.$$eval('#forest-viz .tree-sil', items => items.length);
    if (treeCount === 0) fail('Forest profile is empty after analysis');
    log(`✓ Forest profile populated (${treeCount} trees)`);

    // 10. Check stats updated
    const maxText = await page.$eval('#stat-max', el => el.textContent);
    if (maxText === '—' || maxText === '---') fail('Stats not updated after analysis');
    log(`✓ Stats updated (max height: ${maxText})`);

    // 11. Check markers on map
    const markerCount = await page.$$eval('.leaflet-interactive', els => els.length);
    log(`✓ ${markerCount} map elements rendered`);

    log('');
    log('All smoke tests passed!');

  } finally {
    await browser.close();
    cleanup();
  }
}

run().catch((err) => {
  fail(err.message || err);
});
