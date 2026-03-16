import { z } from "zod";

export const IndustrialOpportunitySummaryRequestSchema = z.object({
  rollup: z.enum(["county", "cbsa", "state"]).default("county"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  eventTypes: z
    .array(
      z.enum([
        "federal_award",
        "incentive_award",
        "financing_commitment",
        "capex_announcement",
        "grant_opportunity",
        "loan_commitment",
      ])
    )
    .optional(),
  amountTypes: z
    .array(z.enum(["obligation", "outlay", "commitment", "estimate"]))
    .optional(),
  countyFips: z.array(z.string().length(5)).optional(),
  cbsaCodes: z.array(z.string().length(5)).optional(),
  stateFips: z.array(z.string().length(2)).optional(),
  naicsPrefixes: z.array(z.string().min(2).max(6)).optional(),
  techTags: z.array(z.string().min(1)).optional(),
  minimumAmount: z.number().nonnegative().optional(),
  includePermits: z.boolean().optional().default(true),
});
