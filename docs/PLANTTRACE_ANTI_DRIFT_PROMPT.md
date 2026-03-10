# PlantTrace – Codex Anti-Drift Prompt

## Product Identity

PlantTrace is **not an OT cybersecurity product**.

PlantTrace is an **Industrial Intelligence Platform** that reconstructs how industrial facilities actually operate by combining engineering data, operational data, enterprise records, and facility context.

The platform produces a **machine-readable facility model (industrial graph)** that allows users to explore infrastructure, understand system relationships, and query operational context.

Primary goal:

```
Reconstruct industrial reality.
```

Not:

```
Detect cyber threats.
```

## What PlantTrace Does

PlantTrace ingests operational and engineering data sources and builds a **facility intelligence layer**.

Core outputs:

```
Canonical asset inventory
Facility infrastructure model
Industrial graph of system relationships
3-D facility exploration environment
Infrastructure coverage metrics
Engineering vs operational reconciliation
Dependency mapping
Operational query interface
```

The system allows users to answer questions such as:

```
What infrastructure actually exists in this facility?
What systems are connected to this pump?
What PLC controls this equipment?
What equipment belongs to this production line?
What infrastructure is missing from engineering documentation?
```

## Primary Users

The system is designed for **operations and engineering teams**, not security teams.

Primary users:

```
Plant engineers
Maintenance leads
Reliability engineers
Operations managers
Facility digitalization teams
Industrial data teams
```

These users are trying to **understand how their plant actually works**.

## Key Concepts

### Industrial Graph

PlantTrace builds a graph of infrastructure relationships.

Example:

```
Pump -> controlled_by -> PLC
PLC -> connected_to -> Switch
Pump -> feeds -> Cooling System
Cooling System -> part_of -> Production Line
```

This graph represents the **true operational structure of the facility**.

### Infrastructure Coverage

The system calculates how much of the facility is modeled.

Example metric:

```
Expected assets: 4,212
Observed assets: 4,571
Infrastructure coverage: 92%
```

This shows **how complete the facility model is**.

### Documentation Reconciliation

PlantTrace compares engineering documentation to operational reality.

Example:

```
Assets documented in engineering: 4,212
Assets observed in operations: 4,571
Documentation drift: 359 assets
```

This helps facilities identify **where documentation no longer reflects reality**.

## Core Product Components

PlantTrace consists of five main subsystems:

```
Edge Collector
Ingestion Pipeline
Entity Resolution Engine
Industrial Graph
3-D Facility Explorer
```

### Edge Collector

Collects facility data sources.

Examples:

```
equipment lists
PLC exports
network switch tables
enterprise asset records
facility layouts
```

### Ingestion Pipeline

Normalizes raw source data into candidate infrastructure objects.

### Entity Resolution Engine

Merges duplicate asset representations into canonical objects.

Example:

```
PLC-12
Controller-12
Cooling PLC B
```

Resolve to a single canonical asset.

### Industrial Graph

Stores infrastructure relationships using a graph database.

Example relationships:

```
connected_to
controlled_by
feeds
located_in
part_of
```

### 3-D Facility Explorer

The 3-D plant environment is the **primary interface** for exploring infrastructure.

Users can:

```
navigate the facility
select equipment
inspect system relationships
visualize process flows
run infrastructure queries
```

Each object in the 3-D scene corresponds to a node in the industrial graph.

## What PlantTrace Is NOT

Avoid implementing features related to OT cybersecurity platforms.

Do NOT implement:

```
Threat detection
Cyber alerts
Vulnerability management
Attack path analysis
Security incident workflows
SOC dashboards
CVE mapping
Threat intelligence feeds
Anomaly detection for cyber attacks
Network intrusion detection
```

These features belong to **OT security products** and are not part of PlantTrace.

## Allowed Metrics

Focus on **infrastructure intelligence metrics** such as:

```
Infrastructure coverage
Documentation reconciliation
Asset ownership completeness
Production line infrastructure modeling
Dependency completeness
Facility model accuracy
```

Do NOT produce metrics such as:

```
Threat severity
Attack surface score
Cyber risk score
Vulnerability exposure
```

## Product Vision

PlantTrace provides a **machine-readable understanding of industrial infrastructure**.

The long-term vision is to enable organizations to:

```
understand facility structure
map operational dependencies
explore infrastructure spatially
query industrial systems
build accurate digital facility models
```

The platform helps facilities answer:

```
How does our plant actually work?
```

## Core Instruction

Treat PlantTrace as:

```
A facility intelligence and infrastructure modeling platform.
```

Not:

```
An OT security monitoring system.
```

All system components should reinforce this mission.
