# PlantTrace Platform Spec (Phase 1)

## Product Definition
PlantTrace is an industrial intelligence platform that reconstructs facility operations into a machine-readable Industrial Graph. Users explore the system via:
- 3-D facility interface
- Industrial graph explorer
- Query engine

## Core Model
Nodes:
- Asset
- ProcessNode
- NetworkNode
- Facility
- Zone

Edges:
- controlled_by
- connected_to
- feeds
- part_of
- located_in
- depends_on

## Core Services
1. Edge Collector
- Runs in customer environment
- Supports file upload, watched folder, API pull, scheduled CSV/XLSX imports

2. Ingestion Pipeline
- Parse source
- Normalize fields
- Generate candidate objects
- Store ingestion metadata

3. Entity Resolution Engine
- Alias matching
- Deduplication
- Confidence scoring
- Canonical asset creation

4. Industrial Graph Service
- Stores nodes and edges
- Supports graph traversal for dependencies and control chains

5. Query Engine
- Search mode
- Graph traversal mode
- Natural language mode (translated into graph queries)

6. 3-D Facility Interface
- Spatial navigation across plant zones
- Equipment selection -> related graph highlights
- Production flow visualization

## Data Architecture
- Object storage: raw files (CSV, CAD, documents)
- Relational DB: facilities, assets, zones, findings, ingest_jobs
- Graph DB: infrastructure relationships (Neo4j recommended)

## Deployment Modes
- Customer-hosted
- Hybrid connector

## Phase 1 MVP Inputs
- Equipment list spreadsheet
- PLC tag export
- Network switch export
- Facility zones

## Phase 1 MVP Outputs
- Canonical inventory
- Industrial graph
- 3-D facility layout
- Queryable relationships

## One-Sentence Definition
PlantTrace reconstructs industrial infrastructure and allows teams to explore it as a spatial graph through a 3-D facility interface.
