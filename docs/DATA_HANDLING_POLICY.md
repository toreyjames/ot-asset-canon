# Baseload Data Handling Policy

## Purpose
Define default data handling behavior for OT/engineering information across all Baseload deployment modes.

## Default Principle
Raw OT and engineering data stays in the customer environment by default.

Baseload's default operating model is metadata-first:
- store canonical entities
- store relationship graph edges
- store provenance pointers
- avoid persistent storage of raw control-system payloads unless explicitly enabled

## Data Classes

### Class A: Raw Sensitive Operational Data
Examples:
- controller configs
- full scan exports
- engineering files with detailed process/control context

Default:
- do not persist in Baseload cloud unless customer opts in
- if temporarily processed, enforce short retention window and secure deletion

### Class B: Normalized Operational Metadata
Examples:
- asset identities
- topology relationships
- protocol and role metadata
- model confidence fields

Default:
- persisted in Baseload canonical model
- tenant-isolated with strict access controls

### Class C: Derived Intelligence
Examples:
- readiness scores
- issue records
- dependency gaps
- strategic benchmark deltas

Default:
- persisted for product operation and reporting
- tied to source provenance references

## Data Flow Guardrails
- Preserve epistemic separation:
  - dataset -> observation -> signal -> inference
- Do not promote inference into evidence without source-backed observation.
- Keep immutable provenance references for all critical assertions.

## Storage and Access Controls
- No public object access for customer data.
- Tenant isolation required (`org_id` boundaries + RLS).
- Encryption in transit and at rest.
- Role-based access with least privilege.
- Full audit trail for data access and admin actions.

## Retention and Deletion
- Customer-configurable retention by data class.
- Default retention should be conservative for raw data.
- One-click scoped purge by org/site/source where contractually allowed.
- Legal hold support for enterprise contracts.

## Residency and Subprocessors
- Deployment region must be selectable for enterprise accounts where required.
- Subprocessor list and data flow map must be available for security review.

## Contract Alignment
For enterprise contracts, this policy should map directly to:
- DPA
- security addendum
- retention/deletion terms
- incident response commitments
- audit and compliance controls
