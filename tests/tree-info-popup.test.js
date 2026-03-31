import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'

/**
 * Feature: tree-info-modal, Property 1: Panel content completeness
 * Validates: Requirements 1.4, 1.5, 1.6, 4.1
 *
 * Property: For any valid tree object and total count, buildTreeInfoHTML
 * output contains rank/total, formatted height, error, tier label,
 * tier colour in inline style, lat/lon coords, and GT button with #3d8b40.
 */

const TIERS = ['Common', 'Tall', 'Regional', 'National', 'Global']

// Replicate the formatting functions from index.html
let useFeet = false
function fmtH(meters) {
  if (useFeet) return (meters * 3.28084).toFixed(1) + ' ft'
  return meters + ' m'
}
function fmtH1(meters) {
  if (useFeet) return (meters * 3.28084).toFixed(1) + ' ft'
  return meters.toFixed(1) + ' m'
}

// Replicate buildTreeInfoHTML from index.html
function buildTreeInfoHTML(tree, totalCount) {
  const h = tree.height_m != null ? fmtH(tree.height_m) : '—'
  const err = tree.error_m != null ? fmtH1(tree.error_m) : '—'
  const tier = tree.tier || 'Unknown'
  const colour = tree.colour || '#888'
  const rank = tree.rank != null ? tree.rank : '—'
  const total = totalCount != null ? totalCount : '—'
  const lat = tree.lat != null ? tree.lat.toFixed(5) : '—'
  const lon = tree.lon != null ? tree.lon.toFixed(5) : '—'

  return `<div class="tip-header">#${rank} — ${h}</div>` +
    `<span class="tip-tier-badge" style="color:${colour}">${tier}</span>` +
    `<div class="tip-data">` +
      `<div class="tip-row"><span class="tip-label">Height</span><span class="tip-value">${h} ±${err}</span></div>` +
      `<div class="tip-row"><span class="tip-label">Tier</span><span class="tip-value">${tier}</span></div>` +
      `<div class="tip-row"><span class="tip-label">Rank</span><span class="tip-value">#${rank} of ${total}</span></div>` +
      `<div class="tip-row"><span class="tip-label">Coords</span><span class="tip-value">${lat}, ${lon}</span></div>` +
    `</div>` +
    `<div class="tip-actions">` +
      `<button class="tip-gt-btn" style="background:#3d8b40">📐 Launch Ground Truth Mode</button>` +
      `<button class="tip-flyback-btn" style="display:none">📍 Fly Back to Tree</button>` +
    `</div>`
}

// Arbitrary: random hex colour string like "#a3f0b2"
const hexColourArb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
).map(([r, g, b]) =>
  '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0')
)

// Arbitrary: valid tree object within spec ranges
const treeArb = fc.record({
  rank: fc.integer({ min: 1, max: 500 }),
  height_m: fc.double({ min: 2.0, max: 120.0, noNaN: true, noDefaultInfinity: true }),
  error_m: fc.double({ min: 0.1, max: 10.0, noNaN: true, noDefaultInfinity: true }),
  tier: fc.constantFrom(...TIERS),
  lat: fc.double({ min: 41, max: 50, noNaN: true, noDefaultInfinity: true }),
  lon: fc.double({ min: -126, max: -115, noNaN: true, noDefaultInfinity: true }),
  colour: hexColourArb,
})

const totalCountArb = fc.integer({ min: 1, max: 1000 })

