// Fluid Dynamics Physics MCP
// Flow calculations, pressure drops, pump curves, relief sizing

import { tool } from "ai";
import { z } from "zod";

/**
 * Calculate pressure drop in pipe using Darcy-Weisbach equation
 */
export const pipelinePressureDrop = tool({
  description:
    "Calculate pressure drop in a pipeline using Darcy-Weisbach equation. Essential for understanding flow constraints and pump requirements.",
  parameters: z.object({
    flowRate: z.number().describe("Flow rate in gpm"),
    pipeDiameter: z.number().describe("Pipe inner diameter in inches"),
    pipeLength: z.number().describe("Pipe length in feet"),
    fluidDensity: z
      .number()
      .default(62.4)
      .describe("Fluid density in lb/ft³, default water"),
    viscosity: z
      .number()
      .default(1.0)
      .describe("Dynamic viscosity in cP, default water at 20°C"),
    roughness: z
      .number()
      .default(0.00015)
      .describe("Pipe roughness in feet, default commercial steel"),
  }),
  execute: async ({
    flowRate,
    pipeDiameter,
    pipeLength,
    fluidDensity,
    viscosity,
    roughness,
  }) => {
    // Convert units
    const Q = flowRate / 448.831; // gpm to ft³/s
    const D = pipeDiameter / 12; // inches to feet
    const A = (Math.PI * D * D) / 4; // Cross-sectional area
    const V = Q / A; // Velocity in ft/s

    // Reynolds number
    const rho = fluidDensity;
    const mu = viscosity * 0.000672; // cP to lb/(ft·s)
    const Re = (rho * V * D) / mu;

    // Friction factor (Swamee-Jain approximation for turbulent flow)
    let f: number;
    if (Re < 2300) {
      f = 64 / Re; // Laminar
    } else {
      const term1 = roughness / (3.7 * D);
      const term2 = 5.74 / Math.pow(Re, 0.9);
      f = 0.25 / Math.pow(Math.log10(term1 + term2), 2);
    }

    // Darcy-Weisbach: ΔP = f × (L/D) × (ρV²/2)
    const deltaP_psf = f * (pipeLength / D) * (rho * V * V) / 2;
    const deltaP_psi = deltaP_psf / 144;

    // Head loss
    const headLoss = deltaP_psf / rho; // feet

    return {
      pressureDrop: {
        value: Math.round(deltaP_psi * 100) / 100,
        unit: "psi",
      },
      headLoss: {
        value: Math.round(headLoss * 10) / 10,
        unit: "feet",
      },
      velocity: {
        value: Math.round(V * 100) / 100,
        unit: "ft/s",
      },
      reynoldsNumber: Math.round(Re),
      flowRegime: Re < 2300 ? "laminar" : Re < 4000 ? "transitional" : "turbulent",
      frictionFactor: Math.round(f * 10000) / 10000,
    };
  },
});

/**
 * Pump operating point calculation
 */
export const pumpOperatingPoint = tool({
  description:
    "Calculate pump operating point given system curve and pump curve. Used to assess pump performance and failure consequences.",
  parameters: z.object({
    staticHead: z.number().describe("Static head in feet"),
    frictionHeadAtDesign: z
      .number()
      .describe("Friction head at design flow in feet"),
    designFlowRate: z.number().describe("Design flow rate in gpm"),
    pumpShutoffHead: z.number().describe("Pump shutoff head (zero flow) in feet"),
    pumpDesignHead: z.number().describe("Pump head at design point in feet"),
    pumpDesignFlow: z.number().describe("Pump design flow in gpm"),
  }),
  execute: async ({
    staticHead,
    frictionHeadAtDesign,
    designFlowRate,
    pumpShutoffHead,
    pumpDesignHead,
    pumpDesignFlow,
  }) => {
    // System curve: H = Hs + Hf × (Q/Qd)²
    // Pump curve (quadratic approximation): H = H0 - k × Q²
    const k = (pumpShutoffHead - pumpDesignHead) / (pumpDesignFlow * pumpDesignFlow);

    // Find intersection (operating point)
    // Hs + Hf × (Q/Qd)² = H0 - k × Q²
    // Solving for Q:
    const Hf_coeff = frictionHeadAtDesign / (designFlowRate * designFlowRate);
    const a = Hf_coeff + k;
    const b = 0;
    const c = staticHead - pumpShutoffHead;

    const Q_op = Math.sqrt(-c / a);
    const H_op = pumpShutoffHead - k * Q_op * Q_op;

    // Check NPSH (simplified)
    const npshMargin = H_op > staticHead + frictionHeadAtDesign * 0.5;

    return {
      operatingPoint: {
        flow: {
          value: Math.round(Q_op * 10) / 10,
          unit: "gpm",
        },
        head: {
          value: Math.round(H_op * 10) / 10,
          unit: "feet",
        },
      },
      flowRatio: {
        value: Math.round((Q_op / designFlowRate) * 100),
        unit: "%",
        assessment:
          Q_op / designFlowRate > 1.1
            ? "Operating above design - check motor load"
            : Q_op / designFlowRate < 0.7
              ? "Operating below design - potential instability"
              : "Operating near design point",
      },
      systemCurve: {
        staticHead,
        frictionCoefficient: Math.round(Hf_coeff * 1000) / 1000,
      },
      npshAssessment: npshMargin
        ? "Adequate NPSH margin expected"
        : "WARNING: Potential cavitation risk",
    };
  },
});

