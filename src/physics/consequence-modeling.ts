// Consequence Modeling Physics MCP
// Dispersion, explosion, fire modeling for OT security consequence analysis

import { tool } from "ai";
import { z } from "zod";

/**
 * Gaussian plume dispersion model for atmospheric release
 */
export const gaussianPlumeDispersion = tool({
  description:
    "Calculate ground-level concentration from atmospheric release using Gaussian plume model. Used for toxic release consequence analysis.",
  parameters: z.object({
    releaseRate: z.number().describe("Release rate in kg/s"),
    stackHeight: z.number().describe("Effective release height in meters"),
    windSpeed: z.number().describe("Wind speed at release height in m/s"),
    stabilityClass: z
      .enum(["A", "B", "C", "D", "E", "F"])
      .describe("Pasquill-Gifford stability class (A=very unstable, F=very stable)"),
    downwindDistance: z.number().describe("Distance downwind in meters"),
    crosswindDistance: z.number().default(0).describe("Distance crosswind in meters"),
  }),
  execute: async ({
    releaseRate,
    stackHeight,
    windSpeed,
    stabilityClass,
    downwindDistance,
    crosswindDistance,
  }) => {
    // Pasquill-Gifford dispersion coefficients
    const pgCoeffs: Record<string, { a: number; b: number; c: number; d: number }> = {
      A: { a: 0.22, b: 0.0001, c: 0.2, d: 0.0 },
      B: { a: 0.16, b: 0.0001, c: 0.12, d: 0.0 },
      C: { a: 0.11, b: 0.0001, c: 0.08, d: 0.0002 },
      D: { a: 0.08, b: 0.0001, c: 0.06, d: 0.0015 },
      E: { a: 0.06, b: 0.0001, c: 0.03, d: 0.0003 },
      F: { a: 0.04, b: 0.0001, c: 0.016, d: 0.0003 },
    };

    const coeff = pgCoeffs[stabilityClass];
    const x = downwindDistance;
    const y = crosswindDistance;
    const H = stackHeight;
    const u = windSpeed;
    const Q = releaseRate;

    // Calculate dispersion parameters
    const sigmaY = coeff.a * x * Math.pow(1 + coeff.b * x, -0.5);
    const sigmaZ = coeff.c * x * Math.pow(1 + coeff.d * x, -0.5);

    // Gaussian plume equation (ground level reflection)
    const concentration =
      (Q / (2 * Math.PI * u * sigmaY * sigmaZ)) *
      Math.exp((-y * y) / (2 * sigmaY * sigmaY)) *
      (Math.exp((-(0 - H) * (0 - H)) / (2 * sigmaZ * sigmaZ)) +
        Math.exp((-(0 + H) * (0 + H)) / (2 * sigmaZ * sigmaZ)));

    // Convert to ppm (assuming air at STP, MW=29)
    const concentrationPPM = (concentration * 24.45 * 1e6) / 29;

    return {
      groundLevelConcentration: {
        kgPerM3: concentration.toExponential(3),
        mgPerM3: Math.round(concentration * 1e6 * 100) / 100,
        ppmApprox: Math.round(concentrationPPM * 100) / 100,
      },
      dispersionParameters: {
        sigmaY: Math.round(sigmaY * 10) / 10,
        sigmaZ: Math.round(sigmaZ * 10) / 10,
        unit: "meters",
      },
      plumeWidth: {
        value: Math.round(4.3 * sigmaY),
        unit: "meters",
        description: "Approximate plume width (4.3σy)",
      },
      stabilityDescription: {
        A: "Very unstable (sunny, light winds)",
        B: "Moderately unstable",
        C: "Slightly unstable",
        D: "Neutral (overcast)",
        E: "Slightly stable",
        F: "Very stable (clear night, light winds)",
      }[stabilityClass],
    };
  },
});

/**
 * IDLH (Immediately Dangerous to Life or Health) distance calculator
 */
