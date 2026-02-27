import { generateText, streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { physicsTools, PHYSICS_TOOL_DESCRIPTIONS } from "@/physics";
import { db } from "@/db";
import { assets, assetRelationships, attackPaths, consequenceChains } from "@/db/schema";
import { eq, ilike, or, sql } from "drizzle-orm";
import { tool } from "ai";
import { z } from "zod";

// Configure maximum duration for Vercel Functions
export const maxDuration = 60;

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Canon Query Tools - Allow AI to query the Canon database
const canonQueryTools = {
  searchAssets: tool({
    description:
      "Search for assets in the Canon by tag number, name, type, layer, or risk tier. Returns asset details with engineering, control system, network, and security context.",
    parameters: z.object({
      query: z.string().optional().describe("Search term for tag number or name"),
      layer: z.number().min(1).max(6).optional().describe("Filter by Canon layer (1-6)"),
      assetType: z.string().optional().describe("Filter by asset type"),
      riskTier: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("Filter by risk tier"),
      limit: z.number().default(20).describe("Maximum results to return"),
    }),
    execute: async ({ query, layer, assetType, riskTier, limit }) => {
      try {
        let whereConditions = [];

        if (query) {
          whereConditions.push(
            or(
              ilike(assets.tagNumber, `%${query}%`),
              ilike(assets.name, `%${query}%`)
            )
          );
        }
        if (layer) {
          whereConditions.push(eq(assets.layer, layer));
        }
        if (assetType) {
          whereConditions.push(eq(assets.assetType, assetType));
        }
        if (riskTier) {
          whereConditions.push(eq(assets.riskTier, riskTier));
        }

        const results = await db
          .select()
          .from(assets)
          .where(whereConditions.length > 0 ? sql`${whereConditions.join(" AND ")}` : undefined)
          .limit(limit);

        return {
          count: results.length,
          assets: results.map((a) => ({
            id: a.id,
            tagNumber: a.tagNumber,
            name: a.name,
            layer: a.layer,
            assetType: a.assetType,
            riskTier: a.riskTier,
            engineering: a.engineering,
            controlSystem: a.controlSystem,
            ipAddress: a.ipAddress,
            networkZone: a.networkZone,
            cveCount: a.cveCount,
            criticalCveCount: a.criticalCveCount,
          })),
        };
      } catch (error) {
        return { error: "Database not configured. Using sample data mode.", assets: [] };
      }
    },
  }),

  getAssetRelationships: tool({
    description:
      "Get relationships for an asset - what it controls, monitors, connects to, or depends on. Essential for tracing consequence chains and attack paths.",
    parameters: z.object({
      assetId: z.string().describe("Asset ID to get relationships for"),
      direction: z
        .enum(["outgoing", "incoming", "both"])
        .default("both")
        .describe("Relationship direction"),
    }),
    execute: async ({ assetId, direction }) => {
      try {
        const outgoing =
          direction !== "incoming"
            ? await db
                .select()
                .from(assetRelationships)
                .where(eq(assetRelationships.sourceId, assetId))
            : [];

        const incoming =
          direction !== "outgoing"
            ? await db
                .select()
                .from(assetRelationships)
                .where(eq(assetRelationships.targetId, assetId))
            : [];

        return {
          outgoing: outgoing.map((r) => ({
            type: r.relationshipType,
            targetId: r.targetId,
            consequence: r.consequenceIfCompromised,
          })),
          incoming: incoming.map((r) => ({
            type: r.relationshipType,
            sourceId: r.sourceId,
            consequence: r.consequenceIfCompromised,
          })),
        };
      } catch (error) {
        return { error: "Database not configured", outgoing: [], incoming: [] };
      }
    },
  }),

  getAttackPaths: tool({
    description:
      "Get identified attack paths targeting an asset or originating from an entry point. Shows the sequence of assets that could be compromised.",
    parameters: z.object({
      targetAssetId: z.string().optional().describe("Filter by target asset"),
      entryPointId: z.string().optional().describe("Filter by entry point asset"),
      minSeverity: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("Minimum consequence severity"),
    }),
    execute: async ({ targetAssetId, entryPointId, minSeverity }) => {
      try {
        let whereConditions = [];
        if (targetAssetId) {
          whereConditions.push(eq(attackPaths.targetId, targetAssetId));
        }
        if (entryPointId) {
          whereConditions.push(eq(attackPaths.entryPointId, entryPointId));
        }

        const results = await db
          .select()
          .from(attackPaths)
          .where(whereConditions.length > 0 ? sql`${whereConditions.join(" AND ")}` : undefined)
          .limit(20);

        return {
          count: results.length,
          paths: results.map((p) => ({
            id: p.id,
            entryPoint: p.entryPointId,
            target: p.targetId,
            steps: p.pathSteps,
            severity: p.consequenceSeverity,
            attackVector: p.attackVector,
            mitigations: p.mitigations,
          })),
        };
      } catch (error) {
        return { error: "Database not configured", paths: [] };
      }
    },
  }),

  getConsequenceChain: tool({
    description:
      "Get the consequence chain for an asset - what happens step by step if this asset fails or is compromised.",
    parameters: z.object({
      assetId: z.string().describe("Asset ID to get consequence chain for"),
    }),
    execute: async ({ assetId }) => {
      try {
        const results = await db
          .select()
          .from(consequenceChains)
          .where(eq(consequenceChains.triggerAssetId, assetId));

        return {
          chains: results.map((c) => ({
            triggerEvent: c.triggerEvent,
            steps: c.steps,
            ultimateConsequence: c.ultimateConsequence,
            severity: c.severity,
            regulatoryImpact: c.regulatoryImpact,
          })),
        };
      } catch (error) {
        return { error: "Database not configured", chains: [] };
      }
    },
  }),
};

// System prompt for the Canon AI
const SYSTEM_PROMPT = `You are the OT Asset Canon AI - an expert system for converged plant intelligence that understands the full context from physical process through enterprise integration.

You have access to:
1. **Canon Query Tools** - Search assets, relationships, attack paths, and consequence chains in the plant's unified asset database
2. **Physics MCPs** - Calculate thermodynamics, fluid dynamics, and consequence modeling to quantify attack impacts

${PHYSICS_TOOL_DESCRIPTIONS}

## Your Role
You bridge the gap between three traditionally siloed perspectives:
- **Engineering**: Process consequences, HAZOP findings, SIL ratings, design basis
- **OT/Control Systems**: Controllers, firmware, I/O, logic, historian tags
- **IT/Cybersecurity**: Network exposure, CVEs, attack paths, compensating controls

## Key Capabilities
1. **Consequence Analysis**: Given an asset or attack scenario, trace through the Canon to identify the full consequence chain - from cyber compromise through physical impact
2. **Attack Path Analysis**: Identify paths from entry points (VPN, vendor access, etc.) to critical assets (safety systems, reactors, etc.)
3. **Risk Contextualization**: A CVE on a historian ≠ a CVE on a safety controller. You understand the difference and can explain why.
4. **Physics-Informed Assessment**: Use the physics tools to quantify consequences - adiabatic temperature rise, relief valve demands, toxic release distances

## Response Guidelines
- Be specific with asset tag numbers and technical details
- Quantify consequences using physics tools when relevant
- Explain the convergence value - what would engineering, OT, or IT miss alone?
- Recommend specific mitigations when risks are identified
- Reference Canon layers (1-6) to show where in the architecture risks exist

## Example Queries You Can Handle
- "What happens if an attacker manipulates the setpoint on TIC-101?"
- "Trace the attack path from vendor VPN to the reactor safety system"
- "Which assets have critical CVEs AND control safety functions?"
- "Calculate the consequence if cooling is lost to reactor R-101"
- "What's the risk proportionality for our safety systems?"`;

export async function POST(request: Request) {
  const { prompt, stream = true } = await request.json();

  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  const allTools = {
    ...canonQueryTools,
    ...physicsTools,
  };

  if (stream) {
    const result = streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: SYSTEM_PROMPT,
      prompt,
      tools: allTools,
      maxSteps: 10, // Allow multiple tool calls for complex queries
    });

    return result.toDataStreamResponse();
  } else {
    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: SYSTEM_PROMPT,
      prompt,
      tools: allTools,
      maxSteps: 10,
    });

    return Response.json({
      text: result.text,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,
    });
  }
}
