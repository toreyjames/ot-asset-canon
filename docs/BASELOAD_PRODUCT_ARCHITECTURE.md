# Baseload Product Architecture

## Product Thesis
Baseload is an industrial reality engine.

Its purpose is to reconcile fragmented industrial evidence into a usable operating picture of what is true, what is inferred, what is missing, and what requires action.

Baseload should not be framed as:
- a generic ontology product
- a disconnected dashboard suite
- a configurable data platform

Baseload should be framed as:
- a system that reconciles industrial reality before decisions are made

## Core Promise
Baseload gives operators, investors, industrial planners, and public-sector users a reconciled view of industrial reality across:

`capital -> infrastructure -> operational reality`

## Product Spine
The visible product should resolve into three connected maps:

1. `Strategic Map`
2. `Site Intelligence`
3. `Mission Map`

These are not separate products with separate truths.
They are zoom levels of the same reconciled system.

## Map Definitions

### 1. Strategic Map
Purpose:
- show where capital, infrastructure, and industrial momentum are moving
- identify clusters, corridors, regions, and strategic shifts

Core questions:
- Where is industrial capacity forming?
- Which companies and sectors are expanding?
- Which regions are becoming strategically important?

Primary object focus:
- Region
- Sector
- Company
- Investment
- Infrastructure

### 2. Site Intelligence
Purpose:
- bridge macro industrial movement to real companies, sites, and facilities
- reconcile what is true about a place before operational modeling begins

Core questions:
- What is true about this site?
- What facilities, programs, investments, and evidence attach to it?
- What confidence and freshness do we have?

Primary object focus:
- Company
- Site
- Facility
- Program
- Evidence
- Issue

### 3. Mission Map
Purpose:
- represent the operational topology of a facility
- make dependencies, confidence, and mismatches explicit

Core questions:
- What is likely happening inside this facility?
- Which assets, lines, systems, and dependencies matter?
- Where do observation, inference, and issues diverge?

Primary object focus:
- Facility
- Line
- Asset
- Dependency
- Observation
- Inference
- Issue

## Canonical Navigation
The entire product should follow one zoom path:

`Strategic Map -> Company -> Site -> Facility -> Mission Map -> Asset`

This is the product contract.

Any page, API, or workflow that does not fit this path should be questioned before expanding.

## Epistemic Model
Baseload must preserve strict fact separation:

1. `Observation`
   - source-backed fact
   - directly traceable to evidence

2. `Inference`
   - derived interpretation
   - confidence-scored
   - never promoted to evidence without support

3. `Issue`
   - rule-triggered contradiction, gap, or risk
   - generated from observations and inferences

The system should always answer:
- what is observed
- what is inferred
- what is unresolved

## Core Platform Layers
Baseload should be understood internally as:

1. `Ingest`
   - source-native retrieval

2. `Normalize`
   - parsing, typing, geography, taxonomy, and source cleanup

3. `Identity Resolution`
   - company / site / facility / asset reconciliation

4. `Canonical Model`
   - stable object and relationship layer

5. `Evidence Graph`
   - linked, provenance-preserving truth layer

6. `Issue and Confidence Layer`
   - contradictions, missing data, confidence states, freshness

7. `Product Views`
   - Strategic Map
   - Site Intelligence
   - Mission Map

8. `Decision Layer`
   - prioritization
   - workflow
   - actions
   - agents / MCP

## Decision Layer Boundary
Baseload should first own the truth engine.

Then it can support:
- decision support workflows
- alerts and prioritization
- agent access
- enterprise platform APIs
- a future Baseload MCP

The sequence matters:
- first reconcile reality
- then recommend action

## What Customers Should See
Customers should primarily see:
- what is happening
- why Baseload believes it
- how fresh the picture is
- where confidence is weak
- what needs attention

Customers should not see:
- detailed methodology diagrams on the front door
- raw source strategy as marketing content
- ontology-first positioning

## Packaging Direction
Commercially, Baseload should package around the three views:

- `Strategic Map`
  - macro industrial movement and capital/infrastructure monitoring

- `Site Intelligence`
  - company/site/facility truth and evidence review

- `Mission Map`
  - deeper facility/asset/operational reconstruction

Cross-cutting premium capability:
- `Issue Engine`
- `API / MCP Access`

## Design Direction
The interface should communicate:
- technical clarity
- operational seriousness
- trustworthiness
- confidence and uncertainty

Design rules:
- monochrome/spec-sheet foundation
- diagram-first layout
- minimal marketing language
- object-centered pages
- visible provenance, freshness, and confidence

## Product Test
If the product is working, a user should be able to move from:

- national industrial movement
- to company and site truth
- to facility-level operational understanding

without changing systems or losing provenance.

## Build Filter
Before adding anything new, ask:

1. Does this improve reality reconciliation?
2. Does this strengthen the canonical object model?
3. Does this expose clearer confidence, freshness, or issues?
4. Does this support Strategic Map, Site Intelligence, or Mission Map?
5. Is this part of the truth engine or part of the decision layer?

If the answer is unclear, do not expand the surface area yet.
