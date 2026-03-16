import { industrialTrackerDemoSnapshot } from "./demo-data";
import { summarizeOpportunityFlow } from "./opportunity-query";
import { canonicalSourceName } from "./source-normalization";
import { isSupabaseServerConfigured, supabaseServerFetch } from "@/lib/platform/supabase-server";
import { isRegionalInfrastructureFacility, isSiteFacility } from "./facility-scope";

type SupabaseFacilityRow = {
  id: string;
  facility_name: string;
  address: {
    city?: string;
    state?: string;
  } | null;
  facility_source_ids: {
    frsId?: string;
    eiaPlantCode?: string;
  } | null;
};

type SupabaseEvidenceRow = {
  facility_id: string | null;
  evidence_type: string;
  observed_at: string;
  source_name: string;
};

type SupabaseFacilityEventRow = {
  facility_id: string | null;
  event_type: string;
  occurred_at: string;
};

type SupabaseProgramLinkRow = {
  facility_id: string;
  program_type: string;
};

type SupabaseSignalRow = {
  facility_id: string | null;
  signal_type: string;
  value: string | null;
  unit: string | null;
  observed_at: string;
  metadata: {
    source?: string;
    generationMwh?: number | null;
    capacityMw?: number | null;
  } | null;
};

type SupabaseProgramLinkDetailRow = {
  facility_id: string;
  program_type: string;
  agency: string | null;
};

type SupabaseIdRow = {
  id: string;
};

type SupabaseInvestmentRow = {
  facility_id: string | null;
  amount: string;
  currency: string | null;
  amount_type: string;
  action_date: string | null;
  announced_date: string | null;
  recipient_name: string | null;
  program_name: string | null;
  source_record_id?: string;
  tech_tags?: string[] | null;
  source_records?: {
    source_system: string;
    source_category: string;
  } | null;
};

type SupabaseSecSourceRow = {
  effective_date: string | null;
  raw_payload: {
    cik?: string;
    form?: string;
    filingDate?: string;
  } | null;
};

type SupabaseEntityRow = {
  id: string;
  legal_name: string;
  identifiers: {
    cik?: string;
    tickers?: string[] | null;
  } | null;
  metadata: {
    sicDescription?: string | null;
  } | null;
};

type ProjectFeedRollupItem = {
  facilityId: string;
  facilityName: string;
  geography: string;
  sourceTag: string;
  sourceCount: number;
  amountLabel: string;
  status: string;
  sortValue: number;
  techTags: string[];
};

async function loadInventoryCounts() {
  if (!isSupabaseServerConfigured()) {
    return {
      facilityCount: industrialTrackerDemoSnapshot.facilityCount,
      infrastructureNodeCount: industrialTrackerDemoSnapshot.infrastructureNodeCount,
      evidenceCount: industrialTrackerDemoSnapshot.evidenceCount,
      programLinkCount: industrialTrackerDemoSnapshot.programLinkCount,
      investmentEventCount: industrialTrackerDemoSnapshot.investmentEventCount,
      permitEventCount: industrialTrackerDemoSnapshot.permitEventCount,
      countyCoverageCount: industrialTrackerDemoSnapshot.countyCoverageCount,
      cbsaCoverageCount: industrialTrackerDemoSnapshot.cbsaCoverageCount,
    };
  }

  const [facilities, evidence, programLinks, investments, permits] = await Promise.all([
    supabaseServerFetch("facility_master?select=id,metadata") as Promise<Array<SupabaseIdRow & { metadata?: { source?: string; facilityType?: string | null } | null }>>,
    supabaseServerFetch("evidence_records?select=id") as Promise<SupabaseIdRow[]>,
    supabaseServerFetch("program_links?select=id") as Promise<SupabaseIdRow[]>,
    supabaseServerFetch("investment_events?select=id") as Promise<SupabaseIdRow[]>,
    supabaseServerFetch("permit_or_milestone_events?select=id") as Promise<SupabaseIdRow[]>,
  ]);

  const siteFacilityCount = facilities.filter((row) => isSiteFacility(row.metadata)).length;
  const infrastructureNodeCount = facilities.filter((row) => isRegionalInfrastructureFacility(row.metadata)).length;

  return {
    facilityCount: siteFacilityCount,
    infrastructureNodeCount,
    evidenceCount: evidence.length,
    programLinkCount: programLinks.length,
    investmentEventCount: investments.length,
    permitEventCount: permits.length,
  };
}

