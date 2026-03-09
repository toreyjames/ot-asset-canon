# Hybrid Demo Data Strategy

## Why Hybrid
Public datasets provide realistic telemetry and attack-pattern characteristics, but they do not provide complete plant inventory, engineering context, or CMDB-ready structure.

PlantTrace demo packs combine:
- `real_benchmark` (telemetry realism archetype)
- `synthetic` (full plant model coverage)
- `inferred` (relationship and link intelligence)

## Provenance Model
Each asset can include `provenance[]` entries with:
- `field`
- `sourceType`: `real_benchmark | synthetic | inferred`
- `sourceRef`
- `confidence`
- `note`

This keeps demo claims honest and auditable.

## Available Demo Packs
- `single_plant_baseline`
- `multi_plant_portfolio`
- `multi_tenant_operator`
- `cross_domain_showcase` (refinery, automotive, defense manufacturing, shipbuilding)

## API
`POST /api/demo/hybrid`

Example payload:
```json
{
  "pack": "multi_plant_portfolio",
  "seedPrefix": "demo-2026",
  "maxAssetsPerSite": 1200
}
```

## Output
Returns sites with:
- synthetic canonical assets
- benchmark archetype tags (SWaT-like/WADI-like/power-grid-like)
- per-field provenance metadata
- per-site provenance stats
