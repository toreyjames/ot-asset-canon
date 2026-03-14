# BASELOAD APP V1 BLUEPRINT

## 1) Product Boundary
Baseload V1 is an app, not a page collection.

Core promise:
- Start with client context
- Build mission map with controlled workflow
- Add external context only when requested

Primary app outcome:
- move from `unknown facility reality` -> `validated canonical map + prioritized action queue`

## 2) Console Model
Single shell route:
- `/console`

Primary panels:
1. left rail: workspace + module navigation
2. center canvas: current state/view
3. right context: checks, confidence, actions, event log

No page-hopping as default workflow.

## 3) Canonical Objects (V1)
- `org`
- `workspace`
- `user`
- `membership`
- `onboarding_profile`
- `data_boundary_policy`
- `source_connection`
- `ingest_run`
- `run_event`
- `artifact`
- `canonical_asset`
- `canonical_edge`
- `issue`
- `opportunity`

## 4) State Machine
### Workspace lifecycle
- `created`
- `onboarding`
- `configured`
- `ingesting`
- `mapped`
- `review`
- `active`

### Ingest lifecycle
- `draft`
- `step1_validated` (org + boundary)
- `step2_validated` (deployment + scope)
- `step3_validated` (sources + tagging)
- `step4_ready` (file attached)
- `running`
- `completed`
- `failed`

Transitions must be server-validated, not only UI-validated.

## 5) Required Database Tables
### Identity + tenancy
- `orgs(id, slug, name, industry, created_at)`
- `users(id, email, name, created_at)`
- `memberships(id, org_id, user_id, role, created_at)`
- `workspaces(id, org_id, name, status, mode, created_at, updated_at)`

### Onboarding + policy
- `onboarding_profiles(id, workspace_id, objective, privacy_mode, completed_at, created_at)`
- `data_boundary_policies(id, org_id, mode, raw_storage, intake_storage, updated_by, updated_at)`

### Runtime + provenance
- `source_connections(id, workspace_id, source_type, status, config_json, last_sync_at)`
- `ingest_runs(id, workspace_id, status, step_state, source, file_name, started_at, ended_at, error_text)`
- `run_events(id, ingest_run_id, at, level, action, details_json)`
- `artifacts(id, ingest_run_id, artifact_type, storage_ref, checksum, created_at)`

### Model outputs
- `canonical_assets(id, workspace_id, run_id, external_key, asset_type, confidence, payload_json, created_at)`
- `canonical_edges(id, workspace_id, run_id, from_asset_id, to_asset_id, edge_type, confidence, created_at)`
- `issues(id, workspace_id, run_id, severity, issue_type, status, payload_json, created_at)`
- `opportunities(id, workspace_id, source, status, payload_json, created_at)`

## 6) API Contract (V1)
### Auth + tenancy
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/workspaces`
- `POST /api/workspaces`

### Onboarding + policy
- `GET /api/workspaces/:id/onboarding`
- `POST /api/workspaces/:id/onboarding`
- `GET /api/orgs/:orgId/data-boundary`
- `POST /api/orgs/:orgId/data-boundary`

### Step engine
- `POST /api/workspaces/:id/ingest/validate-step`  
  request: `{ step, payload }`  
  response: `{ ok, errors[], normalizedState }`

- `POST /api/workspaces/:id/ingest/start`
- `GET /api/workspaces/:id/ingest/:runId`
- `GET /api/workspaces/:id/ingest/:runId/events`

### Mission map + issues
- `GET /api/workspaces/:id/mission-map`
- `GET /api/workspaces/:id/assets`
- `GET /api/workspaces/:id/issues`
- `POST /api/workspaces/:id/issues/:issueId/status`

### External context (opt-in)
- `GET /api/workspaces/:id/industry-context`
- `GET /api/workspaces/:id/opportunities`

## 7) RBAC
Roles:
- `owner`
- `admin`
- `operator`
- `viewer`

Policy examples:
- viewer: read-only
- operator: execute ingest runs, resolve issues
- admin/owner: modify boundary policies, integrations, members

## 8) Event Logging Requirements
Every major action writes `run_events` with:
- UTC timestamp
- actor id (or `system`)
- action key
- status (`info/success/error`)
- details payload

Minimum events:
- onboarding completed
- boundary policy changed
- source added/removed
- file attached
- step validation pass/fail
- run started/completed/failed
- issue status changed

## 9) UI Doctrine (App-Level)
- color must be semantic only:
  - neutral = structure
  - cyan = active/action
  - green = success
  - amber = warning/gate
  - red = error
- one typography stack everywhere
- one component vocabulary for cards, controls, status chips
- no demo elements in client flow unless explicitly selected in onboarding

## 10) Rollout Plan
### Phase A (1-2 weeks)
- `/console` shell
- workspace picker
- onboarding state persisted server-side
- step validator API
- server-backed run event log

### Phase B (2-3 weeks)
- ingest runs persisted in DB
- mission map from canonical outputs
- issue queue with status transitions
- RBAC enforcement

### Phase C (2-4 weeks)
- connectors + scheduled refresh
- industry context opt-in layer
- salesforce/jupiter sync adapters

## 11) Definition of Done (V1)
V1 is done when:
1. New user login always lands in workspace onboarding, not generic public context.
2. No step advance without server validation.
3. Every action is auditable in persistent event logs.
4. Mission Map output is tied to a specific ingest run and workspace.
5. External context is opt-in and clearly separated from client-private context.
