# Baseload Deployment Modes and Assessment Agents

## Why This Matters
Readiness Assessment (Phase 0) is the trust gate.
Deployment mode determines what data can be used, where it can be processed, and how fast Baseload can deliver value.

## Deployment Modes

### Mode A: Customer Environment Agent (Preferred)
Raw OT/engineering data remains in customer network or VPC.

How it works:
- Baseload agent runs in customer-controlled environment.
- Agent reads approved sources (read-only).
- Agent emits normalized metadata and provenance pointers to Baseload cloud.

Best for:
- high-security OT environments
- enterprise procurement with strict data controls

### Mode B: Customer-Managed Cloud Data Plane
Raw data stays in customer-managed cloud storage/accounts.

How it works:
- Baseload uses scoped credentials to read approved datasets.
- Processing can be customer-hosted or tightly scoped remote processing.
- Baseload persists canonical model and derived intelligence.

Best for:
- cloud-mature enterprise teams
- customers requiring strict IAM and storage ownership

### Mode C: Baseload Hosted Upload (Pilot Mode)
Used for fast pilots and small-team onboarding.

How it works:
- customer uploads files directly to Baseload-managed pipeline
- strict private storage, retention controls, and deletion policy required

Best for:
- early pilots with low integration friction
- non-production / lower sensitivity data first

Policy note:
- This mode should be explicitly labeled pilot mode and opt-in.

## Assessment Agent Framework (Phase 0)

### Goal
Determine the minimum data required to produce a useful readiness output while respecting customer constraints.

### Agent roles
1. Source Discovery Agent
- identifies available tools/systems and data outputs
- records what is accessible read-only

2. Constraint and Policy Agent
- captures data boundary requirements (residency, retention, access)
- recommends deployment mode A/B/C

3. Evidence Coverage Agent
- maps source outputs to required readiness dimensions
- identifies coverage gaps and missing dependencies

4. Integration Path Agent
- proposes phased connector order with effort/risk estimates
- outputs first 30-day integration plan

### Assessment outputs
- Coverage Score
- Confidence Score
- Missing Inputs register
- Recommended deployment mode
- Integration sequence plan (by source and value)

## Commercial and Product Alignment
- Trial should begin in Readiness Assessment with clear data-boundary options.
- Enterprise motion should default to Mode A or B.
- Full Mission Map unlock should follow successful readiness baseline and approved data path.

## Suggested UI Framing
At assessment start, ask three decisions:
1. Data boundary preference (A/B/C)
2. Source priority list
3. Initial site scope

Then produce an assessment packet:
- current state
- usable sources now
- blockers
- first mission-map-ready milestone
