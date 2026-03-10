# PlantTrace WIGGUM Runbook

## Purpose
Iterative product refinement from multiple customer angles, with each pass answering:
1. What did we improve?
2. What still blocks value?
3. What should be fixed next?

## Current State (March 10, 2026)
- Demo flow: homepage -> inventory demo launcher -> guided run -> live map/list.
- Inventory UI now prioritizes:
  - What assets we have
  - Unified asset list
  - Missing critical items
  - Evidence-driven data requests
- Live filtering available:
  - Search (tag/name/type/area)
  - All / Networked / Non-networked
- Knowledge graph link available via `/explorer`.

## North-Star Questions
- How many assets do we have?
- What is missing that prevents reliable operation?
- How do we know that?
- What data is required next, and from which unit/layer?

## Persona Passes
Run these in order every iteration.

### Pass 1: Plant Manager
- Validate clarity of top-level KPIs and action list.
- Ensure "what to do next" is obvious in first 10 seconds.
- Remove jargon that does not affect a decision.

### Pass 2: OT Engineer
- Validate asset list utility (sort/filter/export potential).
- Validate networked/non-networked filtering behavior.
- Confirm map and list stay synchronized.

### Pass 3: Controls/Process Engineer
- Validate missing-critical logic and wording.
- Ensure each critical gap has a concrete data request.
- Confirm layer/unit ownership is obvious.

### Pass 4: Security Lead
- Confirm security baseline coverage semantics are accurate.
- Ensure discovery vs evidence vs coverage are not conflated.
- Ensure no KPI can exceed valid range.

## Definition of Done for Each Iteration
- Build passes.
- Demo run still works from homepage.
- Inventory page has no contradictory metrics.
- At least one blocker from each persona pass is resolved.
- Deploy to production.

## Next Backlog (Ordered)
1. Add sortable columns + CSV export in unified asset list.
2. Add row click to open asset detail drawer (provenance, controls, network, evidence).
3. Add explicit "Why missing" + "Data owner" columns in critical gaps table.
4. Add per-unit filter chips (Feed/Reaction/Separation/etc.).
5. Add graph deep-link preserving current filters.
6. Add confidence trace panel: which sources contributed to each KPI.

## Execution Protocol
For each iteration:
1. Pick top 1-2 items from Next Backlog.
2. Implement.
3. Build + deploy.
4. Append a short changelog entry in this file under `Iteration Log`.

## Iteration Log
- 2026-03-10: Simplified inventory for engineering workflow; map visible by default; live search + network filters; improved KPI semantics and explainers.
