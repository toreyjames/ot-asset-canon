// Grid Power Flow Physics MCP
// Practical feeder/transformer calculations for planning and optimization

import { tool } from "ai";
import { z } from "zod";

/**
 * Estimate end-of-line feeder voltage using a simplified radial model.
 */
export const feederVoltageProfile = tool({
  description:
    "Estimate end-of-line feeder voltage and percent drop for radial distribution feeders using a simplified R/X line model.",
  parameters: z.object({
    sendingVoltageKv: z.number().describe("Sending-end line-to-line voltage in kV"),
    lineLengthKm: z.number().describe("Feeder length in km"),
    resistanceOhmPerKm: z.number().describe("Positive-sequence resistance in ohm/km"),
    reactanceOhmPerKm: z.number().describe("Positive-sequence reactance in ohm/km"),
    activePowerMw: z.number().describe("Downstream active power in MW"),
    reactivePowerMvar: z.number().default(0).describe("Downstream reactive power in MVAr"),
    phases: z.number().default(3).describe("Number of phases (default 3)"),
  }),
  execute: async ({
    sendingVoltageKv,
    lineLengthKm,
    resistanceOhmPerKm,
    reactanceOhmPerKm,
    activePowerMw,
    reactivePowerMvar,
    phases,
  }) => {
    const vll = sendingVoltageKv * 1000;
    const sMva = Math.sqrt(activePowerMw * activePowerMw + reactivePowerMvar * reactivePowerMvar);

    const currentA = sMva > 0 ? (sMva * 1e6) / (Math.sqrt(phases) * vll) : 0;
    const rTotal = resistanceOhmPerKm * lineLengthKm;
    const xTotal = reactanceOhmPerKm * lineLengthKm;

    const pf = sMva > 0 ? activePowerMw / sMva : 1;
    const sinPhi = sMva > 0 ? reactivePowerMvar / sMva : 0;

    // Approximate three-phase line-to-line voltage drop.
    const dropV = Math.sqrt(phases) * currentA * (rTotal * pf + xTotal * sinPhi);
    const recvVll = Math.max(vll - dropV, 0);
    const dropPct = vll > 0 ? (dropV / vll) * 100 : 0;

    return {
      sendingVoltage: { value: sendingVoltageKv, unit: "kV" },
      receivingVoltage: { value: Math.round((recvVll / 1000) * 1000) / 1000, unit: "kV" },
      voltageDrop: {
        volts: Math.round(dropV),
        percent: Math.round(dropPct * 100) / 100,
      },
      lineCurrent: { value: Math.round(currentA * 10) / 10, unit: "A" },
      assessment:
        dropPct > 8
          ? "CRITICAL - Excessive voltage drop likely violating planning limits"
          : dropPct > 5
            ? "HIGH - Elevated voltage drop; consider reconductoring/voltage support"
            : dropPct > 3
              ? "MEDIUM - Monitor during peak loading"
              : "LOW - Voltage profile appears healthy",
    };
  },
});

/**
 * Transformer loading and thermal margin check.
 */
export const transformerLoadingAnalysis = tool({
  description:
    "Calculate transformer loading, overload margin, and a simple thermal stress indicator for planning and operations.",
  parameters: z.object({
    transformerRatingMva: z.number().describe("Nameplate transformer rating in MVA"),
    presentLoadMw: z.number().describe("Present active load in MW"),
    presentLoadMvar: z.number().default(0).describe("Present reactive load in MVAr"),
    ambientTempC: z.number().default(30).describe("Ambient temperature in Celsius"),
    emergencyOverloadPercent: z.number().default(120).describe("Allowed emergency overload percent"),
  }),
  execute: async ({
    transformerRatingMva,
    presentLoadMw,
    presentLoadMvar,
    ambientTempC,
    emergencyOverloadPercent,
  }) => {
    const apparentMva = Math.sqrt(
      presentLoadMw * presentLoadMw + presentLoadMvar * presentLoadMvar,
    );

    const loadingPct = transformerRatingMva > 0 ? (apparentMva / transformerRatingMva) * 100 : 0;
    const emergencyMarginPct = emergencyOverloadPercent - loadingPct;

    // Simplified thermal stress proxy, useful for ranking not design.
    const thermalStressIndex = Math.max(0, loadingPct / 100) * Math.max(0.6, (ambientTempC + 20) / 50);

    return {
      apparentLoad: { value: Math.round(apparentMva * 1000) / 1000, unit: "MVA" },
      loading: { value: Math.round(loadingPct * 10) / 10, unit: "%" },
      emergencyMargin: { value: Math.round(emergencyMarginPct * 10) / 10, unit: "%" },
      thermalStressIndex: Math.round(thermalStressIndex * 1000) / 1000,
      assessment:
        loadingPct >= emergencyOverloadPercent
          ? "CRITICAL - Beyond emergency overload"
          : loadingPct >= 100
            ? "HIGH - Above nameplate; emergency mode"
            : loadingPct >= 85
              ? "MEDIUM - High utilization"
              : "LOW - Adequate margin",
    };
  },
});

export const powerFlowTools = {
  feederVoltageProfile,
  transformerLoadingAnalysis,
};
