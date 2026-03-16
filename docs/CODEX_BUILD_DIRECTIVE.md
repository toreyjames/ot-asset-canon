# Codex Build Directive

Use this as the implementation directive for Baseload.

## System Goal
Build Baseload as one coherent system with three connected views:
1. Strategic Map
2. Site Intelligence
3. Mission Map

Do not build disconnected dashboards.

## Required Product Behavior
- Every screen must resolve to canonical objects and relationships.
- Every key claim shown in UI must retain source provenance.
- Confidence must be explicit and queryable.
- Mission Map must support layered toggles (physical/control/network/dependency/confidence).

## Data/Model Rules
- Preserve epistemic separation:
  - dataset -> evidence -> signal -> inference
- Model output is not evidence.
- Hypotheses cannot be promoted to evidence without supporting records.

## API Contract Direction
API routes should align with the canonical map model:
- `/api/strategic/*`
- `/api/company/*`
- `/api/site/*`
- `/api/facility/*`
- `/api/mission-map/*`
- `/api/asset/*`
- `/api/issues/*`

## UI Doctrine
- Technical, structured, high-clarity UI.
- Minimal copy.
- Grid/spec-sheet pattern.
- Diagram blocks over marketing cards.
- Monochrome base with one controlled accent color.

## Screen Acceptance Criteria
### Strategic Map
- shows capital + infrastructure + cluster overlays
- supports drill-down to company/site/facility

### Site Intelligence
- shows site facts as structured data (not prose)
- links programs/investments/evidence to facility scope

### Mission Map
- renders topology + dependencies + confidence
- supports issue surfacing and asset-level drill-down

### Asset Detail
- source provenance section mandatory
- confidence and dependency context mandatory

### Issue Center
- must list contradiction classes:
  - missing dependency
  - undocumented asset
  - documentation mismatch
  - topology contradiction

## Prompt Snippet
"Baseload is a multi-scale industrial intelligence platform. Implement all pages as connected zoom levels of a single system model (Strategic Map -> Site Intelligence -> Mission Map). Enforce provenance, confidence, and canonical object relationships in data and UI. Avoid generic dashboard patterns and marketing-first layout choices."
