// Grid Contingency Physics MCP
// N-1 screening and outage impact estimation

import { tool } from "ai";
import { z } from "zod";

/**
 * Estimate post-contingency loading under a single outage using transfer factors.
 */
export const nMinusOneContingencyScreen = tool({
  description:
    "Screen N-1 contingency impact by estimating post-outage element loading using precomputed transfer factors.",
  parameters: z.object({
    monitoredElementName: z.string().describe("Name of monitored line/transformer"),
    baseLoadingPercent: z.number().describe("Pre-contingency loading percent"),
    transferFactor: z
      .number()
      .describe("Incremental loading factor on monitored element per 1.0 pu outage transfer"),
    outageTransferPu: z.number().describe("Expected transfer in pu after outage"),
    emergencyLimitPercent: z.number().default(120).describe("Emergency thermal limit in percent"),
  }),
  execute: async ({
    monitoredElementName,
    baseLoadingPercent,
    transferFactor,
    outageTransferPu,
    emergencyLimitPercent,
  }) => {
    const deltaLoading = transferFactor * outageTransferPu * 100;
    const postLoading = baseLoadingPercent + deltaLoading;
    const overload = Math.max(0, postLoading - emergencyLimitPercent);

    return {
      monitoredElement: monitoredElementName,
      baseLoadingPercent: Math.round(baseLoadingPercent * 10) / 10,
      postContingencyLoadingPercent: Math.round(postLoading * 10) / 10,
      overloadPercent: Math.round(overload * 10) / 10,
      assessment:
        postLoading > emergencyLimitPercent
          ? "CRITICAL - N-1 violation"
          : postLoading > 100
            ? "HIGH - Above normal rating under contingency"
            : postLoading > 85
              ? "MEDIUM - Tight contingency margin"
              : "LOW - N-1 margin appears acceptable",
    };
  },
});

/**
 * Score site-level resilience to single-element outages.
 */
export const outageResilienceScore = tool({
  description:
    "Calculate a simple resilience score based on critical-load coverage, backup depth, and restoration time assumptions.",
  parameters: z.object({
    criticalLoadMw: z.number().describe("Critical load in MW"),
    backupSupplyMw: z.number().describe("Firm backup supply available in MW"),
    avgRestorationHours: z.number().describe("Expected average restoration time in hours"),
    blackStartCapable: z.boolean().default(false).describe("Whether local black-start capability exists"),
  }),
  execute: async ({
    criticalLoadMw,
    backupSupplyMw,
    avgRestorationHours,
    blackStartCapable,
  }) => {
    const coverageRatio = criticalLoadMw > 0 ? backupSupplyMw / criticalLoadMw : 0;
    const coverageScore = Math.min(1, coverageRatio) * 50;
    const restorationScore = Math.max(0, Math.min(1, (24 - avgRestorationHours) / 24)) * 40;
    const blackStartScore = blackStartCapable ? 10 : 0;
    const totalScore = coverageScore + restorationScore + blackStartScore;

    return {
      resilienceScore: Math.round(totalScore * 10) / 10,
      scoreBreakdown: {
        backupCoverage: Math.round(coverageScore * 10) / 10,
        restoration: Math.round(restorationScore * 10) / 10,
        blackStart: blackStartScore,
      },
      backupCoveragePercent: Math.round(Math.min(coverageRatio, 2) * 1000) / 10,
      assessment:
        totalScore >= 80
          ? "HIGH - Strong contingency resilience"
          : totalScore >= 60
            ? "MEDIUM - Acceptable but improvable"
            : totalScore >= 40
              ? "LOW - Significant resilience gaps"
              : "CRITICAL - Outage resilience is weak",
    };
  },
});

export const contingencyTools = {
  nMinusOneContingencyScreen,
  outageResilienceScore,
};
