// Thermodynamics Physics MCP
// Heat transfer, reaction kinetics, runaway scenarios

import { tool } from "ai";
import { z } from "zod";

/**
 * Calculate adiabatic temperature rise for an exothermic reaction
 * Used to assess runaway reaction potential
 */
export const adiabaticTemperatureRise = tool({
  description:
    "Calculate the adiabatic temperature rise for an exothermic reaction. Used to assess runaway reaction potential and consequence severity.",
  parameters: z.object({
    reactionEnthalpy: z
      .number()
      .describe("Heat of reaction in kJ/mol (negative for exothermic)"),
    reactantConcentration: z
      .number()
      .describe("Reactant concentration in mol/L"),
    solutionVolume: z.number().describe("Solution volume in liters"),
    heatCapacity: z
      .number()
      .describe("Heat capacity of solution in kJ/(kg·K)"),
    solutionDensity: z
      .number()
      .default(1.0)
      .describe("Solution density in kg/L"),
  }),
  execute: async ({
    reactionEnthalpy,
    reactantConcentration,
    solutionVolume,
    heatCapacity,
    solutionDensity,
  }) => {
    // Q = -ΔH × n (total heat released)
    const moles = reactantConcentration * solutionVolume;
    const totalHeat = Math.abs(reactionEnthalpy) * moles; // kJ

    // Mass of solution
    const mass = solutionVolume * solutionDensity; // kg

    // ΔT = Q / (m × Cp)
    const temperatureRise = totalHeat / (mass * heatCapacity);

    return {
      adiabaticTemperatureRise: {
        value: Math.round(temperatureRise * 10) / 10,
        unit: "K",
      },
      totalHeatReleased: {
        value: Math.round(totalHeat * 10) / 10,
        unit: "kJ",
      },
      riskAssessment:
        temperatureRise > 100
          ? "CRITICAL - Potential for violent reaction"
          : temperatureRise > 50
            ? "HIGH - Significant runaway potential"
            : temperatureRise > 25
              ? "MEDIUM - Moderate thermal hazard"
              : "LOW - Manageable thermal event",
    };
  },
});

/**
 * Calculate time to maximum rate under adiabatic conditions (TMRad)
 * Critical for understanding response time in loss-of-cooling scenarios
 */
export const timeToMaximumRate = tool({
  description:
    "Calculate Time to Maximum Rate under adiabatic conditions (TMRad). Critical for loss-of-cooling scenarios to understand available response time.",
  parameters: z.object({
    initialTemperature: z.number().describe("Initial temperature in °C"),
    activationEnergy: z
      .number()
      .describe("Activation energy in kJ/mol"),
    preExponentialFactor: z
      .number()
      .describe("Arrhenius pre-exponential factor (1/s)"),
    heatCapacity: z.number().describe("Heat capacity in kJ/(kg·K)"),
    reactionEnthalpy: z.number().describe("Heat of reaction in kJ/mol"),
    concentration: z.number().describe("Reactant concentration in mol/kg"),
  }),
  execute: async ({
    initialTemperature,
    activationEnergy,
    preExponentialFactor,
    heatCapacity,
    reactionEnthalpy,
    concentration,
  }) => {
    const R = 8.314e-3; // Gas constant in kJ/(mol·K)
    const T0 = initialTemperature + 273.15; // Convert to Kelvin

    // Simplified TMRad calculation (Semenov model)
    // TMRad ≈ Cp × R × T0² / (A × Ea × (-ΔH) × C × exp(-Ea/RT0))
    const expTerm = Math.exp(-activationEnergy / (R * T0));
    const numerator = heatCapacity * R * T0 * T0;
    const denominator =
      preExponentialFactor *
      activationEnergy *
      Math.abs(reactionEnthalpy) *
      concentration *
      expTerm;

    const tmrad = numerator / denominator; // seconds

    const tmradMinutes = tmrad / 60;
    const tmradHours = tmrad / 3600;

    return {
      tmrad: {
        seconds: Math.round(tmrad),
        minutes: Math.round(tmradMinutes * 10) / 10,
        hours: Math.round(tmradHours * 100) / 100,
      },
      responseTimeAssessment:
        tmradMinutes < 10
          ? "CRITICAL - Less than 10 minutes to respond"
          : tmradMinutes < 30
            ? "HIGH - Limited response window"
            : tmradMinutes < 60
              ? "MEDIUM - Adequate response time if monitored"
              : "LOW - Extended response window available",
      operationalGuidance:
        tmradMinutes < 30
          ? "Requires automatic safety instrumented system (SIS) intervention"
          : "Manual intervention may be feasible if properly monitored",
    };
  },
});

/**
 * Heat exchanger duty calculation
 * For assessing cooling capacity and failure consequences
 */
