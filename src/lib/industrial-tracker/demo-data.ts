import { OpportunitySummaryResponse } from "./opportunity-types";

export interface IndustrialTrackerSignalLane {
  name: string;
  value: string;
  change: string;
  description: string;
}

export interface IndustrialTrackerWatchItem {
  title: string;
  geography: string;
  thesis: string;
  status: string;
}

export interface IndustrialTrackerFacilityTimelineItem {
  facilityId: string;
  facilityName: string;
  geography: string;
  sourceTag: string;
  latestObservedAt: string;
  latestEvidenceType: string;
  latestEventType: string;
  programTypes: string[];
}

export interface IndustrialTrackerEnergyFacilityItem {
  facilityId: string;
  facilityName: string;
  geography: string;
  sourceTag: string;
  metricLabel: string;
  metricValue: string;
}

export interface IndustrialTrackerProjectItem {
  facilityId: string;
  facilityName: string;
  geography: string;
  sourceTag: string;
  sourceCount?: number;
  amountLabel: string;
  status: string;
}

export interface IndustrialTrackerCapitalSourceItem {
  sourceName: string;
  projectCount: number;
  amountLabel: string;
}

export interface IndustrialTrackerAiItem {
  facilityId: string;
  facilityName: string;
  geography: string;
  amountLabel: string;
  tags: string[];
  sourceCount?: number;
}

export interface IndustrialTrackerAiSummaryItem {
  label: string;
  count: number;
  amountLabel: string;
}

export interface IndustrialTrackerCoverageItem {
  sourceName: string;
  recordCount: number;
  latestObservedAt: string;
  detail: string;
}

export interface IndustrialTrackerIssuerItem {
  companyId: string;
  companyName: string;
  tickerLabel: string;
  latestForm: string;
  latestFiledAt: string;
  filingCount: number;
  sectorLabel: string;
}

export interface IndustrialTrackerQueueItem {
  facilityId: string;
  facilityName: string;
  geography: string;
  utility: string;
  capacityLabel: string;
}

export interface IndustrialTrackerDashboardSnapshot {
  generatedAt: string;
  totalTrackedUsd: number;
  validatedProjectCount: number;
  facilityCount: number;
  infrastructureNodeCount: number;
  evidenceCount: number;
  programLinkCount: number;
  investmentEventCount: number;
  permitEventCount: number;
  countyCoverageCount: number;
  cbsaCoverageCount: number;
  energyFacilityCount: number;
  energySignalCount: number;
  totalGenerationMwh: number;
  nonFederalCapitalUsd: number;
  nonFederalProjectCount: number;
  issuerDisclosureCount: number;
  topCbsaSummary: OpportunitySummaryResponse;
  topCountySummary: OpportunitySummaryResponse;
  signalLanes: IndustrialTrackerSignalLane[];
  watchlist: IndustrialTrackerWatchItem[];
  facilityTimeline: IndustrialTrackerFacilityTimelineItem[];
  topEnergyFacilities: IndustrialTrackerEnergyFacilityItem[];
  topProjectFeedItems: IndustrialTrackerProjectItem[];
  officialCapitalSourceItems: IndustrialTrackerCapitalSourceItem[];
  structuredCapitalSourceItems: IndustrialTrackerCapitalSourceItem[];
  aiBuildoutItems: IndustrialTrackerAiItem[];
  aiSummaryItems: IndustrialTrackerAiSummaryItem[];
  issuerItems: IndustrialTrackerIssuerItem[];
  queueProjectCount: number;
  queuedCapacityMw: number;
  topQueueItems: IndustrialTrackerQueueItem[];
  coverageItems: IndustrialTrackerCoverageItem[];
}

