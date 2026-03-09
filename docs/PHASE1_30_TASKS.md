# PlantTrace Phase 1 Build Plan (30 Tasks)

## Foundation
- [x] 1. Define Industrial Graph core types (nodes, edges, query contract).
- [x] 2. Create Edge Collector runtime scaffold for supported ingestion modes.
- [x] 3. Implement normalization pipeline from raw records to candidate objects.
- [x] 4. Add ingestion metadata contract (job status, counters, timestamps, errors).
- [x] 5. Implement entity-resolution + graph-build orchestration endpoint (`/api/collector/run`).
- [x] 6. Add architecture spec documentation in repo.
- [ ] 7. Add environment/config module for customer-hosted vs hybrid mode.
- [ ] 8. Add structured telemetry/logging primitives for ingestion and resolution.
- [ ] 9. Define error taxonomy (validation, source, mapping, persistence).
- [ ] 10. Create integration test harness for ingestion-to-graph pipeline.

## Ingestion + Resolution
- [ ] 11. Implement file-upload collector adapter (CSV, JSON, XLSX).
- [ ] 12. Implement watched-folder collector adapter.
- [ ] 13. Implement API-pull collector adapter with source credentials.
- [ ] 14. Implement scheduled-import job runner.
- [ ] 15. Add per-source field mapping templates.
- [ ] 16. Add alias dictionary and fuzzy match for entity resolution.
- [ ] 17. Add source confidence scoring model.
- [ ] 18. Add human-review queue for low-confidence merges.

## Persistence + Query
- [ ] 19. Integrate graph persistence with Neo4j (replace in-memory repository).
- [ ] 20. Add relational persistence for ingest jobs + canonical assets.
- [ ] 21. Implement graph traversal queries (`dependencies`, `controlled_by`, `network_path`).
- [ ] 22. Add natural-language query translator to graph query contract.
- [ ] 23. Add query result caching + pagination for large graphs.

## 3-D + UX
- [ ] 24. Build 3-D facility explorer route with React Three Fiber.
- [ ] 25. Map 3-D scene objects to Industrial Graph node IDs.
- [ ] 26. Add Asset Inspector panel bound to selected scene object.
- [ ] 27. Add Graph Relationship Viewer synchronized with 3-D selection.
- [ ] 28. Add query bar in explorer to trigger graph highlights.

## Productization
- [ ] 29. Implement role routing (customer vs internal portal) and tenant isolation checks.
- [ ] 30. Add export pipeline for CMDB-ready canonical asset package.

## Current Status
Completed now: Tasks 1-6. Next implementation target: Tasks 7-10.
