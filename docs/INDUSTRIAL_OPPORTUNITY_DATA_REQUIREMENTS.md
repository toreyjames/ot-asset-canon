# Opportunity Tracker Data Requirements

## Purpose
This app already models OT assets and industrial infrastructure. The new Opportunity Tracker layer extends it to answer a different question: where public and private industrial investment is flowing, which facilities are real, and which geographies are heating up.

## Canonical Objects
- `entity_master`: companies, agencies, recipients, issuers, and providers keyed by durable identifiers such as `UEI`, `CIK`, `FRS`, and `EIA plant code`.
- `facility_master`: physical industrial sites stitched from source-authored IDs plus normalized address and geocode data.
- `source_records`: immutable raw records with `source_system`, `source_record_id`, fetch metadata, and payload provenance.
- `investment_events`: normalized dollar-bearing events across federal awards, state incentives, financing commitments, and corporate capex announcements.
- `permit_or_milestone_events`: non-dollar validation signals such as permitting milestones, EPA program activity, and FAST-41 status changes.
- `geo_dim`: stable county/CBSA/state rollups plus denominators for intensity metrics.
- `taxonomy_dim`: controlled vocab for NAICS and owned technology tags.
- `entity_resolution_decisions`: deterministic and probabilistic match history for auditability.

## Source Priorities
1. `USAspending.gov` for authoritative federal obligations and outlays.
2. `SAM.gov` and `Grants.gov` for entity spine plus forward-looking opportunities.
3. EPA facility, compliance, and permit systems for project-realization signals.
4. EIA plant and energy datasets for feasibility and infrastructure context.
5. SEC EDGAR for issuer corroboration and capex disclosure context.
6. Census / USITC / BTS / USACE for trade and logistics overlays.
7. Permitting Dashboard for major-project milestone visibility.
8. State incentive portals as state-specific normalized event feeds.

## Design Rules
- Preserve raw source payloads. Canonical projections never replace source-native data.
- Separate `amount_type` values such as `obligation`, `outlay`, and `commitment`.
- Resolve geography through canonical `geo_dim` keys so county, CBSA, and state rollups stay consistent.
- Treat permits and milestone signals as validation events, not substitute dollar events.
- Store match decisions and confidence so entity/facility stitching remains explainable.

## Initial API Surface
- `GET /api/industrial-opportunity-tracker`
  - Returns tracker identity, namespace, and supported endpoints.
- `GET /api/industrial-opportunity-tracker/sources`
  - Returns the prioritized source catalog and intended source-of-truth usage.
- `GET /api/industrial-opportunity-tracker/demo`
  - Returns a demo snapshot for Industrial Tracker and Opportunity Tracker UI development before live ingest exists.
- `POST /api/industrial-opportunity-tracker/summary`
  - Accepts time, geography, NAICS, amount-type, event-type, and tech-tag filters.
  - Returns county/CBSA/state summary rows suitable for choropleths, rankings, and watchlists.
- `POST /api/opportunities/summary`
  - Compatibility alias only. New work should target the Opportunity Tracker namespace inside Industrial Tracker.