export const heatExchangerDuty = tool({
  description:
    "Calculate heat exchanger duty and assess cooling capacity. Used to evaluate consequences of cooling system failures.",
  parameters: z.object({
    massFlowRate: z.number().describe("Mass flow rate in kg/s"),
    inletTemperature: z.number().describe("Inlet temperature in °C"),
    outletTemperature: z.number().describe("Outlet temperature in °C"),
    heatCapacity: z
      .number()
      .default(4.18)
      .describe("Heat capacity in kJ/(kg·K), default water"),
  }),
  execute: async ({
    massFlowRate,
    inletTemperature,
    outletTemperature,
    heatCapacity,
  }) => {
    // Q = m × Cp × ΔT
    const deltaT = Math.abs(outletTemperature - inletTemperature);
    const duty = massFlowRate * heatCapacity * deltaT; // kW

    return {
      heatDuty: {
        value: Math.round(duty * 10) / 10,
        unit: "kW",
      },
      temperatureDrop: {
        value: deltaT,
        unit: "°C",
      },
      coolingCapacity: {
        value: Math.round(duty * 3412.14) / 10, // Convert to BTU/hr
        unit: "BTU/hr",
      },
      flowAnalysis: {
        massFlow: { value: massFlowRate, unit: "kg/s" },
        volumetricFlow: {
          value: Math.round((massFlowRate / 1000) * 15850.3 * 10) / 10,
          unit: "gpm",
        },
      },
    };
  },
});

/**
 * Consequence severity calculator for thermal events
 */
export const thermalConsequenceSeverity = tool({
  description:
    "Calculate consequence severity for thermal events (runaway reactions, loss of cooling, overheating). Provides risk classification and regulatory implications.",
  parameters: z.object({
    maxTemperature: z.number().describe("Maximum achievable temperature in °C"),
    boilingPoint: z.number().describe("Boiling point of material in °C"),
    flashPoint: z.number().optional().describe("Flash point if flammable in °C"),
    autoignitionTemp: z
      .number()
      .optional()
      .describe("Auto-ignition temperature in °C"),
    reliefSetPressure: z
      .number()
      .optional()
      .describe("Relief valve set pressure in PSI"),
    vesselDesignPressure: z
      .number()
      .optional()
      .describe("Vessel design pressure in PSI"),
    toxicRelease: z
      .boolean()
      .default(false)
      .describe("Whether release would be toxic"),
    outdoorLocation: z.boolean().default(true).describe("Outdoor vs indoor"),
  }),
  execute: async ({
    maxTemperature,
    boilingPoint,
    flashPoint,
    autoignitionTemp,
    reliefSetPressure,
    vesselDesignPressure,
    toxicRelease,
    outdoorLocation,
  }) => {
    const consequences: string[] = [];
    let severity: "critical" | "high" | "medium" | "low" = "low";
    const regulatoryImplications: string[] = [];

    // Boiling / overpressure check
    if (maxTemperature > boilingPoint) {
      consequences.push("Material will boil - potential overpressure");
      severity = "high";

      if (reliefSetPressure && vesselDesignPressure) {
        if (maxTemperature > boilingPoint + 50) {
          consequences.push("Relief valve lift expected");
          regulatoryImplications.push("PSM covered process - relief event");
        }
      }
    }

    // Fire risk
    if (flashPoint && maxTemperature > flashPoint) {
      consequences.push("Above flash point - fire risk if released");
      severity = severity === "low" ? "medium" : severity;
    }

    if (autoignitionTemp && maxTemperature > autoignitionTemp) {
      consequences.push("CRITICAL: Auto-ignition possible");
      severity = "critical";
      regulatoryImplications.push("Potential fire/explosion incident");
    }

    // Toxic release
    if (toxicRelease && maxTemperature > boilingPoint) {
      consequences.push("Toxic atmospheric release");
      severity = "critical";
      regulatoryImplications.push("EPA RMP reportable quantity");
      regulatoryImplications.push("OSHA PSM covered release");
      if (!outdoorLocation) {
        consequences.push("Indoor release - evacuation required");
      }
    }

    return {
      consequenceSeverity: severity,
      consequences,
      regulatoryImplications,
      recommendedSafeguards:
        severity === "critical"
          ? [
              "SIL 2+ safety instrumented function",
              "Redundant temperature monitoring",
              "Automatic emergency cooling activation",
              "Relief system sized for maximum rate",
            ]
          : severity === "high"
            ? [
                "SIL 1 safety instrumented function",
                "High temperature alarm",
                "Operator response procedure",
              ]
            : ["Standard process monitoring", "Operator awareness"],
    };
  },
});

export const thermodynamicsTools = {
  adiabaticTemperatureRise,
  timeToMaximumRate,
  heatExchangerDuty,
  thermalConsequenceSeverity,
};
