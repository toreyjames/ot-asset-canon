import { and, desc, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { geoDim, investmentEvents, permitOrMilestoneEvents } from "@/db/schema";
import {
  isSupabaseServerConfigured,
  supabaseServerFetch,
  supabaseServerFetchAll,
} from "@/lib/platform/supabase-server";
import {
  OpportunityFilter,
  OpportunitySummaryResponse,
  OpportunitySummaryRow,
  OpportunityRollup,
} from "./opportunity-types";

type SummaryRowRecord = {
  geographyCode: string | null;
  geographyLabel: string | null;
  totalAmountUsd: string | number | null;
  eventCount: number;
  jobsEstimate: number | null;
  manufacturingEmployment: number | null;
  establishmentCount: number | null;
  latestActionDate: Date | null;
};

type SupabaseInvestmentRow = {
  geo_id: string | null;
  event_type: string;
  amount: string | number | null;
  amount_type: string;
  sector_naics: string | null;
  tech_tags: string[] | null;
  jobs_estimate: number | null;
  action_date: string | null;
};

type SupabasePermitRow = {
  geo_id: string | null;
  event_date: string;
  county_fips: string | null;
  cbsa_code: string | null;
};

type SupabaseGeoRow = {
  id: string;
  county_fips: string | null;
  state_fips: string | null;
  state_code: string | null;
  county_name: string | null;
  cbsa_code: string | null;
  cbsa_name: string | null;
  manufacturing_employment: number | null;
  establishment_count: number | null;
};

function rollupColumns(rollup: OpportunityRollup) {
  switch (rollup) {
    case "cbsa":
      return {
        code: geoDim.cbsaCode,
        label: geoDim.cbsaName,
      };
    case "state":
      return {
        code: geoDim.stateFips,
        label: geoDim.stateCode,
      };
    case "county":
    default:
      return {
        code: geoDim.countyFips,
        label: geoDim.countyName,
      };
  }
}

function buildInvestmentFilters(filter: OpportunityFilter) {
  const predicates = [];

  if (filter.startDate) {
    predicates.push(gte(investmentEvents.actionDate, new Date(filter.startDate)));
  }

  if (filter.endDate) {
    predicates.push(lte(investmentEvents.actionDate, new Date(filter.endDate)));
  }

  if (filter.eventTypes?.length) {
    predicates.push(inArray(investmentEvents.eventType, filter.eventTypes));
  }

  if (filter.amountTypes?.length) {
    predicates.push(inArray(investmentEvents.amountType, filter.amountTypes));
  }

  if (filter.countyFips?.length) {
    predicates.push(inArray(investmentEvents.countyFips, filter.countyFips));
  }

  if (filter.cbsaCodes?.length) {
    predicates.push(inArray(investmentEvents.cbsaCode, filter.cbsaCodes));
  }

  if (filter.stateFips?.length) {
    predicates.push(inArray(geoDim.stateFips, filter.stateFips));
  }

  if (filter.minimumAmount !== undefined) {
    predicates.push(gte(investmentEvents.amount, String(filter.minimumAmount)));
  }

  if (filter.naicsPrefixes?.length) {
    predicates.push(
      sql<boolean>`(${investmentEvents.sectorNaics} is not null and (${sql.join(
        filter.naicsPrefixes.map(
          (prefix) => sql`${investmentEvents.sectorNaics} like ${`${prefix}%`}`
        ),
        sql` or `
      )}))`
    );
  }

  if (filter.techTags?.length) {
    predicates.push(
      sql<boolean>`${investmentEvents.techTags} ?| array[${sql.join(
        filter.techTags.map((tag) => sql`${tag}`),
        sql`, `
      )}]`
    );
  }

  return predicates;
}

function matchesFilter(
  row: SupabaseInvestmentRow,
  geo: SupabaseGeoRow | undefined,
  filter: OpportunityFilter
) {
  if (filter.startDate && (!row.action_date || row.action_date < filter.startDate)) {
    return false;
  }

  if (filter.endDate && (!row.action_date || row.action_date > filter.endDate)) {
    return false;
  }

  if (filter.eventTypes?.length && !filter.eventTypes.includes(row.event_type as never)) {
    return false;
  }

  if (filter.amountTypes?.length && !filter.amountTypes.includes(row.amount_type as never)) {
    return false;
  }

  if (filter.minimumAmount !== undefined && Number(row.amount || 0) < filter.minimumAmount) {
    return false;
  }

  if (filter.countyFips?.length && !filter.countyFips.includes(geo?.county_fips || "")) {
    return false;
  }

  if (filter.cbsaCodes?.length && !filter.cbsaCodes.includes(geo?.cbsa_code || "")) {
    return false;
  }

  if (filter.stateFips?.length && !filter.stateFips.includes(geo?.state_fips || "")) {
    return false;
  }

  if (
    filter.naicsPrefixes?.length &&
    !filter.naicsPrefixes.some((prefix) => (row.sector_naics || "").startsWith(prefix))
  ) {
    return false;
  }

  if (
    filter.techTags?.length &&
    !filter.techTags.some((tag) => (row.tech_tags || []).includes(tag))
  ) {
    return false;
  }

  return true;
}

function geographyForRollup(
  rollup: OpportunityRollup,
  geo: SupabaseGeoRow | undefined
): { code: string | null; label: string | null } {
  if (!geo) {
    return { code: null, label: null };
  }

  switch (rollup) {
    case "cbsa":
      return { code: geo.cbsa_code, label: geo.cbsa_name };
    case "state":
      return { code: geo.state_fips, label: geo.state_code };
    case "county":
    default:
      return { code: geo.county_fips, label: geo.county_name };
  }
}

async function summarizeViaSupabase(
  filter: OpportunityFilter
): Promise<OpportunitySummaryResponse> {
  const [geoRows, investmentRows, permitRows] = await Promise.all([
    supabaseServerFetchAll(
      "geo_dim?select=id,county_fips,state_fips,state_code,county_name,cbsa_code,cbsa_name,manufacturing_employment,establishment_count"
    ) as Promise<SupabaseGeoRow[]>,
    supabaseServerFetchAll(
      "investment_events?select=geo_id,event_type,amount,amount_type,sector_naics,tech_tags,jobs_estimate,action_date"
    ) as Promise<SupabaseInvestmentRow[]>,
    filter.includePermits
      ? (supabaseServerFetchAll(
          "permit_or_milestone_events?select=geo_id,event_date,county_fips,cbsa_code"
        ) as Promise<SupabasePermitRow[]>)
      : Promise.resolve([]),
  ]);

  const geoById = new Map(geoRows.map((row) => [row.id, row]));
  const permitCountByGeoCode = new Map<string, number>();

  for (const permit of permitRows) {
    const geo = permit.geo_id ? geoById.get(permit.geo_id) : undefined;
    const geography = geographyForRollup(filter.rollup, geo);
    if (!geography.code) continue;

    if (filter.startDate && permit.event_date < filter.startDate) continue;
    if (filter.endDate && permit.event_date > filter.endDate) continue;
    if (filter.countyFips?.length && !filter.countyFips.includes(geo?.county_fips || "")) continue;
    if (filter.cbsaCodes?.length && !filter.cbsaCodes.includes(geo?.cbsa_code || "")) continue;
    if (filter.stateFips?.length && !filter.stateFips.includes(geo?.state_fips || "")) continue;

    permitCountByGeoCode.set(
      geography.code,
      (permitCountByGeoCode.get(geography.code) || 0) + 1
    );
  }

  const aggregates = new Map<
    string,
    OpportunitySummaryRow & {
      manufacturingEmployment?: number | null;
      establishmentCount?: number | null;
    }
  >();

  for (const row of investmentRows) {
    const geo = row.geo_id ? geoById.get(row.geo_id) : undefined;
    if (!matchesFilter(row, geo, filter)) continue;

    const geography = geographyForRollup(filter.rollup, geo);
    if (!geography.code) continue;

    const existing = aggregates.get(geography.code) || {
      geographyType: filter.rollup,
      geographyCode: geography.code,
      geographyLabel: geography.label || geography.code,
      totalAmountUsd: 0,
      eventCount: 0,
      permitEventCount: permitCountByGeoCode.get(geography.code) || 0,
      jobsEstimate: 0,
      latestActionDate: null,
      manufacturingEmployment: geo?.manufacturing_employment,
      establishmentCount: geo?.establishment_count,
    };

    existing.totalAmountUsd += Number(row.amount || 0);
    existing.eventCount += 1;
    existing.jobsEstimate += Number(row.jobs_estimate || 0);
    existing.latestActionDate =
      !existing.latestActionDate || (row.action_date && row.action_date > existing.latestActionDate)
        ? row.action_date
        : existing.latestActionDate;

    aggregates.set(geography.code, existing);
  }

  const rows = Array.from(aggregates.values())
    .map((row) => ({
      geographyType: row.geographyType,
      geographyCode: row.geographyCode,
      geographyLabel: row.geographyLabel,
      totalAmountUsd: row.totalAmountUsd,
      eventCount: row.eventCount,
      permitEventCount: row.permitEventCount,
      jobsEstimate: row.jobsEstimate,
      amountPerManufacturingWorker:
        row.manufacturingEmployment && row.manufacturingEmployment > 0
          ? row.totalAmountUsd / row.manufacturingEmployment
          : undefined,
      amountPerEstablishment:
        row.establishmentCount && row.establishmentCount > 0
          ? row.totalAmountUsd / row.establishmentCount
          : undefined,
      latestActionDate: row.latestActionDate,
    }))
    .sort((a, b) => b.totalAmountUsd - a.totalAmountUsd);

  return {
    rollup: filter.rollup,
    generatedAt: new Date().toISOString(),
    filtersApplied: filter,
    rows,
  };
}

async function summarizeViaDatabase(
  filter: OpportunityFilter
): Promise<OpportunitySummaryResponse> {
  const rollup = rollupColumns(filter.rollup);
  const predicates = buildInvestmentFilters(filter);
  const permitCounts = await loadPermitCounts(filter);

  const rows = await db
    .select({
      geographyCode: rollup.code,
      geographyLabel: rollup.label,
      totalAmountUsd: sql<string>`coalesce(sum(${investmentEvents.amount}), 0)`,
      eventCount: sql<number>`count(*)`,
      jobsEstimate: sql<number>`coalesce(sum(${investmentEvents.jobsEstimate}), 0)`,
      manufacturingEmployment: geoDim.manufacturingEmployment,
      establishmentCount: geoDim.establishmentCount,
      latestActionDate: sql<Date>`max(${investmentEvents.actionDate})`,
    })
    .from(investmentEvents)
    .leftJoin(geoDim, sql`${investmentEvents.geoId} = ${geoDim.id}`)
    .where(predicates.length ? and(...predicates) : undefined)
    .groupBy(
      rollup.code,
      rollup.label,
      geoDim.manufacturingEmployment,
      geoDim.establishmentCount
    )
    .orderBy(desc(sql`coalesce(sum(${investmentEvents.amount}), 0)`));

  const summaryRows: OpportunitySummaryRow[] = rows
    .filter((row: SummaryRowRecord) => row.geographyCode)
    .map((row: SummaryRowRecord) => {
      const totalAmountUsd = Number(row.totalAmountUsd || 0);
      const manufacturingEmployment = row.manufacturingEmployment || 0;
      const establishmentCount = row.establishmentCount || 0;
      const geographyCode = row.geographyCode as string;

      return {
        geographyType: filter.rollup,
        geographyCode,
        geographyLabel: row.geographyLabel || geographyCode,
        totalAmountUsd,
        eventCount: Number(row.eventCount || 0),
        permitEventCount: permitCounts.get(geographyCode) || 0,
        jobsEstimate: Number(row.jobsEstimate || 0),
        amountPerManufacturingWorker:
          manufacturingEmployment > 0 ? totalAmountUsd / manufacturingEmployment : undefined,
        amountPerEstablishment:
          establishmentCount > 0 ? totalAmountUsd / establishmentCount : undefined,
        latestActionDate: row.latestActionDate?.toISOString() || null,
      };
    });

  return {
    rollup: filter.rollup,
    generatedAt: new Date().toISOString(),
    filtersApplied: filter,
    rows: summaryRows,
  };
}

async function loadPermitCounts(filter: OpportunityFilter): Promise<Map<string, number>> {
  if (!filter.includePermits) {
    return new Map();
  }

  const rollup = rollupColumns(filter.rollup);
  const predicates = [];

  if (filter.startDate) {
    predicates.push(gte(permitOrMilestoneEvents.eventDate, new Date(filter.startDate)));
  }

  if (filter.endDate) {
    predicates.push(lte(permitOrMilestoneEvents.eventDate, new Date(filter.endDate)));
  }

  if (filter.countyFips?.length) {
    predicates.push(inArray(permitOrMilestoneEvents.countyFips, filter.countyFips));
  }

  if (filter.cbsaCodes?.length) {
    predicates.push(inArray(permitOrMilestoneEvents.cbsaCode, filter.cbsaCodes));
  }

  if (filter.stateFips?.length) {
    predicates.push(inArray(geoDim.stateFips, filter.stateFips));
  }

  const rows = await db
    .select({
      geographyCode: rollup.code,
      permitEventCount: sql<number>`count(*)`,
    })
    .from(permitOrMilestoneEvents)
    .leftJoin(geoDim, sql`${permitOrMilestoneEvents.geoId} = ${geoDim.id}`)
    .where(predicates.length ? and(...predicates) : undefined)
    .groupBy(rollup.code);

  return new Map(
    rows
      .filter((row) => row.geographyCode)
      .map((row) => [row.geographyCode as string, Number(row.permitEventCount || 0)])
  );
}

export async function summarizeOpportunityFlow(
  filter: OpportunityFilter
): Promise<OpportunitySummaryResponse> {
  if (!process.env.DATABASE_URL && isSupabaseServerConfigured()) {
    return summarizeViaSupabase(filter);
  }

  return summarizeViaDatabase(filter);
}
