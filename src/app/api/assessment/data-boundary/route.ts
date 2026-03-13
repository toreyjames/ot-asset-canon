import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { clientDataBoundarySettings, clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  DataBoundaryMode,
  deriveDataBoundaryPolicy,
  getDataBoundaryPolicyForOrg,
  normalizeOrgSlug,
  titleFromSlug,
} from "@/lib/data-boundary";

const SetDataBoundarySchema = z.object({
  orgSlug: z.string().min(1),
  mode: z.enum(["customer_agent", "customer_cloud", "hosted_pilot"]),
});

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const queryOrg = normalizeOrgSlug(url.searchParams.get("org"));
  const headerOrg = normalizeOrgSlug(req.headers.get("x-baseload-org"));
  const orgSlug = queryOrg ?? headerOrg;

  const policy = await getDataBoundaryPolicyForOrg(orgSlug);
  return NextResponse.json({ ok: true, policy });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = SetDataBoundarySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data-boundary payload" }, { status: 400 });
    }

    const orgSlug = normalizeOrgSlug(parsed.data.orgSlug);
    if (!orgSlug) {
      return NextResponse.json({ error: "orgSlug is required" }, { status: 400 });
    }

    const mode = parsed.data.mode as DataBoundaryMode;

    let client = await db.query.clients.findFirst({
      where: eq(clients.slug, orgSlug),
    });

    if (!client) {
      const [inserted] = await db
        .insert(clients)
        .values({
          name: titleFromSlug(orgSlug) || orgSlug,
          slug: orgSlug,
          active: true,
        })
        .returning();
      client = inserted;
    }

    await db
      .insert(clientDataBoundarySettings)
      .values({
        clientId: client.id,
        mode,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [clientDataBoundarySettings.clientId],
        set: {
          mode,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({
      ok: true,
      policy: deriveDataBoundaryPolicy(mode, orgSlug, "org_setting"),
    });
  } catch (error) {
    console.error("Failed to update data-boundary setting", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const missingDbUrl =
      message.includes("Database URL is not set") ||
      message.includes("DATABASE_URL environment variable is not set");
    return NextResponse.json(
      {
        error: missingDbUrl
          ? "Database connection is not configured in this environment"
          : "Failed to update data-boundary setting",
        code: missingDbUrl ? "DB_URL_MISSING" : "DATA_BOUNDARY_WRITE_FAILED",
        detail: message,
      },
      { status: missingDbUrl ? 503 : 500 }
    );
  }
}