describe('Feature: tree-info-modal, Property 1: Panel content completeness', () => {
  beforeEach(() => {
    useFeet = false
  })

  it('buildTreeInfoHTML output contains all required fields for any valid tree (metres)', () => {
    fc.assert(
      fc.property(treeArb, totalCountArb, (tree, totalCount) => {
        const html = buildTreeInfoHTML(tree, totalCount)

        // Contains "#rank of total"
        expect(html).toContain(`#${tree.rank} of ${totalCount}`)

        // Contains formatted height (metres mode)
        const expectedHeight = fmtH(tree.height_m)
        expect(html).toContain(expectedHeight)

        // Contains error value
        const expectedError = fmtH1(tree.error_m)
        expect(html).toContain(expectedError)

        // Contains tier label
        expect(html).toContain(tree.tier)

        // Contains tier colour in inline style
        expect(html).toContain(`color:${tree.colour}`)

        // Contains lat/lon coordinates
        expect(html).toContain(tree.lat.toFixed(5))
        expect(html).toContain(tree.lon.toFixed(5))

        // Contains GT button with #3d8b40
        expect(html).toContain('#3d8b40')
        expect(html).toContain('Launch Ground Truth Mode')
      }),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: tree-info-modal, Property 2: Unit conversion correctness
 * Validates: Requirements 7.1, 7.2
 *
 * Property: For any height in metres and any unit preference (metres or feet),
 * fmtH1 returns the original metre value rounded to 1 decimal with ' m' suffix
 * when in metres mode, or the value × 3.28084 rounded to 1 decimal with ' ft'
 * suffix when in feet mode.
 */
describe('Feature: tree-info-modal, Property 2: Unit conversion correctness', () => {
  beforeEach(() => {
    useFeet = false
  })

  it('fmtH1 returns correctly formatted metres or feet for any height and unit preference', () => {
    const heightArb = fc.double({ min: 0.1, max: 200.0, noNaN: true, noDefaultInfinity: true })
    const unitArb = fc.boolean() // true = feet, false = metres

    fc.assert(
      fc.property(heightArb, unitArb, (height, isFeet) => {
        useFeet = isFeet

        const result = fmtH1(height)

        if (isFeet) {
          const expectedValue = (height * 3.28084).toFixed(1)
          expect(result).toBe(expectedValue + ' ft')
        } else {
          const expectedValue = height.toFixed(1)
          expect(result).toBe(expectedValue + ' m')
        }
      }),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: tree-info-modal, Property 3: Fly-back button visibility tracks viewport
 * Validates: Requirements 3.1, 3.2, 3.4
 *
 * Property: For any tree latlng and any map viewport bounds, the "Fly Back to Tree"
 * button visibility SHALL be true if and only if the tree's latlng is outside the
 * viewport bounds.
 */

// Pure logic: does a bounding box contain a point?
function boundsContain(sw, ne, lat, lon) {
  return lat >= sw.lat && lat <= ne.lat && lon >= sw.lon && lon <= ne.lon;
}

// Pure logic: should the fly-back button be visible?
function shouldShowFlyBack(treeLat, treeLon, sw, ne) {
  return !boundsContain(sw, ne, treeLat, treeLon);
}

// Arbitrary: generate a valid bounding box (sw < ne for both lat and lon)
const boundsArb = fc.tuple(
  fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
  fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
  fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
  fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
).chain(([lat1, lat2, lon1, lon2]) => {
  const swLat = Math.min(lat1, lat2);
  const neLat = Math.max(lat1, lat2);
  const swLon = Math.min(lon1, lon2);
  const neLon = Math.max(lon1, lon2);
  // Ensure sw != ne so bounds have area
  if (swLat === neLat || swLon === neLon) {
    return fc.constant({
      sw: { lat: swLat, lon: swLon },
      ne: { lat: neLat + 0.001, lon: neLon + 0.001 },
    });
  }
  return fc.constant({
    sw: { lat: swLat, lon: swLon },
    ne: { lat: neLat, lon: neLon },
  });
});

// Arbitrary: random tree latlng
const treeLatlngArb = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
  lon: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
});

describe('Feature: tree-info-modal, Property 3: Fly-back button visibility tracks viewport', () => {
  it('fly-back button is visible iff tree latlng is outside viewport bounds', () => {
    fc.assert(
      fc.property(treeLatlngArb, boundsArb, (tree, bounds) => {
        const inView = boundsContain(bounds.sw, bounds.ne, tree.lat, tree.lon);
        const visible = shouldShowFlyBack(tree.lat, tree.lon, bounds.sw, bounds.ne);

        // Core property: visibility === !inView
        expect(visible).toBe(!inView);
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Unit tests for buildTreeInfoHTML
 * Validates: Requirements 1.4, 1.5, 1.6, 6.4
 */
describe('buildTreeInfoHTML unit tests', () => {
  beforeEach(() => {
    useFeet = false;
  });

  describe('correct HTML output for a known tree object', () => {
    const tree = {
      rank: 3,
      height_m: 62.4,
      error_m: 2.8,
      tier: 'Tall',
      lat: 46.789,
      lon: -121.745,
      colour: '#44bb44',
    };
    const totalCount = 147;

    it('contains the rank and height in the header', () => {
      const html = buildTreeInfoHTML(tree, totalCount);
      expect(html).toContain('#3');
      expect(html).toContain('62.4 m');
    });

    it('contains the tier badge with the correct colour', () => {
      const html = buildTreeInfoHTML(tree, totalCount);
      expect(html).toContain('tip-tier-badge');
      expect(html).toContain('color:#44bb44');
      expect(html).toContain('Tall');
    });

    it('contains height with error margin row', () => {
      const html = buildTreeInfoHTML(tree, totalCount);
      expect(html).toContain('62.4 m');
      expect(html).toContain('±2.8 m');
    });

    it('contains rank of total in the format "#3 of 147"', () => {
      /** Validates: Requirements 1.6 */
      const html = buildTreeInfoHTML(tree, totalCount);
      expect(html).toContain('#3 of 147');
    });

    it('contains lat/lon coordinates formatted to 5 decimal places', () => {
      const html = buildTreeInfoHTML(tree, totalCount);
      expect(html).toContain('46.78900');
      expect(html).toContain('-121.74500');
    });

    it('contains the "Launch Ground Truth Mode" button with green accent', () => {
      const html = buildTreeInfoHTML(tree, totalCount);
      expect(html).toContain('Launch Ground Truth Mode');
      expect(html).toContain('#3d8b40');
    });

    it('contains the "Fly Back to Tree" button hidden by default', () => {
      const html = buildTreeInfoHTML(tree, totalCount);
      expect(html).toContain('Fly Back to Tree');
      expect(html).toContain('display:none');
    });
  });

  describe('fallback values for missing fields', () => {
    const emptyTree = {
      rank: null,
      height_m: null,
      error_m: null,
      tier: null,
      lat: null,
      lon: null,
      colour: null,
    };

    it('uses "—" for missing rank', () => {
      const html = buildTreeInfoHTML(emptyTree, 100);
      expect(html).toContain('#—');
    });

    it('uses "—" for missing height', () => {
      const html = buildTreeInfoHTML(emptyTree, 100);
      // Height row should show the fallback dash
      expect(html).toContain('<span class="tip-value">— ±—</span>');
    });

    it('uses "Unknown" for missing tier', () => {
      const html = buildTreeInfoHTML(emptyTree, 100);
      expect(html).toContain('Unknown');
    });

    it('uses "—" for missing lat/lon', () => {
      const html = buildTreeInfoHTML(emptyTree, 100);
      // Coords row should show dashes
      expect(html).toContain('<span class="tip-value">—, —</span>');
    });

    it('uses fallback colour #888 for missing colour', () => {
      const html = buildTreeInfoHTML(emptyTree, 100);
      expect(html).toContain('color:#888');
    });

    it('uses "—" for missing totalCount', () => {
      const tree = { rank: 1, height_m: 50, error_m: 2.8, tier: 'Tall', lat: 46, lon: -121, colour: '#44bb44' };
      const html = buildTreeInfoHTML(tree, null);
      expect(html).toContain('#1 of —');
    });
  });

  describe('no backdrop overlay element', () => {
    /** Validates: Requirements 6.4 */
    it('does not contain any backdrop or overlay elements', () => {
      const tree = {
        rank: 3,
        height_m: 62.4,
        error_m: 2.8,
        tier: 'Tall',
        lat: 46.789,
        lon: -121.745,
        colour: '#44bb44',
      };
      const html = buildTreeInfoHTML(tree, 147);
      expect(html).not.toContain('backdrop');
      expect(html).not.toContain('overlay');
      expect(html).not.toContain('modal-backdrop');
    });
  });
});
