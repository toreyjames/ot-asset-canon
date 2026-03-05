import { NextResponse } from "next/server";
import { z } from "zod";
import { put } from "@vercel/blob";

const IntakeSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  company: z.string().min(2).max(120),
  plants: z.number().int().min(1).max(1000),
  assets: z.number().int().min(100).max(2000000).nullable(),
  assetsUnknown: z.boolean(),
  plan: z.enum(["starter", "growth", "enterprise"]),
  goal: z.enum(["labor_reduction", "outage_reduction", "cmdb_quality"]),
  payback: z.enum(["lt_6", "6_12", "gt_12"]),
  budgetBand: z.enum(["up_to_10", "10_20", "20_plus"]),
  estimatedMonthly: z.number().min(0),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = IntakeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid intake payload" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const payload = { ...parsed.data, createdAt: now };

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (blobToken) {
      const key = `intake/${now}-${payload.company.replace(/[^a-zA-Z0-9-_]/g, "-")}.json`;
      await put(key, JSON.stringify(payload, null, 2), {
        access: "public",
        token: blobToken,
        contentType: "application/json",
        addRandomSuffix: true,
      });
    } else {
      console.log("[PlantTrace Intake]", payload);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Intake submission failed", error);
    return NextResponse.json({ error: "Failed to process intake" }, { status: 500 });
  }
}
