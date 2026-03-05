// Voltage Stability Physics MCP
// Reactive margin and collapse proximity heuristics

import { tool } from "ai";
import { z } from "zod";

/**
 * Compute reactive reserve margin at a bus/area.
 */
export const reactivePowerMargin = tool({
  description:
    "Calculate reactive reserve margin and classify voltage stability posture at a bus, feeder, or area.",
  parameters: z.object({
    reactiveDemandMvar: z.number().describe("Current reactive demand in MVAr"),
    reactiveSupplyMvar: z.number().describe("Available reactive support in MVAr"),
    targetMarginPercent: z.number().default(15).describe("Target reserve margin percent"),
  }),
  execute: async ({ reactiveDemandMvar, reactiveSupplyMvar, targetMarginPercent }) => {
    const marginMvar = reactiveSupplyMvar - reactiveDemandMvar;
    const marginPct = reactiveDemandMvar > 0 ? (marginMvar / reactiveDemandMvar) * 100 : 0;
    const shortfallPct = targetMarginPercent - marginPct;

    return {
      reactiveMargin: {
        mvar: Math.round(marginMvar * 100) / 100,
        percent: Math.round(marginPct * 100) / 100,
      },
      targetMarginPercent,
      shortfallPercent: Math.round(Math.max(0, shortfallPct) * 100) / 100,
      assessment:
        marginPct < 0
          ? "CRITICAL - Reactive deficit (instability risk)"
          : marginPct < 5
            ? "HIGH - Very low reactive margin"
            : marginPct < targetMarginPercent
              ? "MEDIUM - Below target margin"
              : "LOW - Reactive margin is healthy",
    };
  },
});

/**
 * Estimate collapse proximity from voltage sensitivity and margin.
 */
export const voltageCollapseProximity = tool({
  description:
    "Estimate voltage collapse proximity using voltage sensitivity to load (dV/dP proxy) and reserve margin.",
  parameters: z.object({
    nominalVoltagePu: z.number().default(1.0).describe("Nominal voltage in per-unit"),
    currentVoltagePu: z.number().describe("Current measured voltage in per-unit"),
    dvdpPuPerPu: z.number().describe("Voltage sensitivity dV/dP (pu voltage drop per pu load increase)"),
    loadingPercent: z.number().describe("Current loading in percent"),
    reactiveMarginPercent: z.number().describe("Reactive reserve margin in percent"),
  }),
  execute: async ({
    nominalVoltagePu,
    currentVoltagePu,
    dvdpPuPerPu,
    loadingPercent,
    reactiveMarginPercent,
  }) => {
    const undervoltage = Math.max(0, nominalVoltagePu - currentVoltagePu);
    const sensitivityFactor = Math.max(0, dvdpPuPerPu) * Math.max(0.5, loadingPercent / 100);
    const qPenalty = reactiveMarginPercent < 0 ? 2 : reactiveMarginPercent < 5 ? 1.5 : reactiveMarginPercent < 15 ? 1.1 : 0.9;

    const rawIndex = (undervoltage * 100 + sensitivityFactor * 100) * qPenalty;
    const proximityIndex = Math.max(0, Math.min(100, rawIndex));

    return {
      collapseProximityIndex: Math.round(proximityIndex * 10) / 10,
      voltageDeltaPu: Math.round(undervoltage * 1000) / 1000,
      sensitivityFactor: Math.round(sensitivityFactor * 1000) / 1000,
      assessment:
        proximityIndex >= 70
          ? "CRITICAL - Near voltage collapse boundary"
          : proximityIndex >= 50
            ? "HIGH - Stressed voltage stability"
            : proximityIndex >= 30
              ? "MEDIUM - Monitor and prepare mitigation"
              : "LOW - Stable",
      recommendedActions:
        proximityIndex >= 50
          ? [
              "Increase dynamic reactive support in affected area",
              "Re-dispatch transfer paths to reduce stressed corridors",
              "Review UVLS/voltage control setpoints",
            ]
          : ["Continue monitoring and periodic contingency validation"],
    };
  },
});

export const voltageStabilityTools = {
  reactivePowerMargin,
  voltageCollapseProximity,
};
