import { CanonicalAsset, CandidateAssetRecord } from "./types";

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

export function resolveCanonicalAssets(
  candidates: CandidateAssetRecord[]
): CanonicalAsset[] {
  const canonicalMap = new Map<string, CanonicalAsset>();

  for (const candidate of candidates) {
    const key = normalizeName(candidate.name);
    const existing = canonicalMap.get(key);

    if (existing) {
      existing.aliases = Array.from(new Set([...existing.aliases, candidate.name]));
      existing.sourceIds = Array.from(new Set([...existing.sourceIds, candidate.sourceId]));
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      continue;
    }

    canonicalMap.set(key, {
      id: crypto.randomUUID(),
      canonicalName: candidate.name,
      aliases: [candidate.name],
      sourceIds: [candidate.sourceId],
      confidence: 0.6,
      zone: candidate.zone,
      vendor: candidate.vendor,
      properties: candidate.properties || {},
    });
  }

  return Array.from(canonicalMap.values());
}