export const industrialTrackerDemoSnapshot: IndustrialTrackerDashboardSnapshot = {
  generatedAt: "2026-03-10T10:00:00.000Z",
  totalTrackedUsd: 12840000000,
  validatedProjectCount: 41,
  facilityCount: 32,
  infrastructureNodeCount: 6,
  evidenceCount: 118,
  programLinkCount: 27,
  investmentEventCount: 45,
  permitEventCount: 41,
  countyCoverageCount: 9,
  cbsaCoverageCount: 3,
  energyFacilityCount: 18,
  energySignalCount: 54,
  totalGenerationMwh: 6420000,
  nonFederalCapitalUsd: 5140000000,
  queueProjectCount: 4,
  queuedCapacityMw: 2860,
  nonFederalProjectCount: 4,
  issuerDisclosureCount: 3,
  topCbsaSummary: {
    rollup: "cbsa",
    generatedAt: "2026-03-10T10:00:00.000Z",
    filtersApplied: {
      rollup: "cbsa",
      amountTypes: ["obligation", "commitment"],
      includePermits: true,
    },
    rows: [
      {
        geographyType: "cbsa",
        geographyCode: "19100",
        geographyLabel: "Dallas-Fort Worth-Arlington, TX",
        totalAmountUsd: 2890000000,
        eventCount: 18,
        permitEventCount: 7,
        jobsEstimate: 3350,
        amountPerManufacturingWorker: 9821,
        amountPerEstablishment: 694711,
        latestActionDate: "2026-03-04T00:00:00.000Z",
      },
      {
        geographyType: "cbsa",
        geographyCode: "26420",
        geographyLabel: "Houston-Pasadena-The Woodlands, TX",
        totalAmountUsd: 2410000000,
        eventCount: 15,
        permitEventCount: 9,
        jobsEstimate: 2810,
        amountPerManufacturingWorker: 8613,
        amountPerEstablishment: 618924,
        latestActionDate: "2026-03-06T00:00:00.000Z",
      },
      {
        geographyType: "cbsa",
        geographyCode: "16980",
        geographyLabel: "Chicago-Naperville-Elgin, IL-IN-WI",
        totalAmountUsd: 1740000000,
        eventCount: 12,
        permitEventCount: 5,
        jobsEstimate: 1960,
        amountPerManufacturingWorker: 5342,
        amountPerEstablishment: 441625,
        latestActionDate: "2026-03-01T00:00:00.000Z",
      },
    ],
  },
  topCountySummary: {
    rollup: "county",
    generatedAt: "2026-03-10T10:00:00.000Z",
    filtersApplied: {
      rollup: "county",
      amountTypes: ["obligation", "commitment"],
      includePermits: true,
    },
    rows: [
      {
        geographyType: "county",
        geographyCode: "48201",
        geographyLabel: "Harris County, TX",
        totalAmountUsd: 1380000000,
        eventCount: 9,
        permitEventCount: 6,
        jobsEstimate: 1640,
        amountPerManufacturingWorker: 12151,
        amountPerEstablishment: 702290,
        latestActionDate: "2026-03-06T00:00:00.000Z",
      },
      {
        geographyType: "county",
        geographyCode: "48113",
        geographyLabel: "Dallas County, TX",
        totalAmountUsd: 1210000000,
        eventCount: 8,
        permitEventCount: 4,
        jobsEstimate: 1390,
        amountPerManufacturingWorker: 11328,
        amountPerEstablishment: 655826,
        latestActionDate: "2026-03-04T00:00:00.000Z",
      },
      {
        geographyType: "county",
        geographyCode: "17031",
        geographyLabel: "Cook County, IL",
        totalAmountUsd: 910000000,
        eventCount: 7,
        permitEventCount: 3,
        jobsEstimate: 980,
        amountPerManufacturingWorker: 7260,
        amountPerEstablishment: 512110,
        latestActionDate: "2026-03-01T00:00:00.000Z",
      },
    ],
  },
  signalLanes: [
    {
      name: "Federal Awards",
      value: "$7.1B",
      change: "+18% vs prior 12 months",
      description: "Obligations and commitments tied to manufacturing-heavy metros.",
    },
    {
      name: "Permitting Momentum",
      value: "41 validated projects",
      change: "+9 new milestones",
      description: "FAST-41 and EPA-linked project reality signals over the last 180 days.",
    },
    {
      name: "Supply Chain Shifts",
      value: "6 active alerts",
      change: "3 port surges",
      description: "Import and corridor changes likely to ripple into buildout and sourcing.",
    },
    {
      name: "Energy Constraint",
      value: "14 stressed nodes",
      change: "2 improved",
      description: "Power and infrastructure bottlenecks around high-growth industrial clusters.",
    },
  ],
  watchlist: [
    {
      title: "Gulf Coast petrochemicals build cycle",
      geography: "Houston-Pasadena-The Woodlands, TX",
      thesis: "Permits and DOE-style financing momentum point to sustained supplier demand.",
      status: "Escalate",
    },
    {
      title: "North Texas electronics corridor",
      geography: "Dallas-Fort Worth-Arlington, TX",
      thesis: "Large federal award concentration with logistics throughput increases in parallel.",
      status: "Track weekly",
    },
    {
      title: "Great Lakes industrial retrofit cluster",
      geography: "Chicago-Naperville-Elgin, IL-IN-WI",
      thesis: "Moderate capex flow but strong permit density suggests an emerging upgrade cycle.",
      status: "Watch",
    },
  ],
  facilityTimeline: [
    {
      facilityId: "demo-gulfchem-houston-complex",
      facilityName: "GulfChem Houston Complex",
      geography: "Houston, TX",
      sourceTag: "EPA FRS + ECHO",
      latestObservedAt: "2026-03-07T00:00:00.000Z",
      latestEvidenceType: "permit_or_compliance_observed",
      latestEventType: "permit_status_updated",
      programTypes: ["npdes", "rcra", "air_permit"],
    },
    {
      facilityId: "demo-north-circuit-assembly-campus",
      facilityName: "North Circuit Assembly Campus",
      geography: "Dallas, TX",
      sourceTag: "EPA FRS",
      latestObservedAt: "2026-03-05T00:00:00.000Z",
      latestEvidenceType: "facility_registry_observed",
      latestEventType: "facility_registered",
      programTypes: ["air_permit"],
    },
    {
      facilityId: "demo-great-lakes-retrofit-works",
      facilityName: "Great Lakes Retrofit Works",
      geography: "Chicago, IL",
      sourceTag: "EPA ECHO",
      latestObservedAt: "2026-03-04T00:00:00.000Z",
      latestEvidenceType: "permit_or_compliance_observed",
      latestEventType: "permit_status_updated",
      programTypes: ["npdes", "tri"],
    },
  ],
  topEnergyFacilities: [
    {
      facilityId: "demo-south-texas-project",
      facilityName: "South Texas Project",
      geography: "Bay City, TX",
      sourceTag: "EIA",
      metricLabel: "Monthly generation",
      metricValue: "2.0M MWh",
    },
    {
      facilityId: "demo-clinton-power-station",
      facilityName: "Clinton Power Station",
      geography: "Clinton, IL",
      sourceTag: "EIA",
      metricLabel: "Monthly generation",
      metricValue: "812k MWh",
    },
    {
      facilityId: "demo-limestone",
      facilityName: "Limestone",
      geography: "Jewett, TX",
      sourceTag: "EIA",
      metricLabel: "Monthly generation",
      metricValue: "428k MWh",
    },
    {
      facilityId: "demo-dresden-generating-station",
      facilityName: "Dresden Generating Station",
      geography: "Morris, IL",
      sourceTag: "EIA",
      metricLabel: "Monthly generation",
      metricValue: "1.4M MWh",
    },
  ],
  topProjectFeedItems: [
    {
      facilityId: "demo-north-star-cathode-campus",
      facilityName: "North Star Cathode Campus",
      geography: "St. Paul, MN",
      sourceTag: "Project feed",
      sourceCount: 1,
      amountLabel: "$185M",
      status: "announced",
    },
    {
      facilityId: "demo-gulf-electronics-campus",
      facilityName: "Gulf Electronics Assembly Campus",
      geography: "Austin, TX",
      sourceTag: "Project feed",
      sourceCount: 1,
      amountLabel: "$220M",
      status: "construction",
    },
  ],
  officialCapitalSourceItems: [
    {
      sourceName: "Empire State Development Incentives",
      projectCount: 2,
      amountLabel: "$1.6B",
    },
    {
      sourceName: "CHIPS Awards",
      projectCount: 1,
      amountLabel: "$1.5B",
    },
    {
      sourceName: "DOE EDF Projects",
      projectCount: 1,
      amountLabel: "$2.0B",
    },
  ],
  structuredCapitalSourceItems: [
    {
      sourceName: "Baseload AI and major load feed",
      projectCount: 2,
      amountLabel: "$5.4B",
    },
    {
      sourceName: "Baseload nuclear build feed",
      projectCount: 2,
      amountLabel: "$4.3B",
    },
    {
      sourceName: "Baseload semiconductor build feed",
      projectCount: 2,
      amountLabel: "$2.4B",
    },
    {
      sourceName: "Baseload AI support infrastructure feed",
      projectCount: 3,
      amountLabel: "$1.7B",
    },
  ],
  aiBuildoutItems: [
    {
      facilityId: "demo-colossus-memphis-campus",
      facilityName: "Colossus Memphis Campus",
      geography: "Memphis, TN",
      amountLabel: "$2.0B",
      tags: ["ai", "data_center", "major_load"],
      sourceCount: 1,
    },
    {
      facilityId: "demo-abilene-ai-campus",
      facilityName: "Abilene AI Infrastructure Campus",
      geography: "Abilene, TX",
      amountLabel: "$3.4B",
      tags: ["ai", "data_center", "major_load"],
      sourceCount: 1,
    },
    {
      facilityId: "demo-river-parish-peaker",
      facilityName: "River Parish Peaking Station",
      geography: "Baton Rouge, LA",
      amountLabel: "$920M",
      tags: ["ai_support", "gas_turbine", "power"],
      sourceCount: 1,
    },
    {
      facilityId: "demo-silver-state-cooling",
      facilityName: "Silver State Liquid Cooling Campus",
      geography: "Reno, NV",
      amountLabel: "$265M",
      tags: ["ai_support", "cooling", "thermal_management"],
      sourceCount: 1,
    },
  ],
  aiSummaryItems: [
    { label: "Campuses", count: 2, amountLabel: "$5.4B" },
    { label: "Power", count: 3, amountLabel: "$2.0B" },
    { label: "Cooling + Water", count: 2, amountLabel: "$805M" },
  ],
  issuerItems: [
    {
      companyId: "issuer-dow",
      companyName: "Dow Inc.",
      tickerLabel: "DOW",
      latestForm: "8-K",
      latestFiledAt: "2026-03-04T00:00:00.000Z",
      filingCount: 4,
      sectorLabel: "Chemicals",
    },
    {
      companyId: "issuer-intc",
      companyName: "Intel Corporation",
      tickerLabel: "INTC",
      latestForm: "10-K",
      latestFiledAt: "2026-02-21T00:00:00.000Z",
      filingCount: 3,
      sectorLabel: "Semiconductors",
    },
    {
      companyId: "issuer-gevo",
      companyName: "Gevo, Inc.",
      tickerLabel: "GEVO",
      latestForm: "8-K",
      latestFiledAt: "2026-02-11T00:00:00.000Z",
      filingCount: 2,
      sectorLabel: "Energy transition",
    },
  ],
  topQueueItems: [
    {
      facilityId: "demo-queue-sunbelt",
      facilityName: "Sunbelt Storage Hub",
      geography: "Phoenix, AZ",
      utility: "APS",
      capacityLabel: "600 MW",
    },
    {
      facilityId: "demo-queue-cactus",
      facilityName: "Cactus Ridge Solar",
      geography: "Buckeye, AZ",
      utility: "APS",
      capacityLabel: "450 MW",
    },
    {
      facilityId: "demo-queue-hartland",
      facilityName: "Hartland Hybrid Project",
      geography: "Abilene, TX",
      utility: "ERCOT",
      capacityLabel: "980 MW",
    },
    {
      facilityId: "demo-queue-redriver",
      facilityName: "Red River Peaker",
      geography: "Shreveport, LA",
      utility: "SPP",
      capacityLabel: "830 MW",
    },
  ],
  coverageItems: [
    {
      sourceName: "USAspending",
      recordCount: 50,
      latestObservedAt: "2026-03-09T00:00:00.000Z",
      detail: "federal awards",
    },
    {
      sourceName: "EPA FRS",
      recordCount: 20,
      latestObservedAt: "2026-03-08T00:00:00.000Z",
      detail: "facility registry",
    },
    {
      sourceName: "EPA ECHO",
      recordCount: 10,
      latestObservedAt: "2026-03-08T00:00:00.000Z",
      detail: "permit and compliance",
    },
    {
      sourceName: "EIA",
      recordCount: 5000,
      latestObservedAt: "2025-12-01T00:00:00.000Z",
      detail: "energy infrastructure",
    },
  ],
};
