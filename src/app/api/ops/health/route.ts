import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date().toISOString();

  const env = {
    databaseUrl: Boolean(
      process.env.DATABASE_URL ||
        process.env.POSTGRES_URL ||
        process.env.POSTGRES_PRISMA_URL ||
        process.env.POSTGRES_URL_NON_POOLING
    ),
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    blobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  };

  const diagnostics: {
    dbConnected: boolean;
    dbError: string | null;
  } = {
    dbConnected: false,
    dbError: null,
  };

  try {
    await db.execute(sql`select 1`);
    diagnostics.dbConnected = true;
  } catch (error) {
    diagnostics.dbConnected = false;
    diagnostics.dbError = error instanceof Error ? error.message : "Unknown DB error";
  }

  const checks = {
    envConfigured: env.databaseUrl,
    dbConnected: diagnostics.dbConnected,
    dataBoundaryWritable: env.databaseUrl && diagnostics.dbConnected,
  };

  const ok = checks.envConfigured && checks.dbConnected;

  return NextResponse.json(
    {
      ok,
      timestamp: now,
      checks,
      env,
      diagnostics,
      guidance: ok
        ? "System healthy."
        : "Set DATABASE_URL in Vercel production and redeploy. Then verify dbConnected=true.",
    },
    { status: ok ? 200 : 503 }
  );
}
