# OT Asset Canon - Converged Plant Intelligence

## Project Overview

The OT Asset Canon is a converged plant intelligence platform that unifies three traditionally siloed perspectives:

1. **Engineering** - Process consequences, HAZOP findings, SIL ratings, design basis
2. **OT/Control Systems** - Controllers, firmware, I/O, logic, historian tags
3. **IT/Cybersecurity** - Network exposure, CVEs, attack paths, compensating controls

The Canon provides a single view from physical process (Layer 1) through enterprise integration (Layer 6), enabling security that understands consequences and operations that account for cyber exposure.

## Architecture

### Canon Layers (Bottom-Up from Physics)

```
Layer 6: Enterprise Integration (ERP, cloud, remote access, vendor portals)
Layer 5: Network Infrastructure (switches, routers, firewalls, segmentation)
Layer 4: Operations & Monitoring (HMIs, historians, engineering workstations)
Layer 3: Control Systems (PLCs, DCS controllers, RTUs, I/O modules)
Layer 2: Instrumentation & Actuation (sensors, actuators, SIS devices)
Layer 1: Physical Process (reactors, pumps, tanks, material flows)
```

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Vercel Postgres with Drizzle ORM
- **Storage**: Vercel Blob (document storage)
- **Cache**: Vercel KV (optional)
- **AI**: Vercel AI SDK with Claude (Anthropic)
- **Styling**: Tailwind CSS

## Key Directories

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/
│   │   ├── ai/            # AI query endpoint with Canon + Physics tools
│   │   ├── canon/         # Canon CRUD operations
│   │   └── ingest/        # Data ingestion from OT tools
│   ├── ai/                # AI query interface
│   ├── explorer/          # Canon asset browser
│   ├── ingest/            # Data ingestion UI
│   └── risk/              # Risk proportionality (Build Clock)
├── components/
│   ├── canon/             # Canon-specific components
│   └── ui/                # Shared UI components
├── db/
│   ├── schema.ts          # Drizzle schema definitions
│   └── index.ts           # Database connection
├── physics/               # Physics MCPs (AI tools)
│   ├── thermodynamics.ts  # Heat transfer, runaway reactions
│   ├── fluid-dynamics.ts  # Flow, pressure, relief sizing
│   ├── consequence-modeling.ts  # Dispersion, explosion, fire
│   └── index.ts           # Tool exports
├── types/
│   └── canon.ts           # TypeScript type definitions
└── lib/                   # Shared utilities
```

## Physics MCPs

The AI has access to physics calculation tools for consequence analysis:

### Thermodynamics
- `adiabaticTemperatureRise` - Runaway reaction potential
- `timeToMaximumRate` - Response time for loss-of-cooling (TMRad)
- `heatExchangerDuty` - Cooling capacity assessment
- `thermalConsequenceSeverity` - Thermal event classification

### Fluid Dynamics
- `pipelinePressureDrop` - Flow constraints
- `pumpOperatingPoint` - Pump performance analysis
- `reliefValveSizing` - API 520 relief valve sizing
- `releaseRateCalculation` - Leak/rupture release rates

### Consequence Modeling
- `gaussianPlumeDispersion` - Toxic gas dispersion
- `idlhDistanceCalculation` - Evacuation zone calculation
- `vaporCloudExplosion` - VCE overpressure effects
- `poolFireRadiation` - Pool fire thermal radiation

## Data Ingestion

Supports import from:
- **OT Discovery**: Claroty, Dragos, Nozomi Networks
- **Vulnerability Scanners**: Nessus, Qualys, Tenable
- **Manual Entry**: JSON with Canon asset schema

The tag number serves as the "Rosetta Stone" linking engineering P&ID → OT I/O list → historian tag → control logic.

## Build Clock (Risk Proportionality)

Applies the four-judgment framework:
1. **Overspend**: Security investment exceeds risk level
2. **Proportional**: Investment matches risk appropriately
3. **Underspend**: Investment below what risk requires
4. **Structural Mismatch**: Fundamental misalignment

## Development

```bash
# Install dependencies
npm install

# Set up environment (copy .env.example to .env.local)
cp .env.example .env.local

# Run development server
npm run dev

# Generate database migrations
npm run db:generate

# Push schema to database
npm run db:push
```

## Deployment

Deploy to Vercel:
1. Connect repository to Vercel
2. Create Vercel Postgres database
3. Create Vercel Blob storage
4. Add ANTHROPIC_API_KEY to environment variables
5. Deploy

## Example AI Queries

- "What happens if an attacker manipulates the setpoint on TIC-101?"
- "Trace the attack path from vendor VPN to the reactor safety system"
- "Calculate the consequence if cooling water is lost to reactor R-101"
- "Which assets have critical CVEs AND control safety functions?"
- "What's the adiabatic temperature rise for a runaway in R-101?"

## Key Concepts

### Asset Convergence
Every asset carries multiple identity layers:
- Engineering context (HAZOP node, SIL rating, consequence)
- Control system context (controller, firmware, historian tag)
- Network context (IP, VLAN, zone, protocols)
- Security context (CVEs, risk tier, compensating controls)
- Operational context (criticality, redundancy, maintenance)

### Consequence Chains
Trace from cyber event through physical impact:
```
Attacker compromises vendor VPN
→ Gains access to EWS-04
→ Can modify C300 logic
→ Manipulates reactor temperature control
→ Runaway reaction
→ Relief valve lift
→ Atmospheric release
```

### Security Intelligence
- Risk-proportional alerting (consequence severity, not just CVE score)
- Attack path analysis with physical-world impact
- Vulnerability prioritization by process consequence
