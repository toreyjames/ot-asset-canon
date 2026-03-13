import { db } from "@/db";
import { clientDataBoundarySettings, clients } from "@/db/schema";
import { eq } from "drizzle-orm";

export type DataBoundaryMode = "customer_agent" | "customer_cloud" | "hosted_pilot";

export interface DataBoundaryPolicy {
  orgSlug: string | null;
  mode: DataBoundaryMode;
  rawStorage: "customer_environment_only" | "hosted_raw_pilot" | "metadata_only";
  intakeStorage: "customer_environment_only" | "hosted_intake_pilot" | "metadata_only";
  hostedRawUploadsEnabled: boolean;
  hostedIntakeStorageEnabled: boolean;
  source: "default" | "org_setting";
}

export function normalizeOrgSlug(input: string | null | undefined): string | null {
  if (!input) return null;
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || null;
}

export function deriveDataBoundaryPolicy(
  mode: DataBoundaryMode,
  orgSlug: string | null,
  source: "default" | "org_setting"
): DataBoundaryPolicy {
  const allowHostedRawGlobal = process.env.BASELINE_ALLOW_HOSTED_RAW_UPLOADS === "true";
  const allowHostedIntakeGlobal = process.env.BASELINE_ALLOW_HOSTED_INTAKE_STORAGE === "true";

  const hostedRawUploadsEnabled = mode === "hosted_pilot" && allowHostedRawGlobal;
  const hostedIntakeStorageEnabled = mode === "hosted_pilot" && allowHostedIntakeGlobal;

  return {
    orgSlug,
    mode,
    rawStorage:
      mode === "customer_agent"
        ? "customer_environment_only"
        : hostedRawUploadsEnabled
        ? "hosted_raw_pilot"
        : "metadata_only",
    intakeStorage:
      mode === "customer_agent"
        ? "customer_environment_only"
        : hostedIntakeStorageEnabled
        ? "hosted_intake_pilot"
        : "metadata_only",
    hostedRawUploadsEnabled,
    hostedIntakeStorageEnabled,
    source,
  };
}

export async function getDataBoundaryPolicyForOrg(
  orgSlugInput: string | null | undefined
): Promise<DataBoundaryPolicy> {
  const orgSlug = normalizeOrgSlug(orgSlugInput);
  if (!orgSlug) {
    return deriveDataBoundaryPolicy("customer_agent", null, "default");
  }

  try {
    const client = await db.query.clients.findFirst({
      where: eq(clients.slug, orgSlug),
    });

    if (!client) {
      return deriveDataBoundaryPolicy("customer_agent", orgSlug, "default");
    }

    const settings = await db.query.clientDataBoundarySettings.findFirst({
      where: eq(clientDataBoundarySettings.clientId, client.id),
    });

    const mode =
      settings?.mode === "customer_agent" ||
      settings?.mode === "customer_cloud" ||
      settings?.mode === "hosted_pilot"
        ? settings.mode
        : "customer_agent";

    return deriveDataBoundaryPolicy(mode, orgSlug, settings ? "org_setting" : "default");
  } catch {
    return deriveDataBoundaryPolicy("customer_agent", orgSlug, "default");
  }
}

export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
