// Physics MCPs - Collected tools for AI-powered consequence analysis

import { thermodynamicsTools } from "./thermodynamics";
import { fluidDynamicsTools } from "./fluid-dynamics";
import { consequenceModelingTools } from "./consequence-modeling";

export const physicsTools = {
  ...thermodynamicsTools,
  ...fluidDynamicsTools,
  ...consequenceModelingTools,
};

export { thermodynamicsTools } from "./thermodynamics";
export { fluidDynamicsTools } from "./fluid-dynamics";
export { consequenceModelingTools } from "./consequence-modeling";

// Tool descriptions for AI context
export const PHYSICS_TOOL_DESCRIPTIONS = `
## Available Physics MCPs (Tools)

### Thermodynamics
- **adiabaticTemperatureRise**: Calculate runaway reaction potential
- **timeToMaximumRate**: Calculate response time for loss-of-cooling scenarios (TMRad)
- **heatExchangerDuty**: Assess cooling capacity and failure consequences
- **thermalConsequenceSeverity**: Classify thermal event severity with regulatory implications

### Fluid Dynamics
- **pipelinePressureDrop**: Calculate flow constraints and pump requirements
- **pumpOperatingPoint**: Assess pump performance and failure modes
- **reliefValveSizing**: Size relief valves per API 520 for safety verification
- **releaseRateCalculation**: Calculate leak/rupture release rates

### Consequence Modeling
- **gaussianPlumeDispersion**: Model toxic gas dispersion for atmospheric releases
- **idlhDistanceCalculation**: Calculate evacuation zones for toxic releases
- **vaporCloudExplosion**: Calculate overpressure effects from VCE
- **poolFireRadiation**: Calculate thermal radiation from pool fires

Use these tools to:
1. Assess consequence severity when analyzing OT asset risks
2. Validate safety system adequacy (SIS, relief valves)
3. Calculate attack impact scenarios (what happens if attacker manipulates setpoint?)
4. Support HAZOP/LOPA analysis with quantitative data
5. Generate consequence chains for the Canon
`;
