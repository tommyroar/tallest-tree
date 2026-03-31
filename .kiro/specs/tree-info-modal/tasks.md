# Implementation Plan: Tree Info Panel

## Overview

Replace the direct-to-ground-truth flow with an intermediate Leaflet popup-based info panel. All changes are in `index.html` (CSS + JS). Tests use vitest+jsdom for unit/property tests and Playwright for E2E. The pure function `buildTreeInfoHTML` is extracted for testability, and `highlightTree` is rewired to open the popup instead of the GT modal.

## Tasks

- [x] 1. Add CSS styles for the tree info popup
  - Add `.tree-info-popup` styles to the `<style>` block in `index.html`: dark theme (`#11131a` bg, `#1e2230` borders, `12px` border-radius), `280px` width, JetBrains Mono for data values, DM Sans for header
  - Style the tier badge, data rows, GT launch button (`#3d8b40` accent), and fly-back button (hidden by default)
  - Override Leaflet's default popup chrome (`.leaflet-popup-content-wrapper`, `.leaflet-popup-tip`) to match dark theme
  - Ensure no backdrop overlay — popup sits on the interactive map
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 1.7_

- [x] 2. Implement core popup functions
  - [x] 2.1 Implement `buildTreeInfoHTML(tree, totalCount)` pure function
    - Returns HTML string with: header (rank + height), tier badge (colored with `tree.colour`), data rows (height ± error, tier, rank "#N of M", lat/lon coords), "Launch Ground Truth Mode" button, "Fly Back to Tree" button (hidden by default via `display:none`)
    - Use fallback values for missing fields: `"—"` for numbers, `"Unknown"` for tier
    - Format height using `fmtH` / `fmtH1` respecting current unit preference
    - _Requirements: 1.4, 1.5, 1.6, 4.1, 7.1, 7.2_

  - [x] 2.2 Write property test: Panel content completeness (Property 1)
    - **Property 1: Panel content completeness**
    - Install `fast-check` as a dev dependency
    - In `tests/tree-info-popup.test.js`, generate random tree objects (rank 1–500, height 2.0–120.0, error 0.1–10.0, random tier from TIERS, random lat/lon in PNW bounds, random hex colour) and random total counts
    - Assert `buildTreeInfoHTML` output contains: `#rank of total`, formatted height, error value, tier label, tier colour in inline style, lat/lon coords, GT button with `#3d8b40`
    - Minimum 100 iterations
    - Tag: `Feature: tree-info-modal, Property 1: Panel content completeness`
    - **Validates: Requirements 1.4, 1.5, 1.6, 4.1**

  - [x] 2.3 Write property test: Unit conversion correctness (Property 2)
    - **Property 2: Unit conversion correctness**
    - Generate random height values (0.1–200.0) and random unit preference (boolean for metres/feet)
    - Assert formatted output matches: original value when metres, value × 3.28084 when feet, both rounded to 1 decimal with correct suffix
    - Minimum 100 iterations
    - Tag: `Feature: tree-info-modal, Property 2: Unit conversion correctness`
    - **Validates: Requirements 7.1, 7.2**

  - [x] 2.4 Implement `openTreeInfoPopup(tree)`
    - Close any existing popup via `closeTreeInfoPopup()`
    - Early return if `window._lastData` is null
    - Create `L.popup` with `className: 'tree-info-popup'`, `maxWidth: 280`, `minWidth: 280`, `closeButton: true`, `autoPan: true`
    - Set content from `buildTreeInfoHTML(tree, window._lastData.stats.n_trees)` and open at `[tree.lat, tree.lon]`
    - Fly map to tree coordinates
    - Set focus on close button for keyboard accessibility
    - Store references in `window._treeInfoPopup` and `window._treeInfoTree`
    - Wire "Launch Ground Truth Mode" button click: close popup, call `openGtModal(tree)`
    - Wire "Fly Back to Tree" button click: call `map.flyTo([tree.lat, tree.lon], 16)`
    - Register `moveend` listener for fly-back visibility via `updateFlyBackVisibility()`
    - _Requirements: 1.1, 1.2, 1.3, 1.7, 4.2, 8.1_

  - [x] 2.5 Implement `closeTreeInfoPopup()`
    - Remove popup from map, clean up `window._treeInfoPopup` and `window._treeInfoTree`
    - Remove `moveend` listener for fly-back visibility
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.6 Implement `updateFlyBackVisibility()`
    - Check if tree's latlng is within current map viewport bounds
    - Show fly-back button if tree is outside viewport, hide if inside
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 2.7 Write property test: Fly-back button visibility tracks viewport (Property 3)
    - **Property 3: Fly-back button visibility tracks viewport**
    - Generate random tree latlng and random viewport bounds
    - Assert visibility equals `!bounds.contains(latlng)`
    - Minimum 100 iterations
    - Tag: `Feature: tree-info-modal, Property 3: Fly-back button visibility tracks viewport`
    - **Validates: Requirements 3.1, 3.2, 3.4**

- [x] 3. Wire popup into existing code
  - [x] 3.1 Modify `highlightTree(tree)` to call `openTreeInfoPopup(tree)` instead of `openGtModal(tree)`
    - Retain the existing marker flash animation
    - _Requirements: 5.1, 5.2, 1.1, 1.2_

  - [x] 3.2 Extend `refreshUnits()` to update popup content when open
    - If `window._treeInfoPopup` is active, rebuild and set content via `buildTreeInfoHTML`
    - _Requirements: 7.3_

  - [x] 3.3 Extend Escape key handler
    - If a tree info popup is open, close it; otherwise close GT modal as before
    - _Requirements: 2.3, 8.3_

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Write unit tests for popup behavior
  - [x] 5.1 Write unit tests for `buildTreeInfoHTML`
    - Test correct HTML output for a known tree object (example)
    - Test fallback values for missing fields
    - Test no backdrop overlay element is added
    - _Requirements: 1.4, 1.5, 1.6, 6.4_

  - [ ] 5.2 Write unit tests for popup open/close behavior
    - Test close button click removes popup
    - Test Escape key closes popup
    - Test "Launch Ground Truth Mode" button closes popup and opens GT modal
    - Test tree selection opens info panel, NOT GT modal
    - _Requirements: 2.1, 2.3, 4.2, 5.1, 5.2_

  - [ ] 5.3 Write unit tests for fly-back button
    - Test fly-back button is hidden on initial open
    - Test fly-back button click triggers `map.flyTo`
    - _Requirements: 3.1, 3.3_

  - [ ] 5.4 Write unit tests for keyboard accessibility
    - Test close button receives focus on popup open
    - Test tab order includes close, GT button, and fly-back button
    - _Requirements: 8.1, 8.2_

  - [ ] 5.5 Write unit test for unit change while popup is open
    - Test that `refreshUnits` updates popup content
    - _Requirements: 7.3_

- [ ] 6. Write E2E tests with Playwright
  - [ ] 6.1 Write E2E tests in `tests/test_tree_info.js`
    - Click a tree silhouette in the forest profile → verify popup appears on map
    - Click a map marker → verify popup appears
    - Click "Launch Ground Truth Mode" → verify GT modal opens
    - Verify no backdrop overlay is present when popup is open
    - _Requirements: 1.1, 1.2, 4.2, 6.4_

- [ ] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code changes are in `index.html` — no new source files needed
- Test files: `tests/tree-info-popup.test.js` (vitest), `tests/test_tree_info.js` (Playwright E2E)
