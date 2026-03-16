import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  sourceRecords,
  investmentEvents,
  permitOrMilestoneEvents,
  evidenceRecords,
} from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import {
  normalizeInvestmentEvent,
  normalizePermitEvent,
  normalizeEvidenceRecord,
  applyFilters,
} from "@/lib/signals/normalize";
import type { Signal, SignalsResponse } from "@/lib/signals/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseCommaSeparated(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const items = value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return items.length ? items : undefined;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sector = parseCommaSeparated(url.searchParams.get("sector"));
  const since = url.searchParams.get("since") || undefined;
  const signalType = parseCommaSeparated(url.searchParams.get("signalType"));
  const minRelevanceRaw = url.searchParams.get("minRelevance");
  const minRelevance = minRelevanceRaw ? parseInt(minRelevanceRaw, 10) : undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;

  try {
    const signals: Signal[] = [];

    const [investmentRows, permitRows, evidenceRows] = await Promise.all([
      fetchInvestmentEvents(),
      fetchPermitEvents(),
      fetchEvidenceRecords(),
    ]);

    for (const row of investmentRows) {
      try {
        signals.push(normalizeInvestmentEvent(row));
      } catch {
        // skip malformed rows
      }
    }

    for (const row of permitRows) {
      try {
        signals.push(normalizePermitEvent(row));
      } catch {
        // skip malformed rows
      }
    }

    for (const row of evidenceRows) {
      try {
        signals.push(normalizeEvidenceRecord(row));
      } catch {
        // skip malformed rows
      }
    }

    const { filtered, total } = applyFilters(signals, {
      sector,
      since,
      signalType,
      minRelevance,
      limit,
    });

    const response: SignalsResponse = {
      success: true,
      signals: filtered,
      meta: {
        total,
        filtered: filtered.length,
        timestamp: new Date().toISOString(),
        source: "ot-radar",
      },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        signals: [],
        meta: {
          total: 0,
          filtered: 0,
          timestamp: new Date().toISOString(),
          source: "ot-radar" as const,
        },
        error: message,
      },
      { status: 500 }
    );
  }
}

async function fetchInvestmentEvents() {
  try {
    const rows = await db
      .select({
        id: investmentEvents.id,
        eventType: investmentEvents.eventType,
        amount: investmentEvents.amount,
        recipientName: investmentEvents.recipientName,
        providerName: investmentEvents.providerName,
        programName: investmentEvents.programName,
        sectorNaics: investmentEvents.sectorNaics,
        techTags: investmentEvents.techTags,
        actionDate: investmentEvents.actionDate,
        announcedDate: investmentEvents.announcedDate,
        placeOfPerformance: investmentEvents.placeOfPerformance,
        recipientLocation: investmentEvents.recipientLocation,
        countyFips: investmentEvents.countyFips,
        sr_id: sourceRecords.id,
        sr_sourceSystem: sourceRecords.sourceSystem,
        sr_sourceRecordId: sourceRecords.sourceRecordId,
        sr_sourceUrl: sourceRecords.sourceUrl,
        sr_effectiveDate: sourceRecords.effectiveDate,
        sr_fetchedAt: sourceRecords.fetchedAt,
        sr_rawPayload: sourceRecords.rawPayload,
      })
      .from(investmentEvents)
      .innerJoin(sourceRecords, sql`${investmentEvents.sourceRecordId} = ${sourceRecords.id}`)
      .orderBy(desc(investmentEvents.actionDate))
      .limit(2000);

    return rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      amount: r.amount,
      recipientName: r.recipientName,
      providerName: r.providerName,
      programName: r.programName,
      sectorNaics: r.sectorNaics,
      techTags: r.techTags,
      actionDate: r.actionDate,
      announcedDate: r.announcedDate,
      placeOfPerformance: r.placeOfPerformance as Record<string, unknown> | null,
      recipientLocation: r.recipientLocation as Record<string, unknown> | null,
      countyFips: r.countyFips,
      sourceRecord: {
        id: r.sr_id,
        sourceSystem: r.sr_sourceSystem,
        sourceRecordId: r.sr_sourceRecordId,
        sourceUrl: r.sr_sourceUrl,
        effectiveDate: r.sr_effectiveDate,
        fetchedAt: r.sr_fetchedAt,
        rawPayload: r.sr_rawPayload,
      },
    }));
  } catch {
    return [];
  }
}

async function fetchPermitEvents() {
  try {
    const rows = await db
      .select({
        id: permitOrMilestoneEvents.id,
        eventType: permitOrMilestoneEvents.eventType,
        eventDate: permitOrMilestoneEvents.eventDate,
        permitProgram: permitOrMilestoneEvents.permitProgram,
        status: permitOrMilestoneEvents.status,
        notes: permitOrMilestoneEvents.notes,
        countyFips: permitOrMilestoneEvents.countyFips,
        responsibleAgency: permitOrMilestoneEvents.responsibleAgency,
        metadata: permitOrMilestoneEvents.metadata,
        sr_id: sourceRecords.id,
        sr_sourceSystem: sourceRecords.sourceSystem,
        sr_sourceRecordId: sourceRecords.sourceRecordId,
        sr_sourceUrl: sourceRecords.sourceUrl,
        sr_effectiveDate: sourceRecords.effectiveDate,
        sr_fetchedAt: sourceRecords.fetchedAt,
        sr_rawPayload: sourceRecords.rawPayload,
      })
      .from(permitOrMilestoneEvents)
      .innerJoin(sourceRecords, sql`${permitOrMilestoneEvents.sourceRecordId} = ${sourceRecords.id}`)
      .orderBy(desc(permitOrMilestoneEvents.eventDate))
      .limit(2000);

    return rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      eventDate: r.eventDate,
      permitProgram: r.permitProgram,
      status: r.status,
      notes: r.notes,
      countyFips: r.countyFips,
      responsibleAgency: r.responsibleAgency,
      metadata: r.metadata as Record<string, unknown> | null,
      sourceRecord: {
        id: r.sr_id,
        sourceSystem: r.sr_sourceSystem,
        sourceRecordId: r.sr_sourceRecordId,
        sourceUrl: r.sr_sourceUrl,
        effectiveDate: r.sr_effectiveDate,
        fetchedAt: r.sr_fetchedAt,
        rawPayload: r.sr_rawPayload,
      },
    }));
  } catch {
    return [];
  }
}

async function fetchEvidenceRecords() {
  try {
    const rows = await db
      .select({
        id: evidenceRecords.id,
        sourceName: evidenceRecords.sourceName,
        dataset: evidenceRecords.dataset,
        evidenceType: evidenceRecords.evidenceType,
        sourceUrl: evidenceRecords.sourceUrl,
        observedAt: evidenceRecords.observedAt,
        rawPayload: evidenceRecords.rawPayload,
        confidenceScore: evidenceRecords.confidenceScore,
      })
      .from(evidenceRecords)
      .orderBy(desc(evidenceRecords.observedAt))
      .limit(2000);

    return rows.map((r) => ({
      ...r,
      rawPayload: r.rawPayload as Record<string, unknown>,
    }));
  } catch {
    return [];
  }
}