/**
 * Relief valve sizing calculation (API 520)
 */
export const reliefValveSizing = tool({
  description:
    "Size relief valve per API 520. Critical for safety system verification and consequence analysis.",
  parameters: z.object({
    requiredReliefRate: z.number().describe("Required relief rate in lb/hr"),
    setPresure: z.number().describe("Relief valve set pressure in psig"),
    backPressure: z.number().default(0).describe("Back pressure in psig"),
    temperature: z.number().describe("Relieving temperature in °F"),
    molecularWeight: z.number().describe("Molecular weight of fluid"),
    compressibilityFactor: z.number().default(1.0).describe("Gas compressibility factor Z"),
    specificHeatRatio: z.number().default(1.4).describe("Cp/Cv ratio"),
    fluidType: z.enum(["gas", "liquid", "two_phase"]).describe("Fluid type"),
  }),
  execute: async ({
    requiredReliefRate,
    setPresure,
    backPressure,
    temperature,
    molecularWeight,
    compressibilityFactor,
    specificHeatRatio,
    fluidType,
  }) => {
    // API 520 gas sizing: A = W × sqrt(T × Z) / (C × Kd × P1 × Kb × sqrt(M))
    const P1 = (setPresure + 14.7) * 1.1; // Relieving pressure (110% of set)
    const T = temperature + 460; // Rankine

    // C factor from specific heat ratio
    const k = specificHeatRatio;
    const C = 520 * Math.sqrt(k * Math.pow(2 / (k + 1), (k + 1) / (k - 1)));

    // Typical coefficients
    const Kd = 0.975; // Discharge coefficient (conventional valve)
    const Kb = backPressure > 0 ? 1 - backPressure / setPresure * 0.3 : 1.0; // Back pressure correction

    let area: number;
    if (fluidType === "gas") {
      area =
        (requiredReliefRate * Math.sqrt(T * compressibilityFactor)) /
        (C * Kd * P1 * Kb * Math.sqrt(molecularWeight));
    } else {
      // Simplified liquid sizing
      const Kw = 1.0; // No back pressure correction for liquids
      const specificGravity = molecularWeight / 18; // Approximate
      area =
        requiredReliefRate /
        (38.78 * Kd * Kw * Math.sqrt((P1 - backPressure) / specificGravity));
    }

    // Standard orifice sizes (API 526)
    const orifices = [
      { letter: "D", area: 0.11 },
      { letter: "E", area: 0.196 },
      { letter: "F", area: 0.307 },
      { letter: "G", area: 0.503 },
      { letter: "H", area: 0.785 },
      { letter: "J", area: 1.287 },
      { letter: "K", area: 1.838 },
      { letter: "L", area: 2.853 },
      { letter: "M", area: 3.6 },
      { letter: "N", area: 4.34 },
      { letter: "P", area: 6.38 },
      { letter: "Q", area: 11.05 },
      { letter: "R", area: 16.0 },
      { letter: "T", area: 26.0 },
    ];

    const selectedOrifice = orifices.find((o) => o.area >= area) || orifices[orifices.length - 1];
    const utilizationPercent = (area / selectedOrifice.area) * 100;

    return {
      requiredArea: {
        value: Math.round(area * 1000) / 1000,
        unit: "in²",
      },
      selectedOrifice: {
        letter: selectedOrifice.letter,
        area: selectedOrifice.area,
        unit: "in²",
      },
      utilization: {
        value: Math.round(utilizationPercent),
        unit: "%",
        assessment:
          utilizationPercent > 90
            ? "WARNING: Near maximum capacity - consider larger orifice"
            : utilizationPercent < 50
              ? "Orifice significantly oversized"
              : "Appropriate sizing",
      },
      relievingConditions: {
        pressure: { value: Math.round(P1 * 10) / 10, unit: "psia" },
        temperature: { value: temperature, unit: "°F" },
        massFlow: { value: requiredReliefRate, unit: "lb/hr" },
      },
    };
  },
});

