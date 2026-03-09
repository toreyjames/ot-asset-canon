import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateHybridDemoPack,
  type DemoPackType,
} from "@/lib/demo/hybrid-demo-generator";

const RequestSchema = z.object({
  pack: z
    .enum([
      "single_plant_baseline",
      "multi_plant_portfolio",
      "multi_tenant_operator",
      "cross_domain_showcase",
    ])
    .default("single_plant_baseline"),
  seedPrefix: z.string().optional(),
  maxAssetsPerSite: z.number().int().min(100).max(5000).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid demo request" }, { status: 400 });
    }

    const { pack, seedPrefix, maxAssetsPerSite } = parsed.data;
    const data = generateHybridDemoPack(pack as DemoPackType, seedPrefix);

    if (maxAssetsPerSite) {
      data.sites = data.sites.map((site) => ({
        ...site,
        assets: site.assets.slice(0, maxAssetsPerSite),
      }));
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Hybrid demo generation failed", error);
    return NextResponse.json({ error: "Failed to generate hybrid demo pack" }, { status: 500 });
  }
}
