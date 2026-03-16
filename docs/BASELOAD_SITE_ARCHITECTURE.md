# Baseload Site Architecture

## Purpose

The site should present Baseload as an industrial intelligence platform, not just a collection of pages. The product story should move top-down through the intelligence stack and show where PlantTrace fits.

## Top-Level Product Structure

- `Baseload`
- `Industrial Tracker`
- `PlantTrace`

`Industrial Tracker` is the outside-the-fence intelligence system.

`PlantTrace` is the inside-the-fence reconstruction and plant modeling system.

## Intelligence Stack Ordering

The site should present the platform in this order:

1. `National Industrial Base`
2. `Infrastructure & Energy`
3. `Facility Evidence Graph`
4. `Supply Chains & Signals`
5. `Opportunity Tracker`
6. `PlantTrace`

This ordering matches the end-state intelligence flow:

```text
National industrial intelligence
-> sector / supply chain intelligence
-> facility intelligence
-> plant modeling
-> plant operations
```

## Current Sitemap Direction

### Home

The homepage should answer:

- What Baseload is
- How the intelligence stack works
- How Industrial Tracker and PlantTrace relate
- Why the evidence graph is the core platform asset

### Industrial Tracker

Industrial Tracker should be structured as a layered system:

- `/industrial-tracker`
- `/industrial-tracker/national-base`
- `/industrial-tracker/infrastructure-energy`
- `/industrial-tracker/facility-graph`
- `/industrial-tracker/supply-chains`
- `/industrial-tracker/opportunity-tracker`

### PlantTrace

PlantTrace remains the plant-level lens:

- `/planttrace`

## Source Roadmap By Layer

### National Industrial Base

- EPA FRS
- EPA TRI
- Census manufacturing
- USAspending
- BEA industry output

### Infrastructure & Energy

- EIA-860
- EIA-923
- eGRID
- Interconnection queues
- Utility territories

### Facility Evidence Graph

- EPA FRS
- EPA ECHO
- RCRAInfo
- NPDES
- GHGRP
- Air permit inventories

### Supply Chains & Signals

- Census trade
- USITC DataWeb
- FAF
- USACE WCSC
- Rail and port datasets

### Opportunity Tracker

- USAspending
- State incentives
- DOE and CHIPS awards
- Permitting timelines
- Industrial announcements

### PlantTrace

- Facility graph
- Energy signals
- Permit signals
- Investment projects
- OT and operational evidence

## Product Principle

The site should not feel like:

- dashboard
- dashboard
- dashboard

It should feel like:

- industrial system map
- evidence graph
- plant intelligence platform