/**
 * Release rate calculation for hole/rupture
 */
export const releaseRateCalculation = tool({
  description:
    "Calculate release rate through a hole or rupture. Used for consequence modeling of leak scenarios.",
  parameters: z.object({
    holeDiameter: z.number().describe("Hole diameter in inches"),
    pressure: z.number().describe("Internal pressure in psig"),
    temperature: z.number().describe("Temperature in °F"),
    fluidType: z.enum(["gas", "liquid"]).describe("Fluid type"),
    molecularWeight: z.number().optional().describe("Molecular weight for gas"),
    liquidDensity: z.number().optional().describe("Liquid density in lb/ft³"),
    dischargeCoefficient: z.number().default(0.61).describe("Discharge coefficient Cd"),
  }),
  execute: async ({
    holeDiameter,
    pressure,
    temperature,
    fluidType,
    molecularWeight,
    liquidDensity,
    dischargeCoefficient,
  }) => {
    const Cd = dischargeCoefficient;
    const A = Math.PI * Math.pow(holeDiameter / 2 / 12, 2); // ft²
    const P = (pressure + 14.7) * 144; // psf absolute
    const Patm = 14.7 * 144; // psf

    let massRate: number;
    let volumeRate: number;

    if (fluidType === "liquid" && liquidDensity) {
      // Liquid release: Q = Cd × A × sqrt(2 × ΔP / ρ)
      const deltaP = P - Patm;
      const velocity = Math.sqrt((2 * deltaP) / liquidDensity);
      volumeRate = Cd * A * velocity; // ft³/s
      massRate = volumeRate * liquidDensity; // lb/s
    } else if (fluidType === "gas" && molecularWeight) {
      // Gas release (choked flow assumed for significant pressure)
      const T = temperature + 460; // Rankine
      const R = 1545 / molecularWeight; // ft-lbf/(lb·R)
      const k = 1.4; // Assume air-like
      const Pchoke = P * Math.pow(2 / (k + 1), k / (k - 1));

      if (Patm < Pchoke) {
        // Choked flow
        const criticalVelocity = Math.sqrt((k * R * T * 32.174) / (1 + (k - 1) / 2));
        const density = P / (R * T * 32.174); // lb/ft³
        massRate = Cd * A * density * criticalVelocity;
      } else {
        // Subsonic flow
        const pratio = Patm / P;
        const velocity = Math.sqrt(
          (2 * k * R * T * 32.174 * (1 - Math.pow(pratio, (k - 1) / k))) / (k - 1)
        );
        const exitDensity = (P * Math.pow(pratio, 1 / k)) / (R * T * 32.174);
        massRate = Cd * A * exitDensity * velocity;
      }
      volumeRate = massRate / (P / (R * T * 32.174));
    } else {
      throw new Error("Invalid parameters for fluid type");
    }

    return {
      massReleaseRate: {
        lbPerSecond: Math.round(massRate * 100) / 100,
        lbPerHour: Math.round(massRate * 3600),
        kgPerSecond: Math.round(massRate * 0.4536 * 100) / 100,
      },
      volumeReleaseRate: {
        ft3PerSecond: Math.round(volumeRate * 1000) / 1000,
        gallonsPerMinute: Math.round(volumeRate * 448.831 * 10) / 10,
      },
      timeToEmpty: (inventoryLbs: number) => ({
        seconds: Math.round(inventoryLbs / massRate),
        minutes: Math.round(inventoryLbs / massRate / 60 * 10) / 10,
      }),
      consequenceAssessment:
        massRate > 100
          ? "CRITICAL: Major release scenario"
          : massRate > 10
            ? "HIGH: Significant release"
            : massRate > 1
              ? "MEDIUM: Moderate release"
              : "LOW: Minor leak",
    };
  },
});

export const fluidDynamicsTools = {
  pipelinePressureDrop,
  pumpOperatingPoint,
  reliefValveSizing,
  releaseRateCalculation,
};
