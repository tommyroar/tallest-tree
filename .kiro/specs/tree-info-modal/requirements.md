# Requirements Document

## Introduction

When a user clicks a tree (in the forest profile SVG or on a map marker), the app currently jumps straight into the ground truth measurement modal. This feature introduces an intermediate Tree Info Panel anchored to the tree's position on the map, displaying key tree details at a glance with an explicit button to optionally launch ground truth mode. The map automatically flies to the selected tree, and the panel stays visually connected to the tree's marker. The goal is to let users inspect tree data without committing to the measurement workflow.

## Glossary

- **Tree_Info_Panel**: A panel anchored to a tree's Map_Marker on the map (not a centered modal) that displays summary information about a selected tree (height, tier, coordinates, rank) and provides navigation to ground truth mode.
- **Ground_Truth_Modal**: The existing modal (`#gt-modal`) containing navigation, rangefinder, and survival measurement tools for verifying satellite-estimated tree heights in the field.
- **Forest_Profile**: The SVG silhouette visualization in the sidebar showing detected trees arranged by compass bearing.
- **Map_Marker**: A Leaflet `circleMarker` on the map representing a detected tree.
- **Tree**: A detected canopy peak returned by `/api/analyze`, containing rank, height_m, error_m, lat, lon, tier, and colour.
- **Tier**: A classification label (Global, National, Regional, Tall, Common) based on tree height thresholds.
- **Anchor_Point**: The pixel position of the selected tree's Map_Marker on the map, to which the Tree_Info_Panel is visually connected.

## Wireframe

The panel is anchored to the tree's map marker, not centered on screen. The map auto-flies to the tree when opened.

```
                    ┌─────────────────────────────────┐
                    │  #3 — 62.4 m                ✕   │  ← rank, height, close
                    │  Tall                            │  ← tier badge (colored)
                    ├─────────────────────────────────┤
                    │                                  │
                    │  Height      62.4 m  ±2.8 m     │
                    │  Tier        Tall                │
                    │  Rank        #3 of 147           │
                    │  Coords      46.789, -121.745    │
                    │                                  │
                    ├─────────────────────────────────┤
                    │                                  │
                    │  ┌───────────────────────────┐   │
                    │  │  📐 Launch Ground Truth   │   │  ← green accent button
                    │  └───────────────────────────┘   │
                    │                                  │
                    │  ┌───────────────────────────┐   │  ← HIDDEN by default,
                    │  │  📍 Fly Back to Tree      │   │     appears only after
                    │  └───────────────────────────┘   │     scrolling away
                    │                                  │
                    └────────────┬────────────────────┘
                                 │  ← anchor stem
                                 ▼
                              (marker)
```

### Wireframe Notes

