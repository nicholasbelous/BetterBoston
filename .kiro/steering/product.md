# Product: ClimateCheck MA (working name, final name is [PROJECT_NAME])

A mobile-first web app that turns satellite and aerial imagery into a plain-English climate report for a Massachusetts home or block.

## Users

- Massachusetts **renters** and **homeowners**, most on a phone.
- Not GIS experts. Many have never read a satellite image. Assume no technical background.

## What the app does

1. The user types an address or taps "use my location."
2. The app shows the MassGIS 2025 aerial photo of the home and block.
3. Score cards:
   - **Heat**: how hot the block's ground surface got on one hot summer day, compared with the Boston average (Landsat thermal data).
   - **Green cover**: how green the block is (NDVI from the infrared band of the MassGIS 2025 aerial photos).
   - **Solar potential**: stretch goal only.
4. A personalized action plan in plain English, built **only** from the curated program data in `data/programs/`.
5. A renter/owner toggle changes the plan. Renters get cooling centers, alerts, tree requests, energy assessments, and community solar. Owners also get heat pumps and rooftop solar.

## Honesty rules (never break these)

- Scores are **relative comparisons**, not official assessments. Say so near the scores.
- Show the **data source and date** under every score.
- Heat is the **ground surface temperature on one summer day**, not air temperature. Say "the ground" or "streets and rooftops," never "the air."
- The MassGIS 2025 photos were taken in spring, before most trees had leaves. Call the score "green cover," not "tree canopy," and explain this on the About page.
- If an address is outside the processed demo area, show "coverage coming soon." **Never** show a made-up or estimated score.
- SAMPLE data is always labeled with a visible banner. Never present it as real.
- The AI must never invent programs, phone numbers, emails, websites, dollar amounts, dates, or eligibility rules. It may only cite programs from `data/programs/`.
- Programs with `last_verified: null` are hidden from users.
- Don't call a block "dangerous" or "safe." Describe what the numbers show.

## Writing style

- **8th-grade reading level.** Short sentences, everyday words, no jargon.
- Speak to the reader as "you."
- Calm and practical. Never alarmist.
- Numbers get units and context: "about 6°F hotter than the Boston average on June 25, 2024."

## Scope for the hackathon

- Demo area: 2-3 Boston neighborhoods with contrasting results (Chinatown, West Roxbury, East Boston).
- Statewide coverage is out of scope.
- Keep everything simple, working, and easy to demo. Don't over-engineer.
