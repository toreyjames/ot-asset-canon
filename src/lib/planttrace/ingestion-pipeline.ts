import {
  CandidateAssetRecord,
  IngestionJobMetadata,
  RawIngestionRecord,
} from "./types";

function inferCandidateType(record: RawIngestionRecord): CandidateAssetRecord["candidateType"] {
  const type = String(record.type || "").toLowerCase();
  if (type.includes("switch") || type.includes("router") || type.includes("firewall")) {
    return "network";
  }
  if (type.includes("line") || type.includes("process") || type.includes("system")) {
    return "process";
  }
  return "asset";
}

export function normalizeIngestionRecords(
  source: string,
  records: RawIngestionRecord[]
): CandidateAssetRecord[] {
  return records
    .map((record, index) => {
      const name = (record.name || `Unnamed-${index + 1}`).toString().trim();
      return {
        source,
        sourceId: (record.id || `${source}-${index + 1}`).toString(),
        candidateType: inferCandidateType(record),
        name,
        vendor: record.vendor?.toString(),
        zone: record.zone?.toString(),
        properties: { ...record },
      };
    })
    .filter((candidate) => candidate.name.length > 0);
}

export function finalizeIngestionMetadata(
  metadata: IngestionJobMetadata,
  candidates: CandidateAssetRecord[],
  errors: string[] = []
): IngestionJobMetadata {
  return {
    ...metadata,
    candidatesOut: candidates.length,
    errors,
    status: errors.length ? "failed" : "completed",
    finishedAt: new Date().toISOString(),
  };
}
