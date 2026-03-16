# Data Source Alignment Workshop

## Objective
Get all required stakeholders aligned on the minimum viable data bundle per industry lane to produce a credible Baseload Readiness Assessment.

## Outcomes (Required)
1. Industry-specific source matrix completed.
2. Data owners assigned for each source.
3. Deployment mode selected (A/B/C).
4. 30-day connector sequence approved.
5. Phase-0 success metrics agreed.

## Participants
- OT lead
- Engineering systems lead
- IT/security lead
- Data/platform lead
- Business owner / sponsor
- Legal/privacy representative (as needed)

## Pre-Read
- `DATA_HANDLING_POLICY.md`
- `DEPLOYMENT_MODES_AND_ASSESSMENT_AGENTS.md`
- `INDUSTRY_SOURCE_MATRIX_TEMPLATE.md`

## Agenda (90 minutes)

### 1) Operating context and scope (10 min)
- Define industry lane and first site scope.
- Confirm mission: first readiness report in <=14 days.

### 2) Source inventory pass (20 min)
For each candidate source, capture:
- system name
- owner + backup
- source type (OT discovery, CMDB, engineering docs, network, etc.)
- access method (API, file export, DB, connector)
- sensitivity class (A/B/C)

### 3) Constraints and deployment decision (15 min)
- Confirm security and residency constraints.
- Select deployment mode:
  - A: Customer Environment Agent (preferred)
  - B: Customer-managed cloud data plane
  - C: Baseload hosted pilot mode

### 4) Readiness scoring and minimum bundle (20 min)
Per source, assign status:
- available now
- available with approval
- blocked

Define minimum bundle required for first readiness output.

### 5) Connector sequencing (15 min)
Prioritize in order:
- highest trust gain
- lowest integration friction
- highest operational relevance

Create week-by-week plan for first 30 days.

### 6) Decisions and owners (10 min)
- confirm owner for each source
- confirm approval path for blocked sources
- confirm cadence for weekly review

## Decision Log Template
- Decision ID
- Decision
- Rationale
- Owner
- Date
- Follow-up action

## Success Criteria
- Matrix coverage >= 80% of required minimum bundle
- Named owner on 100% of selected sources
- Deployment mode approved
- First readiness report date committed