export const idlhDistanceCalculation = tool({
  description:
    "Calculate distance to IDLH concentration for toxic release. Critical for emergency response planning and consequence severity.",
  parameters: z.object({
    releaseRate: z.number().describe("Release rate in kg/s"),
    releaseHeight: z.number().describe("Release height in meters"),
    windSpeed: z.number().describe("Wind speed in m/s"),
    stabilityClass: z.enum(["A", "B", "C", "D", "E", "F"]).describe("Stability class"),
    idlhConcentration: z.number().describe("IDLH concentration in mg/m³"),
    erpg2Concentration: z.number().optional().describe("ERPG-2 concentration in mg/m³"),
  }),
  execute: async ({
    releaseRate,
    releaseHeight,
    windSpeed,
    stabilityClass,
    idlhConcentration,
    erpg2Concentration,
  }) => {
    // Iterative calculation to find IDLH distance
    const pgCoeffs: Record<string, { a: number; b: number; c: number; d: number }> = {
      A: { a: 0.22, b: 0.0001, c: 0.2, d: 0.0 },
      B: { a: 0.16, b: 0.0001, c: 0.12, d: 0.0 },
      C: { a: 0.11, b: 0.0001, c: 0.08, d: 0.0002 },
      D: { a: 0.08, b: 0.0001, c: 0.06, d: 0.0015 },
      E: { a: 0.06, b: 0.0001, c: 0.03, d: 0.0003 },
      F: { a: 0.04, b: 0.0001, c: 0.016, d: 0.0003 },
    };

    const coeff = pgCoeffs[stabilityClass];

    function calculateConcentration(x: number): number {
      const sigmaY = coeff.a * x * Math.pow(1 + coeff.b * x, -0.5);
      const sigmaZ = coeff.c * x * Math.pow(1 + coeff.d * x, -0.5);
      const H = releaseHeight;

      return (
        (releaseRate / (2 * Math.PI * windSpeed * sigmaY * sigmaZ)) *
        2 *
        Math.exp((-H * H) / (2 * sigmaZ * sigmaZ)) *
        1e6
      ); // mg/m³
    }

    // Binary search for IDLH distance
    let low = 10;
    let high = 50000;
    const targetConc = idlhConcentration;

    while (high - low > 10) {
      const mid = (low + high) / 2;
      const conc = calculateConcentration(mid);
      if (conc > targetConc) {
        low = mid;
      } else {
        high = mid;
      }
    }
    const idlhDistance = (low + high) / 2;

    // Calculate ERPG-2 distance if provided
    let erpg2Distance: number | undefined;
    if (erpg2Concentration) {
      low = 10;
      high = 100000;
      while (high - low > 10) {
        const mid = (low + high) / 2;
        const conc = calculateConcentration(mid);
        if (conc > erpg2Concentration) {
          low = mid;
        } else {
          high = mid;
        }
      }
      erpg2Distance = (low + high) / 2;
    }

    return {
      idlhDistance: {
        value: Math.round(idlhDistance),
        unit: "meters",
        miles: Math.round((idlhDistance / 1609.34) * 100) / 100,
      },
      erpg2Distance: erpg2Distance
        ? {
            value: Math.round(erpg2Distance),
            unit: "meters",
            miles: Math.round((erpg2Distance / 1609.34) * 100) / 100,
          }
        : undefined,
      evacuationZone: {
        immediate: Math.round(idlhDistance * 1.5),
        precautionary: erpg2Distance ? Math.round(erpg2Distance * 1.2) : Math.round(idlhDistance * 3),
        unit: "meters",
      },
      regulatoryImplications:
        idlhDistance > 1000
          ? [
              "EPA RMP worst-case scenario",
              "Offsite consequence analysis required",
              "Community notification required",
            ]
          : idlhDistance > 100
            ? ["On-site emergency response required", "OSHA PSM covered scenario"]
            : ["Localized impact", "Standard emergency procedures"],
    };
  },
});

/**
 * Vapor Cloud Explosion (VCE) overpressure calculation
 */
export const vaporCloudExplosion = tool({
  description:
    "Calculate overpressure effects from vapor cloud explosion using TNT equivalency. Used for flammable release consequence analysis.",
  parameters: z.object({
    massReleased: z.number().describe("Mass of flammable material released in kg"),
    heatOfCombustion: z.number().describe("Heat of combustion in kJ/kg"),
    yieldFactor: z
      .number()
      .default(0.03)
      .describe("Explosion yield factor (typically 0.01-0.1)"),
    distanceFromCenter: z.number().describe("Distance from explosion center in meters"),
  }),
  execute: async ({
    massReleased,
    heatOfCombustion,
    yieldFactor,
    distanceFromCenter,
  }) => {
    // TNT equivalency
    const tntHeat = 4680; // kJ/kg for TNT
    const tntEquivalent = (massReleased * heatOfCombustion * yieldFactor) / tntHeat;

    // Scaled distance (Hopkinson-Cranz scaling)
    const scaledDistance = distanceFromCenter / Math.pow(tntEquivalent, 1 / 3);

    // Peak overpressure (simplified Kingery-Bulmash)
    let overpressure: number;
    if (scaledDistance < 0.5) {
      overpressure = 1000; // Very close - structural collapse
    } else if (scaledDistance < 2) {
      overpressure = 200 / scaledDistance;
    } else if (scaledDistance < 10) {
      overpressure = 80 / Math.pow(scaledDistance, 1.5);
    } else {
      overpressure = 20 / Math.pow(scaledDistance, 2);
    }

    // Damage effects
    const damageEffects: string[] = [];
    if (overpressure > 35) damageEffects.push("Complete structural destruction");
    else if (overpressure > 15) damageEffects.push("Severe building damage, potential collapse");
    else if (overpressure > 7) damageEffects.push("Serious structural damage");
    else if (overpressure > 3.5) damageEffects.push("Moderate structural damage, glass breakage");
    else if (overpressure > 1) damageEffects.push("Minor structural damage, window breakage");
    else if (overpressure > 0.3) damageEffects.push("Glass breakage possible");

    // Human effects
    const humanEffects: string[] = [];
    if (overpressure > 35) humanEffects.push("Fatal - lung damage");
    else if (overpressure > 15) humanEffects.push("Serious injury likely");
    else if (overpressure > 7) humanEffects.push("Eardrum rupture, injuries from debris");
    else if (overpressure > 3.5) humanEffects.push("Knockdown, temporary hearing loss");
    else if (overpressure > 1) humanEffects.push("Minor injuries from flying glass");

    return {
      tntEquivalent: {
        value: Math.round(tntEquivalent * 10) / 10,
        unit: "kg TNT",
      },
      scaledDistance: {
        value: Math.round(scaledDistance * 100) / 100,
        unit: "m/kg^(1/3)",
      },
      peakOverpressure: {
        value: Math.round(overpressure * 100) / 100,
        unit: "kPa",
        psi: Math.round((overpressure * 0.145) * 100) / 100,
      },
      damageEffects,
      humanEffects,
      safeDistances: {
        fatality: Math.round(distanceFromCenter * Math.pow(35 / overpressure, 0.5)),
        seriousInjury: Math.round(distanceFromCenter * Math.pow(7 / overpressure, 0.5)),
        minorInjury: Math.round(distanceFromCenter * Math.pow(1 / overpressure, 0.5)),
        unit: "meters",
      },
    };
  },
});