## Current Implementation Footprint
The first pass is now represented in:
- `drizzle/0000_lean_la_nuit.sql`
- `src/db/schema.ts`
- `src/lib/industrial-opportunity-tracker/source-catalog.ts`
- `src/lib/industrial-opportunity-tracker/summary-schema.ts`
- `src/lib/industrial-tracker/opportunity-types.ts`
- `src/lib/industrial-tracker/opportunity-query.ts`
- `src/lib/industrial-tracker/demo-data.ts`
- `src/lib/industrial-tracker/dashboard.ts`
- `src/app/api/industrial-opportunity-tracker/route.ts`
- `src/app/api/industrial-opportunity-tracker/demo/route.ts`
- `src/app/api/industrial-opportunity-tracker/sources/route.ts`
- `src/app/api/industrial-opportunity-tracker/summary/route.ts`
- `src/app/api/opportunities/summary/route.ts`
- `scripts/seed-industrial-tracker.mjs`
- `scripts/ingest-industrial-tracker.mjs`
- `scripts/lib/industrial-tracker-ingestion/common.mjs`
- `scripts/lib/industrial-tracker-ingestion/usaspending.mjs`
- `scripts/lib/industrial-tracker-ingestion/epa-frs.mjs`
- `scripts/lib/industrial-tracker-ingestion/epa-echo.mjs`
- `scripts/lib/industrial-tracker-ingestion/sec-filings.mjs`
- `scripts/lib/industrial-tracker-ingestion/project-feed.mjs`
- `scripts/lib/industrial-tracker-ingestion/private-capital-feed.mjs`
- `scripts/lib/industrial-tracker-ingestion/texas-governor-projects.mjs`
- `scripts/lib/industrial-tracker-ingestion/michigan-medc-projects.mjs`
- `scripts/lib/industrial-tracker-ingestion/arizona-commerce-projects.mjs`
- `scripts/lib/industrial-tracker-ingestion/ohio-jobs-projects.mjs`
- `scripts/lib/industrial-tracker-ingestion/georgia-governor-projects.mjs`
- `scripts/lib/industrial-tracker-ingestion/virginia-vedp-projects.mjs`
- `scripts/lib/industrial-tracker-ingestion/indiana-iedc-projects.mjs`
- `data/industrial-tracker-project-feed.example.json`

## Bootstrap Commands
- `npm run db:generate`
- `npm run db:push`
- `npm run db:seed:industrial-tracker`
- `npm run ingest:industrial-tracker`
- `npm run import:industrial-tracker-cbsa`
- `npm run enrich:industrial-tracker-eia-geo`
- `npm run repair:industrial-tracker-geo`

## Scheduled Production Ingest
- Protected endpoint:
  - `GET|POST /api/industrial-opportunity-tracker/ingest`
- Auth:
  - `Authorization: Bearer $CRON_SECRET`
  - Optional fallback: `?token=$CRON_SECRET`
- Optional source selection:
  - `/api/industrial-opportunity-tracker/ingest?sources=usaspending,epa-frs,epa-echo`
- `vercel.json` schedules recurring source groups for:
  - federal + permit + structured capital sources
  - energy + queue infrastructure sources
  - SEC issuer/disclosure sources

## Real Input Channels
- `USAspending.gov`
  - Federal awards, obligations, and commitments already live.
- `EPA FRS`
  - Facility registry and program-link grounding already live.
- `EPA ECHO`
  - Permit/compliance observations already live.
- `EIA electricity`
  - Plant-level generation and capacity context can now be ingested with `EIA_ELECTRICITY_URL` and optional `EIA_API_KEY`.
  - Official plant metadata can be enriched from `EIA_860_URL` with `npm run enrich:industrial-tracker-eia-geo` to recover county, CBSA, and plant coordinates.
- `Queued Up interconnection queue`
  - Utility/interconnection-side queue signals can now be ingested with `INTERCONNECTION_QUEUE_URL`, `INTERCONNECTION_QUEUE_LIMIT`, and `INTERCONNECTION_QUEUE_MIN_MW`.
- `Census CBSA delineations`
  - County-to-metro coverage can be refreshed with `CBSA_DELINEATION_URL`, `npm run import:industrial-tracker-cbsa`, and `npm run repair:industrial-tracker-geo`.
- `SEC EDGAR`
  - Public-company filing evidence can now be ingested with `SEC_TRACKER_CIKS` and optional `SEC_FILING_LIMIT`.
- `Structured project feed`
  - State incentives, private capex, local projects, and bespoke deal records can now be ingested through `INDUSTRIAL_TRACKER_PROJECT_FEED`.
  - `INDUSTRIAL_TRACKER_PROJECT_FEED` supports a comma-separated list of JSON files or URLs.
  - Example payloads:
    - `data/industrial-tracker-state-incentives.example.json`
    - `data/industrial-tracker-private-capex.example.json`
