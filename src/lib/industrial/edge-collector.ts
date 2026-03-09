import {
  IngestionMode,
  IngestionJobMetadata,
  RawIngestionRecord,
} from "./types";

export interface EdgeCollectorRunRequest {
  mode: IngestionMode;
  source: string;
  records: RawIngestionRecord[];
}

export interface EdgeCollectorRunResult {
  metadata: IngestionJobMetadata;
  raw: RawIngestionRecord[];
}

export function runEdgeCollector(
  request: EdgeCollectorRunRequest
): EdgeCollectorRunResult {
  const metadata: IngestionJobMetadata = {
    jobId: crypto.randomUUID(),
    mode: request.mode,
    source: request.source,
    startedAt: new Date().toISOString(),
    status: "processing",
    recordsIn: request.records.length,
    candidatesOut: 0,
    errors: [],
  };

  if (!request.records.length) {
    metadata.status = "failed";
    metadata.errors.push("No input records provided.");
    metadata.finishedAt = new Date().toISOString();
    return { metadata, raw: [] };
  }

  metadata.status = "completed";
  metadata.finishedAt = new Date().toISOString();

  return {
    metadata,
    raw: request.records,
  };
}
