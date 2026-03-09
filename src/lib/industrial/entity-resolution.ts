import { CandidateAssetRecord, CanonicalAsset } from "./types";

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveCanonicalAssets(candidates: CandidateAssetRecord[]): CanonicalAsset[] {
  const groups = new Map<string, CandidateAssetRecord[]>();

  for (const candidate of candidates) {
    const key = normalizeName(candidate.name);
    const existing = groups.get(key) || [];
    existing.push(candidate);
    groups.set(key, existing);
  }

  const canonical: CanonicalAsset[] = [];

  for (const [key, records] of groups.entries()) {
    const primary = records[0];
    canonical.push({
      id: `asset_${key}`,
      canonicalName: primary.name,
      aliases: Array.from(new Set(records.map((r) => r.name))),
      sourceIds: records.map((r) => `${r.source}:${r.sourceId}`),
      confidence: Math.min(0.99, 0.6 + records.length * 0.1),
      zone: primary.zone,
      vendor: primary.vendor,
      properties: {
        mergedFrom: records.length,
        candidateTypes: Array.from(new Set(records.map((r) => r.candidateType))),
      },
    });
  }

  return canonical;
}
