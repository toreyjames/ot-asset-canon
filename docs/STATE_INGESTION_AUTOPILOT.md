# State Ingestion Autopilot

This workflow keeps the Industrial Tracker harvesting the design/state-specific project sources one state at a time so we can continue rolling through every state without manual juggling.

## How it works

- `scripts/auto-state-ingest.mjs` (hooked from `npm run ingest:industrial-tracker:states`) iterates over every state-specific source implemented under `scripts/lib/industrial-tracker-ingestion`.  
- Each iteration sets `INDUSTRIAL_TRACKER_SOURCES=<state-source-key>` and runs `npm run ingest:industrial-tracker`, so the bulk run only contains the state we are trying to catch up on.  
- Progress is persisted to `data/state-ingestion-progress.json` and the run log is appended to `data/state-ingestion.log`, letting you resume or inspect which states still need to be rerun.

## Running

```bash
cd ot-asset-canon
npm run ingest:industrial-tracker:states
```

The script loads configuration from `.env.local`, so the Supabase + EIA keys you already have will flow through automatically.

## Configuration knobs

| Environment Variable | Purpose |
| --- | --- |
| `STATE_INGEST_FORCE_STATES` | Comma-separated source keys to rerun even if marked successful in the progress file. |
| `STATE_INGEST_ONLY_STATES` | Limit the run to just these state keys (skipping the rest). |
| `STATE_INGEST_SKIP_STATES` | Explicitly skip the listed state keys. |
| `STATE_INGEST_FORCE_ALL=1` | Ignore the progress file and rerun every configured state. |
| `STATE_INGEST_CONTINUE_ON_ERROR=0` | Fail-fast on the first state that errors instead of continuing. Leaving it unset keeps going. |

Source keys match the ingestion script names (e.g., `alabama-commerce-projects`, `texas-governor-projects`, etc.). For ease of reference, the auto script also prints a summary of each source’s latest status after the run.