/**
 * Pool fire radiation calculation
 */
export const poolFireRadiation = tool({
  description:
    "Calculate thermal radiation from pool fire. Used for flammable liquid spill consequence analysis.",
  parameters: z.object({
    poolDiameter: z.number().describe("Pool diameter in meters"),
    burningRate: z.number().describe("Mass burning rate in kg/(m²·s)"),
    heatOfCombustion: z.number().describe("Heat of combustion in kJ/kg"),
    radiativeFraction: z.number().default(0.3).describe("Fraction of heat radiated"),
    distanceFromPool: z.number().describe("Distance from pool edge in meters"),
    ambientTemperature: z.number().default(25).describe("Ambient temperature in °C"),
  }),
  execute: async ({
    poolDiameter,
    burningRate,
    heatOfCombustion,
    radiativeFraction,
    distanceFromPool,
    ambientTemperature,
  }) => {
    // Pool area
    const poolArea = (Math.PI * poolDiameter * poolDiameter) / 4;

    // Total heat release rate
    const totalHRR = burningRate * poolArea * heatOfCombustion; // kW

    // Flame height (Thomas correlation)
    const flameHeight = 42 * poolDiameter * Math.pow(burningRate / (1.2 * Math.sqrt(9.81 * poolDiameter)), 0.61);

    // Point source radiation at distance
    const radiatedPower = totalHRR * radiativeFraction;
    const distanceFromFlame = Math.sqrt(
      Math.pow(distanceFromPool + poolDiameter / 2, 2) + Math.pow(flameHeight / 2, 2)
    );
    const heatFlux = radiatedPower / (4 * Math.PI * distanceFromFlame * distanceFromFlame);

    // Human effects thresholds
    const effects: string[] = [];
    if (heatFlux > 37.5) effects.push("Immediate fatality");
    else if (heatFlux > 25) effects.push("Significant injury (1% fatality in 60s)");
    else if (heatFlux > 12.5) effects.push("Pain threshold, first-degree burns in 60s");
    else if (heatFlux > 4.7) effects.push("Safe for brief exposure");
    else if (heatFlux > 1.6) effects.push("Safe for extended exposure");

    // Equipment effects
    const equipmentEffects: string[] = [];
    if (heatFlux > 37.5) equipmentEffects.push("Steel structure damage");
    else if (heatFlux > 25) equipmentEffects.push("Cable/instrument damage");
    else if (heatFlux > 12.5) equipmentEffects.push("Plastic components affected");

    return {
      poolFire: {
        diameter: { value: poolDiameter, unit: "m" },
        area: { value: Math.round(poolArea * 10) / 10, unit: "m²" },
        flameHeight: { value: Math.round(flameHeight * 10) / 10, unit: "m" },
      },
      heatRelease: {
        total: { value: Math.round(totalHRR), unit: "kW" },
        radiated: { value: Math.round(radiatedPower), unit: "kW" },
      },
      thermalRadiation: {
        atDistance: distanceFromPool,
        heatFlux: { value: Math.round(heatFlux * 100) / 100, unit: "kW/m²" },
      },
      humanEffects: effects,
      equipmentEffects,
      safeDistances: {
        fatality: Math.round(Math.sqrt(radiatedPower / (4 * Math.PI * 37.5))),
        injury: Math.round(Math.sqrt(radiatedPower / (4 * Math.PI * 12.5))),
        safe: Math.round(Math.sqrt(radiatedPower / (4 * Math.PI * 4.7))),
        unit: "meters",
      },
    };
  },
});

export const consequenceModelingTools = {
  gaussianPlumeDispersion,
  idlhDistanceCalculation,
  vaporCloudExplosion,
  poolFireRadiation,
};