- The panel is anchored to the tree's Map_Marker via a stem/pointer, like a Leaflet popup but custom-styled.
- No minimap — the panel sits on the actual map next to the tree.
- The map auto-flies to the tree when the panel opens, so "Fly to Tree" is hidden initially.
- "Fly Back to Tree" only appears after the user pans/scrolls the map away from the tree's position.
- No backdrop overlay — the map remains interactive behind the panel.
- Dark theme: `#11131a` background, `#1e2230` borders.
- Width: `280px` (slightly narrower than GT modal since it's anchored, not centered).
- Font: JetBrains Mono for data values, DM Sans for header.

## Requirements

### Requirement 1: Display Tree Info Panel on Tree Selection

**User Story:** As a user, I want to see tree details when I click a tree, so that I can inspect a tree's data without entering ground truth mode.

#### Acceptance Criteria

1. WHEN a user clicks a tree silhouette in the Forest_Profile, THE Tree_Info_Panel SHALL open anchored to that tree's Map_Marker on the map.
2. WHEN a user clicks a Map_Marker on the map, THE Tree_Info_Panel SHALL open anchored to that marker.
3. WHEN the Tree_Info_Panel opens, THE Map SHALL fly to center the selected tree's coordinates in view.
4. THE Tree_Info_Panel SHALL display the tree's rank, height (with unit preference), error margin, tier, and coordinates.
5. THE Tree_Info_Panel SHALL display the tree's tier label colored with the tier's assigned colour.
6. THE Tree_Info_Panel SHALL display the tree's rank relative to the total number of trees in the current analysis (e.g. "#3 of 147").
7. THE Tree_Info_Panel SHALL be visually anchored to the tree's Map_Marker with a stem/pointer, similar to a Leaflet popup.

### Requirement 2: Close Tree Info Panel

**User Story:** As a user, I want to dismiss the tree info panel easily, so that I can return to browsing the map.

#### Acceptance Criteria

1. WHEN the user clicks the close button (✕) in the Tree_Info_Panel header, THE Tree_Info_Panel SHALL close.
2. WHEN the user clicks elsewhere on the map (not on the panel or another marker), THE Tree_Info_Panel SHALL close.
3. WHEN the user presses the Escape key while the Tree_Info_Panel is open, THE Tree_Info_Panel SHALL close.

### Requirement 3: Conditional Fly Back to Tree

**User Story:** As a user, I want a way to re-center the map on the selected tree after scrolling away, so that I can find it again without closing and reopening the panel.

#### Acceptance Criteria

1. WHEN the Tree_Info_Panel first opens, THE "Fly Back to Tree" button SHALL be hidden.
2. WHEN the user pans or zooms the map such that the tree's Anchor_Point is no longer visible in the viewport, THE "Fly Back to Tree" button SHALL appear in the Tree_Info_Panel.
3. WHEN the user clicks the "Fly Back to Tree" button, THE Map SHALL fly to re-center on the selected tree's coordinates.
4. WHEN the map finishes flying back to the tree, THE "Fly Back to Tree" button SHALL hide again.

### Requirement 4: Launch Ground Truth Mode from Info Panel

**User Story:** As a user, I want to launch ground truth mode from the tree info panel, so that I can measure the tree after reviewing its details.

#### Acceptance Criteria

1. THE Tree_Info_Panel SHALL display a "Launch Ground Truth Mode" button styled with the green accent colour (`#3d8b40`).
2. WHEN the user clicks the "Launch Ground Truth Mode" button, THE Tree_Info_Panel SHALL close and THE Ground_Truth_Modal SHALL open for the same tree.
3. THE Ground_Truth_Modal SHALL retain all existing functionality (navigation, rangefinder, survival measurement) when launched from the Tree_Info_Panel.

### Requirement 5: Decouple Tree Selection from Ground Truth Mode

**User Story:** As a user, I want clicking a tree to show info instead of immediately launching measurement mode, so that I can browse trees without triggering the full measurement workflow.

#### Acceptance Criteria

1. WHEN a tree is selected via the Forest_Profile or Map_Marker, THE application SHALL open the Tree_Info_Panel instead of the Ground_Truth_Modal.
2. THE Ground_Truth_Modal SHALL only open when explicitly triggered by the "Launch Ground Truth Mode" button in the Tree_Info_Panel.

### Requirement 6: Visual Consistency

**User Story:** As a user, I want the tree info panel to match the app's existing visual style, so that the experience feels cohesive.

#### Acceptance Criteria

1. THE Tree_Info_Panel SHALL use the application's dark theme: `#11131a` background, `#1e2230` borders, `12px` border-radius.
2. THE Tree_Info_Panel SHALL use JetBrains Mono for data values and DM Sans for heading text.
3. THE Tree_Info_Panel SHALL have a width of `280px`.
4. THE Tree_Info_Panel SHALL NOT use a backdrop overlay — the map remains fully interactive behind the panel.

### Requirement 7: Unit Preference Respect

**User Story:** As a user, I want the tree info panel to show heights in my chosen unit, so that the data is consistent with the rest of the app.

#### Acceptance Criteria

1. WHILE the unit preference is set to feet, THE Tree_Info_Panel SHALL display all height values converted to feet.
2. WHILE the unit preference is set to metres, THE Tree_Info_Panel SHALL display all height values in metres.
3. WHEN the user changes the unit preference while the Tree_Info_Panel is open, THE Tree_Info_Panel SHALL update displayed height values to reflect the new unit.

### Requirement 8: Keyboard Accessibility

**User Story:** As a user, I want to navigate the tree info panel with a keyboard, so that the panel is accessible without a mouse.

#### Acceptance Criteria

1. WHEN the Tree_Info_Panel opens, THE close button SHALL receive keyboard focus.
2. THE user SHALL be able to Tab between the close button, "Launch Ground Truth Mode" button, and "Fly Back to Tree" button (when visible).
3. WHEN the user presses Escape, THE Tree_Info_Panel SHALL close.
