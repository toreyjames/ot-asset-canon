# Baseload Platform Architecture

## Operating Model
Baseload is the umbrella platform.

Products:
- PlantTrace
- Industrial Tracker

Capability inside Industrial Tracker:
- Opportunity Tracker

## Thin Platform Layer
The platform layer should stay thin and only own shared coordination primitives:
- brand and company identity
- module registry and top-level navigation
- shared entity, facility, and geography references
- cross-domain handoff points

It should not own product-specific business logic.

## Current Code Structure
- `src/lib/platform`
  - Baseload brand configuration
  - shared module definitions
  - shared entity/facility/geography reference types
- `src/lib/planttrace`
  - inside-the-plant OT and facility reconstruction logic
- `src/lib/industrial-tracker`
  - outside-the-plant industrial landscape logic
- `src/lib/industrial-opportunity-tracker`
  - Opportunity Tracker source catalog and request contracts

## Rule
If logic is specific to PlantTrace or Industrial Tracker, it should not live in `src/lib/platform`.
