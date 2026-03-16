# Baseload Core Platform Build Brief

## Industrial Intelligence Core
Baseload is building shared industrial knowledge infrastructure that powers:
- `PlantTrace`
- `Industrial Tracker`
- `Opportunity Tracker` inside Industrial Tracker

## Core Principle
Knowledge must preserve epistemological separation:

```text
dataset -> evidence -> signal -> inference
```

Model output is not evidence.

## Shared Core
The shared core is facility-centered and reads through a common graph:
- facilities
- companies
- projects
- evidence
- derived signals
- program links
- events
- model hypotheses

## Current Schema Alignment
The current schema now includes:
- `facility_master`
- `entity_master`
- `industrial_projects`
- `source_records`
- `evidence_records`
- `derived_signals`
- `program_links`
- `facility_events`
- `model_hypotheses`
- plus geo and opportunity/event layers

## Rule Of Use
- `PlantTrace` may read evidence and signals, then write hypotheses.
- `Industrial Tracker` may read evidence, signals, projects, investments, and events.
- Neither product may promote a hypothesis into evidence.