function buildLiveSignalLanes(params: {
  totalTrackedUsd: number;
  investmentEventCount: number;
  permitEventCount: number;
  facilityCount: number;
  infrastructureNodeCount: number;
  evidenceCount: number;
  programLinkCount: number;
  topCbsaCount: number;
  topCountyCount: number;
}) {
  return [
    {
      name: "Federal Awards",
      value: `$${(params.totalTrackedUsd / 1_000_000_000).toFixed(1)}B`,
      change: `${params.investmentEventCount} live events`,
      description:
        "Federal obligations and commitments currently indexed from live award ingestion, not total industrial investment.",
    },
    {
      name: "Permitting Momentum",
      value: `${params.permitEventCount} permit events`,
      change: `${params.programLinkCount} EPA program links`,
      description:
        "EPA-linked permit, compliance, and registry signals validating facility-level industrial activity.",
    },
    {
      name: "Site Inventory",
      value: `${params.facilityCount} sites`,
      change: `${params.evidenceCount} evidence records`,
      description:
        "Plant and project sites currently stitched into the shared evidence graph with raw observed records attached.",
    },
    {
      name: "Geography Coverage",
      value: `${params.topCountyCount} counties`,
      change: `${params.topCbsaCount} metros ranked`,
      description:
        "Current rollup coverage with county-first aggregation and metro views where facility geography resolves cleanly.",
    },
  ];
}

function buildLiveWatchlist(topCountySummary: Awaited<ReturnType<typeof summarizeOpportunityFlow>>) {
  return topCountySummary.rows.slice(0, 3).map((row) => ({
    title: `${row.geographyLabel} cluster`,
    geography: row.geographyLabel,
    thesis:
      row.permitEventCount > 0
        ? `${row.eventCount} capital events and ${row.permitEventCount} permit signals are converging in this geography.`
        : `${row.eventCount} capital events are indexed here; permit coverage is still developing.`,
    status: row.permitEventCount > 0 ? "Escalate" : "Track",
  }));
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toLocaleString();
}