- `Private capital feed`
  - Dedicated private capital announcements (venture rounds, facility capex, real estate plays) live under `INDUSTRIAL_TRACKER_PRIVATE_CAPITAL` so they can be refreshed on their own cadence.
  - The env var accepts a comma-separated list of JSON files or URLs that match the structured project feed schema.
  - Example payloads:
    - `data/industrial-tracker-private-capex.example.json`
    - `data/industrial-tracker-private-capital-market-feed.example.json`
    - `data/industrial-tracker-private-infrastructure-financing.example.json`
    - `data/industrial-tracker-private-manufacturing-equity-debt.example.json`
    - `data/industrial-tracker-private-transmission-financing.example.json`
    - `data/industrial-tracker-private-water-thermal-financing.example.json`
    - `data/industrial-tracker-private-onsite-power-financing.example.json`
    - `data/industrial-tracker-private-industrial-real-estate-financing.example.json`
    - `data/industrial-tracker-private-fuel-logistics-financing.example.json`
    - `data/industrial-tracker-private-rail-logistics-financing.example.json`
    - `data/industrial-tracker-private-circular-industry-financing.example.json`
    - `data/industrial-tracker-private-grid-resilience-financing.example.json`
    - `data/industrial-tracker-private-industrial-comms-financing.example.json`
    - `data/industrial-tracker-private-industrial-steam-financing.example.json`
    - `data/industrial-tracker-private-heavy-equipment-financing.example.json`
    - `data/industrial-tracker-private-waste-heat-recovery-financing.example.json`
    - `data/industrial-tracker-private-industrial-water-rights-financing.example.json`
    - `data/industrial-tracker-private-industrial-cyber-financing.example.json`
    - `data/industrial-tracker-private-industrial-air-separation-financing.example.json`
    - `data/industrial-tracker-private-cooling-infrastructure-financing.example.json`
    - `data/industrial-tracker-private-materials-handling-financing.example.json`
    - `data/industrial-tracker-private-compressed-air-financing.example.json`
    - `data/industrial-tracker-private-industrial-byproduct-logistics-financing.example.json`
- `data/industrial-tracker-ai-loads.example.json`
- `data/industrial-tracker-ai-support.example.json`
- `data/industrial-tracker-ai-grid.example.json`
- `data/industrial-tracker-ai-water.example.json`
- `data/industrial-tracker-nuclear-builds.example.json`
- `data/industrial-tracker-semiconductors.example.json`
- `Texas Strategic Projects`
  - Official Governor announcement pages for TSIF, TEF, JETI, and related manufacturing expansions can now be ingested through `TEXAS_PROJECT_URLS`.
- `Michigan Strategic Projects`
  - Official MEDC project and investment announcements can now be ingested through `MICHIGAN_PROJECT_URLS`.
- `Arizona Strategic Projects`
  - Official Arizona Commerce Authority announcements can now be ingested through `ARIZONA_PROJECT_URLS`.
- `Arkansas Strategic Projects`
  - Official Arkansas Economic Development Commission newsroom project announcements can now be ingested through `ARKANSAS_PROJECT_URLS`.
- `Ohio Strategic Projects`
  - Official JobsOhio strategic project announcements can now be ingested through `OHIO_PROJECT_URLS`.
- `Georgia Strategic Projects`
  - Official Georgia governor strategic project announcements can now be ingested through `GEORGIA_PROJECT_URLS`.
- `North Carolina Strategic Projects`
  - Official North Carolina Commerce strategic project announcements can now be ingested through `NORTH_CAROLINA_PROJECT_URLS`.
- `Tennessee Strategic Projects`
  - Official Tennessee ECD strategic project announcements can now be ingested through `TENNESSEE_PROJECT_URLS`.
- `South Carolina Strategic Projects`
  - Official South Carolina Commerce strategic project announcements can now be ingested through `SOUTH_CAROLINA_PROJECT_URLS`.
- `Kentucky Strategic Projects`
  - Official Kentucky economic development article feed announcements can now be ingested through `KENTUCKY_CED_FEED_URL`.
- `Virginia Strategic Projects`
  - Official VEDP strategic project announcements can now be ingested through `VIRGINIA_PROJECT_URLS`.
- `Indiana Strategic Projects`
  - Official IEDC strategic project announcements can now be ingested through `INDIANA_PROJECT_URLS`.
- `Alabama Strategic Projects`
  - Official Made in Alabama strategic project announcements can now be ingested through `ALABAMA_PROJECT_URLS`.
