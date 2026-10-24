# Requirements: ClimateCheck MA MVP

## Introduction

A mobile-first web app that gives Massachusetts renters and homeowners a plain-English climate report for their block. The report has a heat score from Landsat surface temperature, a green cover score from MassGIS 2025 aerial imagery, and an action plan built only from curated, verified Massachusetts programs. The demo covers 2-3 Boston neighborhoods.

## Requirements

### Requirement 1: Find my block

**User story:** As a resident, I want to enter my address or use my location, so that I can see a report for my block.

#### Acceptance criteria

1. WHEN the user submits an address THEN the system SHALL geocode it server-side and open the report for the matched location.
2. WHEN the address has no state or ZIP code THEN the system SHALL search within Massachusetts.
3. WHEN the US Census geocoder finds no match or fails THEN the system SHALL try Nominatim before giving up.
4. WHEN no geocoder finds the address THEN the system SHALL show "We couldn't find that address" with a hint to add the street number and city.
5. WHEN the user taps "use my location" and grants permission THEN the system SHALL use the device coordinates.
6. WHEN location permission is denied THEN the system SHALL show a friendly message and keep the address box available.
7. The geocode endpoint SHALL reject empty queries and queries longer than 200 characters.

### Requirement 2: See my block from above

**User story:** As a resident, I want to see the aerial photo of my home and block, so that I know the report is about my place.

#### Acceptance criteria

1. The report SHALL show a map with the MassGIS 2025 aerial imagery basemap, from `NEXT_PUBLIC_BASEMAP_TILE_URL`.
2. The map SHALL mark the address and outline the score cell.
3. The map SHALL credit the imagery source.
4. The aerial photo SHALL show for any Massachusetts address, including addresses outside the scored area. WHEN the photo service has no tile for the address (outside Massachusetts), THEN the report SHALL show no photo frame.

### Requirement 3: Heat score

**User story:** As a resident, I want to know how hot my block's ground gets compared with the rest of Boston, so that I understand my heat risk.

#### Acceptance criteria

1. The heat card SHALL show `heat_score` (0-100, higher = hotter) and the °F difference from the Boston average.
2. The heat card SHALL say it is the ground surface temperature on one summer day, not air temperature.
3. The heat card SHALL show the source (USGS Landsat) and the scene date.
4. WHEN `heat_score` is null THEN the card SHALL say there was not enough clear data.

### Requirement 4: Green cover score

**User story:** As a resident, I want to know how green my block is, so that I know whether more trees would help.

#### Acceptance criteria

1. The green cover card SHALL show `tree_score` (0-100, higher = greener) and `pct_vegetated`.
2. The card SHALL say the photos were taken in spring 2025, before most trees had leaves.
3. The card SHALL show the source (MassGIS 2025 aerial imagery) and the photo dates.
4. WHEN `tree_score` is null THEN the card SHALL say there was not enough clear data.

### Requirement 5: Honest coverage

**User story:** As a resident outside the demo area, I want a clear answer, so that I'm not misled.

#### Acceptance criteria

1. WHEN the location is not inside any processed cell THEN the system SHALL show "coverage coming soon" and list the covered neighborhoods, with no scores.
2. WHEN the score metadata has `is_sample: true` THEN every page with scores SHALL show a visible SAMPLE DATA banner.
3. The app SHALL NOT compute, estimate, or adjust any score. Scores come only from `data/scores/`.

### Requirement 6: Action plan

**User story:** As a resident, I want a short, personal action plan, so that I know what to do next.

#### Acceptance criteria

1. The plan SHALL have a 2-3 sentence summary and 3-5 actions, each with a title, a "why this matters for your block" line, and a link.
2. Every action SHALL cite a program `id` from `data/programs/`. Actions with unknown or repeated ids SHALL be dropped.
3. Links SHALL come from the program record, never from model output.
4. WHEN the model output contains a phone number, dollar amount, email, or URL that is not in the program data THEN the system SHALL reject it and use the rule-based plan.
5. WHEN there is no API key, the Claude call fails, or fewer than 3 valid actions remain THEN the system SHALL return the rule-based plan, marked `source: "rules"`.
6. The plan SHALL be written at an 8th-grade reading level.
7. Programs with `last_verified: null` SHALL NOT be shown or sent to the model, except in local development with `ALLOW_UNVERIFIED_PROGRAMS=true`.
8. The client SHALL send only `cell_id` and `tenure`. The server SHALL look up the scores itself.

### Requirement 7: Renter or owner

**User story:** As a renter or owner, I want the plan to fit my situation, so that I only see things I can do.

#### Acceptance criteria

1. The report SHALL have a renter/owner toggle, defaulting to renter.
2. WHEN tenure is renter THEN the plan SHALL use only programs whose audience includes renters (cooling centers, alerts, tree requests, energy assessments, community solar).
3. WHEN tenure is owner THEN the plan MAY also include owner-only programs (heat pumps, rooftop solar).
4. Switching the toggle SHALL request a new plan. Repeat requests for the same cell and tenure SHALL be served from cache.

### Requirement 8: Data sources page

**User story:** As a curious resident or judge, I want to see where the data comes from, so that I can trust it.

#### Acceptance criteria

1. The About page SHALL list each data source with a link, the scene and photo dates, and the thresholds, read from `demo_grid.meta.json`.
2. The About page SHALL explain the limits: surface vs. air temperature, one summer day, leaf-off imagery, and demo area only.

### Requirement 9 (stretch): Solar potential

**User story:** As an owner, I want to know if my roof is good for solar.

#### Acceptance criteria

1. WHEN `GOOGLE_SOLAR_API_KEY` is set THEN the report MAY show a solar card from the Google Solar API, called server-side.
2. WHEN the key is missing THEN no solar card SHALL be shown.