async function loadEnergyLayer() {
  if (!isSupabaseServerConfigured()) {
    return {
      energyFacilityCount: industrialTrackerDemoSnapshot.energyFacilityCount,
      energySignalCount: industrialTrackerDemoSnapshot.energySignalCount,
      totalGenerationMwh: industrialTrackerDemoSnapshot.totalGenerationMwh,
      queueProjectCount: industrialTrackerDemoSnapshot.queueProjectCount,
      queuedCapacityMw: industrialTrackerDemoSnapshot.queuedCapacityMw,
      topQueueItems: industrialTrackerDemoSnapshot.topQueueItems,
      topEnergyFacilities: industrialTrackerDemoSnapshot.topEnergyFacilities,
    };
  }

  const [facilityRows, signalRows, queueSignalRows, queueProgramRows] = await Promise.all([
    supabaseServerFetch(
      "facility_master?select=id,facility_name,address,facility_source_ids&limit=1000"
    ) as Promise<SupabaseFacilityRow[]>,
    supabaseServerFetch(
      "derived_signals?select=facility_id,signal_type,value,unit,observed_at,metadata&signal_type=in.(plant_generation_observed,plant_capacity_observed)&order=observed_at.desc&limit=5000"
    ) as Promise<SupabaseSignalRow[]>,
    supabaseServerFetch(
      "derived_signals?select=facility_id,signal_type,value,unit,observed_at,metadata&signal_type=eq.interconnection_capacity_requested&order=observed_at.desc&limit=2000"
    ) as Promise<SupabaseSignalRow[]>,
    supabaseServerFetch(
      "program_links?select=facility_id,program_type,agency&program_type=eq.interconnection_queue&limit=2000"
    ) as Promise<SupabaseProgramLinkDetailRow[]>,
  ]);

  const eiaFacilities = facilityRows.filter((row) => Boolean(row.facility_source_ids?.eiaPlantCode));
  const eiaFacilityIds = new Set(eiaFacilities.map((row) => row.id));
  const latestSignalByFacility = new Map<string, SupabaseSignalRow>();
  let totalGenerationMwh = 0;

  for (const row of signalRows) {
    if (!row.facility_id || !eiaFacilityIds.has(row.facility_id)) continue;
    if (row.signal_type === "plant_generation_observed") {
      const generation = row.metadata?.generationMwh ?? Number.parseFloat(row.value || "");
      if (Number.isFinite(generation)) {
        totalGenerationMwh += generation;
      }
    }

    if (!latestSignalByFacility.has(row.facility_id)) {
      latestSignalByFacility.set(row.facility_id, row);
    }
  }

  const topEnergyFacilities = eiaFacilities
    .map((facility) => {
      const signal = latestSignalByFacility.get(facility.id);
      if (!signal) return null;

      const geography = [facility.address?.city, facility.address?.state].filter(Boolean).join(", ");
      const capacityMw = signal.metadata?.capacityMw ?? null;
      const generationMwh = signal.metadata?.generationMwh ?? Number.parseFloat(signal.value || "");
      const hasCapacity = typeof capacityMw === "number" && Number.isFinite(capacityMw);
      const metricRank = hasCapacity
        ? capacityMw
        : Number.isFinite(generationMwh)
          ? generationMwh
          : 0;
      if (metricRank <= 0) return null;
      const metricValue = hasCapacity
        ? `${formatCompactNumber(capacityMw)} MW`
        : Number.isFinite(generationMwh)
          ? `${formatCompactNumber(generationMwh)} MWh`
          : signal.value || "Observed";

      return {
        facilityId: facility.id,
        facilityName: facility.facility_name,
        geography: geography || "Unknown geography",
        sourceTag: "EIA",
        metricLabel: hasCapacity ? "Capacity" : "Generation",
        metricValue,
        metricRank,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.metricRank - a.metricRank)
    .slice(0, 4)
    .map(({ metricRank: _metricRank, ...item }) => item);

  const utilityByFacility = new Map(queueProgramRows.map((row) => [row.facility_id, row.agency || "Queued Up"]));
  const latestQueueByFacility = new Map<string, SupabaseSignalRow>();
  let queuedCapacityMw = 0;

  for (const row of queueSignalRows) {
    if (!row.facility_id) continue;
    const capacityMw = row.metadata?.capacityMw ?? Number.parseFloat(row.value || "");
    if (Number.isFinite(capacityMw)) {
      queuedCapacityMw += capacityMw;
    }
    if (!latestQueueByFacility.has(row.facility_id)) {
      latestQueueByFacility.set(row.facility_id, row);
    }
  }

  const topQueueItems = facilityRows
    .map((facility) => {
      const signal = latestQueueByFacility.get(facility.id);
      if (!signal) return null;
      const stateCode = facility.address?.state || "";
      if (stateCode === "MX") return null;
      const capacityMw = signal.metadata?.capacityMw ?? Number.parseFloat(signal.value || "");
      if (!Number.isFinite(capacityMw) || capacityMw <= 0) return null;
      const geography = [facility.address?.city, facility.address?.state].filter(Boolean).join(", ");
      return {
        facilityId: facility.id,
        facilityName: facility.facility_name,
        geography: geography || "Unknown geography",
        utility: utilityByFacility.get(facility.id) || "Queued Up",
        capacityLabel: `${formatCompactNumber(capacityMw)} MW`,
        capacityRank: capacityMw,
        observedAt: signal.observed_at,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => {
      const recencyDelta = b.observedAt.localeCompare(a.observedAt);
      if (recencyDelta !== 0) return recencyDelta;
      return b.capacityRank - a.capacityRank;
    })
    .slice(0, 4)
    .map(({ capacityRank: _capacityRank, observedAt: _observedAt, ...item }) => item);

  return {
    energyFacilityCount: eiaFacilities.length,
    energySignalCount: signalRows.filter((row) => row.facility_id && eiaFacilityIds.has(row.facility_id)).length,
    totalGenerationMwh,
    queueProjectCount: latestQueueByFacility.size,
    queuedCapacityMw,
    topQueueItems,
    topEnergyFacilities,
  };
}

async function loadNonFederalProjects() {
  if (!isSupabaseServerConfigured()) {
    return {
      nonFederalCapitalUsd: industrialTrackerDemoSnapshot.nonFederalCapitalUsd,
      nonFederalProjectCount: industrialTrackerDemoSnapshot.nonFederalProjectCount,
      topProjectFeedItems: industrialTrackerDemoSnapshot.topProjectFeedItems,
      officialCapitalSourceItems: industrialTrackerDemoSnapshot.officialCapitalSourceItems,
      structuredCapitalSourceItems: industrialTrackerDemoSnapshot.structuredCapitalSourceItems,
      aiBuildoutItems: industrialTrackerDemoSnapshot.aiBuildoutItems,
      aiSummaryItems: industrialTrackerDemoSnapshot.aiSummaryItems,
    };
  }

  const [investmentRows, facilityRows] = await Promise.all([
    supabaseServerFetch(
      "investment_events?select=facility_id,amount,currency,amount_type,action_date,announced_date,recipient_name,program_name,tech_tags,source_records!inner(source_system,source_category)&source_records.source_category=in.(incentive,project_finance)&order=action_date.desc.nullslast&limit=1000"
    ) as Promise<SupabaseInvestmentRow[]>,
    supabaseServerFetch(
      "facility_master?select=id,facility_name,address&limit=2000"
    ) as Promise<SupabaseFacilityRow[]>,
  ]);

  const facilityById = new Map(facilityRows.map((row) => [row.id, row]));
  const nonFederalRows = investmentRows.filter((row) => row.source_records?.source_system !== "USAspending");

  const mappedRows = nonFederalRows
    .map((row) => {
      const facility = row.facility_id ? facilityById.get(row.facility_id) : null;
      const geography = [facility?.address?.city, facility?.address?.state].filter(Boolean).join(", ");
      const amount = Number.parseFloat(row.amount);

      return {
        facilityId: row.facility_id || "unknown-facility",
        facilityName: facility?.facility_name || row.recipient_name || "Observed project",
        geography: geography || "Unknown geography",
        sourceTag: row.source_records?.source_system || "Project feed",
        amountLabel:
          amount >= 1_000_000_000
            ? `$${(amount / 1_000_000_000).toFixed(1)}B`
            : amount >= 1_000_000
              ? `$${(amount / 1_000_000).toFixed(0)}M`
              : `$${amount.toLocaleString()}`,
        status: row.amount_type || row.program_name || "observed",
        sortValue: amount,
        techTags: row.tech_tags || [],
      };
    })
    .filter((item) => item.facilityId !== "unknown-facility");

  const nonFederalCapitalUsd = mappedRows.reduce((sum, item) => sum + item.sortValue, 0);

  const groupedRows: ProjectFeedRollupItem[] = Array.from(
    mappedRows.reduce<
      Map<
        string,
        {
          facilityId: string;
          facilityName: string;
          geography: string;
          sourceTags: Set<string>;
          amountLabel: string;
          status: string;
          sortValue: number;
          techTagSet: Set<string>;
        }
      >
    >((map, item) => {
      const current = map.get(item.facilityId);
      if (!current) {
        map.set(item.facilityId, {
          ...item,
          sourceTags: new Set([item.sourceTag]),
          techTagSet: new Set(item.techTags),
        });
        return map;
      }

      const shouldReplaceAmount = item.sortValue >= current.sortValue;
      current.sortValue = Math.max(current.sortValue, item.sortValue);
      if (shouldReplaceAmount) {
        current.amountLabel = item.amountLabel;
      }
      current.sourceTags.add(item.sourceTag);
      item.techTags.forEach((tag) => current.techTagSet.add(tag));
      if (item.status && current.status === "observed") {
        current.status = item.status;
      }
      return map;
    }, new Map())
  ).map(([, item]) => ({
    facilityId: item.facilityId,
    facilityName: item.facilityName,
    geography: item.geography,
    sourceTag:
      item.sourceTags.size > 1
        ? `${Array.from(item.sourceTags)[0]} +${item.sourceTags.size - 1}`
        : Array.from(item.sourceTags)[0],
    sourceCount: item.sourceTags.size,
    amountLabel: item.amountLabel,
    status: item.status,
    sortValue: item.sortValue,
    techTags: Array.from(item.techTagSet),
  }));

  const aiRows = groupedRows.filter((item) =>
    item.sourceTag.toLowerCase().includes("ai") ||
    item.techTags.some((tag) =>
      [
        "ai",
        "data_center",
        "major_load",
        "ai_support",
        "cooling",
        "transformer",
        "gas_turbine",
        "substation",
        "switchgear",
        "water",
        "thermal_management",
        "power",
      ].includes(tag)
    )
  );

  const aiBuildoutItems = aiRows
    .sort((a, b) => {
      const priority = (item: { sourceTag: string; techTags: string[] }) => {
        const source = item.sourceTag.toLowerCase();
        if (source.includes("major load")) return 3;
        if (source.includes("ai support")) return 2;
        if (item.techTags.includes("ai")) return 3;
        if (item.techTags.includes("data_center") && !item.techTags.includes("ai_support")) return 3;
        if (item.techTags.includes("major_load")) return 2;
        if (item.techTags.includes("ai_support")) return 1;
        return 0;
      };

      const priorityDelta = priority(b) - priority(a);
      if (priorityDelta !== 0) return priorityDelta;
      return b.sortValue - a.sortValue;
    })
    .slice(0, 4)
    .map(({ sortValue: _sortValue, techTags, ...item }) => ({
      ...item,
      tags: techTags.slice(0, 3),
    }));

  const aiSummaryDefinitions = [
    {
      label: "Campuses",
      matches: (tags: string[]) => tags.includes("ai") || tags.includes("data_center"),
    },
    {
      label: "Power",
      matches: (tags: string[]) =>
        tags.some((tag) => ["major_load", "power", "gas_turbine", "transformer", "substation", "switchgear"].includes(tag)),
    },
    {
      label: "Cooling + Water",
      matches: (tags: string[]) =>
        tags.some((tag) => ["cooling", "water", "thermal_management"].includes(tag)),
    },
  ];

  const aiSummaryItems = aiSummaryDefinitions.map((definition) => {
    const matching = aiRows.filter((item) => definition.matches(item.techTags));
    const total = matching.reduce((sum, item) => sum + item.sortValue, 0);
    const amountLabel =
      total >= 1_000_000_000
        ? `$${(total / 1_000_000_000).toFixed(1)}B`
        : total >= 1_000_000
          ? `$${Math.round(total / 1_000_000)}M`
          : `$${total.toLocaleString()}`;

    return {
      label: definition.label,
      count: matching.length,
      amountLabel,
    };
  });

  const allCapitalSourceItems = Array.from(
    mappedRows.reduce<Map<string, { projectIds: Set<string>; total: number }>>((map, item) => {
      const current = map.get(item.sourceTag) || { projectIds: new Set<string>(), total: 0 };
      current.projectIds.add(item.facilityId);
      current.total += item.sortValue;
      map.set(item.sourceTag, current);
      return map;
    }, new Map())
  )
    .map(([sourceName, value]) => ({
      sourceName,
      projectCount: value.projectIds.size,
      amountLabel:
        value.total >= 1_000_000_000
          ? `$${(value.total / 1_000_000_000).toFixed(1)}B`
          : value.total >= 1_000_000
            ? `$${Math.round(value.total / 1_000_000)}M`
            : `$${Math.round(value.total).toLocaleString()}`,
      total: value.total,
    }))
    .sort((a, b) => b.total - a.total);

  const officialSourceNames = new Set([
    "Empire State Development Incentives",
    "Texas Strategic Projects",
    "Michigan Strategic Projects",
    "Arizona Strategic Projects",
    "Arkansas Strategic Projects",
    "Ohio Strategic Projects",
    "Georgia Strategic Projects",
    "North Carolina Strategic Projects",
    "Tennessee Strategic Projects",
    "South Carolina Strategic Projects",
    "Kentucky Strategic Projects",
    "Virginia Strategic Projects",
    "Indiana Strategic Projects",
    "Alabama Strategic Projects",
    "Louisiana Strategic Projects",
    "Mississippi Strategic Projects",
    "Illinois Strategic Projects",
    "Missouri Strategic Projects",
    "Kansas Strategic Projects",
    "Oklahoma Strategic Projects",
    "West Virginia Strategic Projects",
    "Iowa Strategic Projects",
    "New Jersey Strategic Projects",
    "Pennsylvania Strategic Projects",
    "Maryland Strategic Projects",
    "New Mexico Strategic Projects",
    "Nevada Strategic Projects",
    "Utah Strategic Projects",
    "Idaho Strategic Projects",
    "Nebraska Strategic Projects",
    "California Strategic Projects",
    "Florida Strategic Projects",
    "Colorado Strategic Projects",
    "Washington Strategic Projects",
    "Oregon Strategic Projects",
    "CHIPS Awards",
    "DOE EDF Projects",
  ]);

  const officialCapitalSourceItems = allCapitalSourceItems
    .filter((item) => officialSourceNames.has(item.sourceName))
    .slice(0, 4)
    .map(({ total: _total, ...item }) => item);

  const structuredCapitalSourceItems = allCapitalSourceItems
    .filter((item) => !officialSourceNames.has(item.sourceName))
    .slice(0, 4)
    .map(({ total: _total, ...item }) => item);

  return {
    nonFederalCapitalUsd,
    nonFederalProjectCount: nonFederalRows.length,
    topProjectFeedItems: groupedRows
      .sort((a, b) => b.sortValue - a.sortValue)
      .slice(0, 4)
      .map(({ sortValue: _sortValue, techTags: _techTags, ...item }) => item),
    officialCapitalSourceItems,
    structuredCapitalSourceItems,
    aiBuildoutItems,
    aiSummaryItems,
  };
}

async function loadCoverageItems() {
  if (!isSupabaseServerConfigured()) {
    return industrialTrackerDemoSnapshot.coverageItems;
  }

  const [sourceRows, evidenceRows] = await Promise.all([
    supabaseServerFetch(
      "source_records?select=id,source_system,source_category,effective_date&limit=10000"
    ) as Promise<Array<{ id: string; source_system: string; source_category: string; effective_date?: string | null }>>,
    supabaseServerFetch(
      "evidence_records?select=source_name,observed_at&order=observed_at.desc&limit=10000"
    ) as Promise<Array<{ source_name: string; observed_at: string }>>,
  ]);

  const evidenceBySource = new Map<string, { count: number; latestObservedAt: string | null }>();
  for (const row of evidenceRows) {
    const canonicalName = canonicalSourceName(row.source_name);
    const current = evidenceBySource.get(canonicalName) || {
      count: 0,
      latestObservedAt: null,
    };
    current.count += 1;
    if (!current.latestObservedAt || row.observed_at > current.latestObservedAt) {
      current.latestObservedAt = row.observed_at;
    }
    evidenceBySource.set(canonicalName, current);
  }

  const sourceRollup = new Map<
    string,
    { count: number; latestObservedAt: string | null; detail: string }
  >();

  for (const row of sourceRows) {
    const key = canonicalSourceName(row.source_system);
    const current = sourceRollup.get(key) || {
      count: 0,
      latestObservedAt: null,
      detail: row.source_category.replace(/_/g, " "),
    };
    current.count += 1;
    if (row.effective_date && (!current.latestObservedAt || row.effective_date > current.latestObservedAt)) {
      current.latestObservedAt = row.effective_date;
    }
    sourceRollup.set(key, current);
  }

  for (const [sourceName, evidence] of evidenceBySource.entries()) {
    const current = sourceRollup.get(sourceName) || {
      count: 0,
      latestObservedAt: null,
      detail: "observed records",
    };
    if (!current.latestObservedAt || (evidence.latestObservedAt && evidence.latestObservedAt > current.latestObservedAt)) {
      current.latestObservedAt = evidence.latestObservedAt;
    }
    if (current.count === 0) {
      current.count = evidence.count;
    }
    sourceRollup.set(sourceName, current);
  }

  return Array.from(sourceRollup.entries())
    .map(([sourceName, value]) => ({
      sourceName,
      recordCount: value.count,
      latestObservedAt: value.latestObservedAt || new Date().toISOString(),
      detail: value.detail,
    }))
    .sort((a, b) => b.recordCount - a.recordCount)
    .slice(0, 4);
}

async function loadIssuerContext() {
  if (!isSupabaseServerConfigured()) {
    return {
      issuerDisclosureCount: industrialTrackerDemoSnapshot.issuerDisclosureCount,
      issuerItems: industrialTrackerDemoSnapshot.issuerItems,
    };
  }

  const [sourceRows, entityRows] = await Promise.all([
    supabaseServerFetch(
      "source_records?select=effective_date,raw_payload&source_system=eq.SEC%20EDGAR&order=effective_date.desc&limit=250"
    ) as Promise<SupabaseSecSourceRow[]>,
    supabaseServerFetch(
      "entity_master?select=id,legal_name,identifiers,metadata&limit=2000"
    ) as Promise<SupabaseEntityRow[]>,
  ]);

  const entityByCik = new Map(
    entityRows
      .filter((row) => row.identifiers?.cik)
      .map((row) => [String(row.identifiers?.cik), row])
  );

  const filingsByCompany = new Map<
    string,
    {
      companyId: string;
      companyName: string;
      tickerLabel: string;
      latestForm: string;
      latestFiledAt: string;
      filingCount: number;
      sectorLabel: string;
    }
  >();

  for (const row of sourceRows) {
    const cik = row.raw_payload?.cik ? String(row.raw_payload.cik).replace(/\D/g, "").padStart(10, "0") : null;
    if (!cik) continue;
    const entity = entityByCik.get(cik);
    if (!entity) continue;

    const current = filingsByCompany.get(entity.id);
    const filedAt =
      row.raw_payload?.filingDate ||
      row.effective_date ||
      new Date().toISOString();

    if (!current) {
      filingsByCompany.set(entity.id, {
        companyId: entity.id,
        companyName: entity.legal_name,
        tickerLabel: entity.identifiers?.tickers?.[0] || "SEC",
        latestForm: row.raw_payload?.form || "Filing",
        latestFiledAt: filedAt,
        filingCount: 1,
        sectorLabel: entity.metadata?.sicDescription || "Issuer disclosure",
      });
      continue;
    }

    current.filingCount += 1;
    if (filedAt > current.latestFiledAt) {
      current.latestFiledAt = filedAt;
      current.latestForm = row.raw_payload?.form || current.latestForm;
    }
  }

  const issuerItems = Array.from(filingsByCompany.values())
    .sort((a, b) => {
      const recencyDelta = b.latestFiledAt.localeCompare(a.latestFiledAt);
      if (recencyDelta !== 0) return recencyDelta;
      return b.filingCount - a.filingCount;
    })
    .slice(0, 4);

  return {
    issuerDisclosureCount: sourceRows.length,
    issuerItems,
  };
}

async function loadFacilityTimeline() {
  if (!isSupabaseServerConfigured()) {
    return industrialTrackerDemoSnapshot.facilityTimeline;
  }

  const [facilityRows, evidenceRows, facilityEventRows, programLinkRows] = await Promise.all([
    supabaseServerFetch(
      "facility_master?select=id,facility_name,address,facility_source_ids&order=updated_at.desc&limit=12"
    ) as Promise<SupabaseFacilityRow[]>,
    supabaseServerFetch(
      "evidence_records?select=facility_id,evidence_type,observed_at,source_name&facility_id=not.is.null&order=observed_at.desc&limit=100"
    ) as Promise<SupabaseEvidenceRow[]>,
    supabaseServerFetch(
      "facility_events?select=facility_id,event_type,occurred_at&facility_id=not.is.null&order=occurred_at.desc&limit=100"
    ) as Promise<SupabaseFacilityEventRow[]>,
    supabaseServerFetch(
      "program_links?select=facility_id,program_type&order=updated_at.desc&limit=100"
    ) as Promise<SupabaseProgramLinkRow[]>,
  ]);

  const evidenceByFacility = new Map<string, SupabaseEvidenceRow[]>();
  const eventsByFacility = new Map<string, SupabaseFacilityEventRow[]>();
  const programTypesByFacility = new Map<string, Set<string>>();

  for (const row of evidenceRows) {
    if (!row.facility_id) continue;
    const list = evidenceByFacility.get(row.facility_id) || [];
    list.push(row);
    evidenceByFacility.set(row.facility_id, list);
  }

  for (const row of facilityEventRows) {
    if (!row.facility_id) continue;
    const list = eventsByFacility.get(row.facility_id) || [];
    list.push(row);
    eventsByFacility.set(row.facility_id, list);
  }

  for (const row of programLinkRows) {
    const set = programTypesByFacility.get(row.facility_id) || new Set<string>();
    set.add(row.program_type);
    programTypesByFacility.set(row.facility_id, set);
  }

  return facilityRows
    .map((facility) => {
      const evidence = (evidenceByFacility.get(facility.id) || [])
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
      const event = (eventsByFacility.get(facility.id) || [])
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
      const programTypes = Array.from(programTypesByFacility.get(facility.id) || []).slice(0, 4);
      const geography = [facility.address?.city, facility.address?.state]
        .filter(Boolean)
        .join(", ");

      if (!evidence && !event) {
        return null;
      }

      return {
        facilityId: facility.id,
        facilityName: facility.facility_name,
        geography: geography || "Unknown geography",
        sourceTag:
          programTypes.length > 0
            ? `EPA ${facility.facility_source_ids?.frsId ? "FRS + " : ""}${evidence?.source_name || "signals"}`
            : evidence?.source_name || "EPA",
        latestObservedAt: evidence?.observed_at || event?.occurred_at || new Date().toISOString(),
        latestEvidenceType: evidence?.evidence_type || "observed",
        latestEventType: event?.event_type || "observed",
        programTypes,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => {
      const programDelta = b.programTypes.length - a.programTypes.length;
      if (programDelta !== 0) return programDelta;
      return b.latestObservedAt.localeCompare(a.latestObservedAt);
    })
    .filter((item, index, items) => {
      const linkedCount = items.filter((candidate) => candidate.programTypes.length > 0).length;
      if (linkedCount > 0) {
        return item.programTypes.length > 0;
      }

      return true;
    })
    .slice(0, 5);
}

export async function loadIndustrialTrackerDashboard() {
  try {
    const [
      topCbsaSummary,
      topCountySummary,
      facilityTimeline,
      inventoryCounts,
      energyLayer,
      nonFederalProjects,
      coverageItems,
      issuerContext,
    ] = await Promise.all([
      summarizeOpportunityFlow({
        rollup: "cbsa",
        amountTypes: ["obligation", "commitment"],
        includePermits: true,
      }),
      summarizeOpportunityFlow({
        rollup: "county",
        amountTypes: ["obligation", "commitment"],
        includePermits: true,
      }),
      loadFacilityTimeline(),
      loadInventoryCounts(),
      loadEnergyLayer(),
      loadNonFederalProjects(),
      loadCoverageItems(),
      loadIssuerContext(),
    ]);

    const totalTrackedUsd = topCountySummary.rows.reduce(
      (sum, row) => sum + row.totalAmountUsd,
      0
    );
    const validatedProjectCount = inventoryCounts.permitEventCount;
    const signalLanes = buildLiveSignalLanes({
      totalTrackedUsd,
      investmentEventCount: inventoryCounts.investmentEventCount,
      permitEventCount: inventoryCounts.permitEventCount,
      facilityCount: inventoryCounts.facilityCount,
      infrastructureNodeCount: inventoryCounts.infrastructureNodeCount,
      evidenceCount: inventoryCounts.evidenceCount,
      programLinkCount: inventoryCounts.programLinkCount,
      topCbsaCount: topCbsaSummary.rows.length,
      topCountyCount: topCountySummary.rows.length,
    });
    const watchlist = buildLiveWatchlist(topCountySummary);

    return {
      ...industrialTrackerDemoSnapshot,
      generatedAt: new Date().toISOString(),
      totalTrackedUsd,
      validatedProjectCount,
      facilityCount: inventoryCounts.facilityCount,
      infrastructureNodeCount: inventoryCounts.infrastructureNodeCount,
      evidenceCount: inventoryCounts.evidenceCount,
      programLinkCount: inventoryCounts.programLinkCount,
      investmentEventCount: inventoryCounts.investmentEventCount,
      permitEventCount: inventoryCounts.permitEventCount,
      countyCoverageCount: topCountySummary.rows.length,
      cbsaCoverageCount: topCbsaSummary.rows.length,
      energyFacilityCount: energyLayer.energyFacilityCount,
      energySignalCount: energyLayer.energySignalCount,
      totalGenerationMwh: energyLayer.totalGenerationMwh,
      queueProjectCount: energyLayer.queueProjectCount,
      queuedCapacityMw: energyLayer.queuedCapacityMw,
      nonFederalCapitalUsd: nonFederalProjects.nonFederalCapitalUsd,
      nonFederalProjectCount: nonFederalProjects.nonFederalProjectCount,
      issuerDisclosureCount: issuerContext.issuerDisclosureCount,
      topCbsaSummary: {
        ...topCbsaSummary,
        rows: topCbsaSummary.rows.slice(0, 5),
      },
      topCountySummary: {
        ...topCountySummary,
        rows: topCountySummary.rows.slice(0, 5),
      },
      signalLanes,
      watchlist,
      facilityTimeline,
      topQueueItems: energyLayer.topQueueItems,
      topEnergyFacilities: energyLayer.topEnergyFacilities,
      topProjectFeedItems: nonFederalProjects.topProjectFeedItems,
      officialCapitalSourceItems: nonFederalProjects.officialCapitalSourceItems,
      structuredCapitalSourceItems: nonFederalProjects.structuredCapitalSourceItems,
      aiBuildoutItems: nonFederalProjects.aiBuildoutItems,
      aiSummaryItems: nonFederalProjects.aiSummaryItems,
      issuerItems: issuerContext.issuerItems,
      coverageItems,
      mode: "live" as const,
    };
  } catch {
    return {
      ...industrialTrackerDemoSnapshot,
      mode: "demo" as const,
    };
  }
}