- `Louisiana Strategic Projects`
  - Official Louisiana Economic Development strategic project announcements can now be ingested through `LOUISIANA_PROJECT_URLS`.
- `Mississippi Strategic Projects`
  - Official Mississippi Development Authority strategic project announcements can now be ingested through `MISSISSIPPI_PROJECT_URLS`.
- `Illinois Strategic Projects`
  - Official Illinois Economic Development Corporation strategic project announcements can now be ingested through `ILLINOIS_PROJECT_URLS`.
- `Missouri Strategic Projects`
  - Official Missouri Department of Economic Development strategic project announcements can now be ingested through `MISSOURI_PROJECT_URLS`.
- `Kansas Strategic Projects`
  - Official Kansas Department of Commerce strategic project announcements can now be ingested through `KANSAS_PROJECT_URLS`.
- `Oklahoma Strategic Projects`
  - Official Oklahoma Department of Commerce strategic project announcements can now be ingested through `OKLAHOMA_PROJECT_URLS`.
- `West Virginia Strategic Projects`
  - Official West Virginia Division of Economic Development strategic project announcements can now be ingested through `WEST_VIRGINIA_PROJECT_URLS`.
- `Iowa Strategic Projects`
  - Official Iowa Economic Development Authority board-approved strategic project announcements can now be ingested through `IOWA_PROJECT_URLS`.
- `New Jersey Strategic Projects`
  - Official NJEDA strategic project announcements can now be ingested through `NEW_JERSEY_PROJECT_URLS`.
- `New Mexico Strategic Projects`
  - Official New Mexico Economic Development Department strategic project announcements can now be ingested through `NEW_MEXICO_PROJECT_URLS`.
- `Nevada Strategic Projects`
  - Official Nevada governor / GOED strategic project announcements can now be ingested through `NEVADA_PROJECT_URLS`.
- `Utah Strategic Projects`
  - Official Utah Governor's Office of Economic Opportunity tax-credit strategic project announcements can now be ingested through `UTAH_PROJECT_URLS`.
- `Idaho Strategic Projects`
  - Official Idaho Commerce strategic project announcements can now be ingested through `IDAHO_PROJECT_URLS`.
- `Nebraska Strategic Projects`
  - Official Nebraska Department of Economic Development strategic project announcements can now be ingested through `NEBRASKA_PROJECT_URLS`.
- `California Strategic Projects`
  - Official California GO-Biz strategic project announcements can now be ingested through `CALIFORNIA_PROJECT_URLS`.
- `Florida Strategic Projects`
  - Official Florida strategic project announcements can now be ingested through `FLORIDA_PROJECT_URLS`.
- `Colorado Strategic Projects`
  - Official Colorado strategic project announcements can now be ingested through `COLORADO_PROJECT_URLS`.
- `Washington Strategic Projects`
  - Official Washington Commerce strategic project announcements can now be ingested through `WASHINGTON_PROJECT_URLS`.
- `Oregon Strategic Projects`
  - Official Business Oregon newsroom project announcements can now be ingested through `OREGON_PROJECT_URLS`.
- `data/industrial-tracker-advanced-manufacturing.example.json`

## Current Live Ingestion Status
- `USAspending.gov` is now ingesting into the shared Baseload evidence graph with deterministic upserts into `source_records`, `investment_events`, `evidence_records`, and `entity_resolution_decisions`.
- EPA `FRS` now ingests from the official `frs_downloads.zip` facility/program-link export and lands facility-centered evidence into `facility_master`, `evidence_records`, `derived_signals`, and `facility_events`.
- EPA `ECHO` now ingests from the official `echo_exporter.zip` file and lands permit/compliance observations into `permit_or_milestone_events`, `evidence_records`, `derived_signals`, and `facility_events`.
- The ingestion runner is resilient to per-source failures so one bad upstream source does not block healthy sources from landing.

## Next Build Steps
- Build source-specific ingestion jobs for SAM and additional state/export feeds.
- Replace dashboard snapshot lanes and watchlists with DB-backed analytics.
- Add UI views for county choropleths, CBSA rankings, and stage-weighted dollars.
