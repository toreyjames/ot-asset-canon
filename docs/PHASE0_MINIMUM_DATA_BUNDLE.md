# Phase 0 Minimum Data Bundle

## Goal
Define the smallest source set needed to generate a credible Readiness Assessment without over-requesting data.

## Core Principle
Ask for the minimum dataset that enables:
1. coverage scoring
2. confidence scoring
3. missing-input detection

## Required Source Categories (Baseline)

### 1) OT Asset Discovery Source (Required)
Examples:
- Claroty export
- Nozomi export
- Dragos export

Output needed:
- discovered asset identities
- basic communication/protocol context
- timestamped observation

### 2) Engineering/Reference Source (Required)
Examples:
- engineering asset register
- controlled equipment list
- line/unit equipment hierarchy

Output needed:
- modeled assets and expected structure
- ownership of reference records

### 3) Facility/Site Metadata Source (Required)
Examples:
- site/facility registry
- location and scope definitions

Output needed:
- site/facility boundaries
- stable IDs for mapping

### 4) Optional Enrichment (Phase 0.5)
Examples:
- CMDB extract
- network telemetry summaries
- maintenance/work-order context

Use only if needed to resolve major confidence gaps.

## Phase 0 Outputs
- Coverage Score
- Confidence Score
- Missing Inputs Register
- Recommended deployment mode and connector sequence

## Exit Criteria to Phase 1 (Mission Map)
- Minimum bundle connected
- Confidence above agreed threshold
- Core dependency chain reconstructable for target scope
- Data owner sign-off on readiness packet
