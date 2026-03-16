import {
  IngestionJobMetadata,
  IngestionMode,
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
  const now = new Date().toISOString();

  return {
    metadata: {
      jobId: crypto.randomUUID(),
      mode: request.mode,
      source: request.source,
      startedAt: now,
      finishedAt: now,
      status: "completed",
      recordsIn: request.records.length,
      candidatesOut: 0,
      errors: [],
    },
    raw: request.records,
  };
}
