import { generateSyntheticSiteData, type SiteProfile } from "@/lib/synthetic-site-generator";
import type { CanonAsset, ProvenanceEntry } from "@/types/canon";

export type DemoPackType =
  | "single_plant_baseline"
  | "multi_plant_portfolio"
  | "multi_tenant_operator"
  | "cross_domain_showcase";

type BenchmarkArchetype = "swat_like" | "wadi_like" | "power_grid_like";

interface DemoSiteSpec {
  siteName: string;
  siteSlug: string;
  profile: SiteProfile;
  targetAssetCount: number;
  benchmark: BenchmarkArchetype;
  tenantId?: string;
}

export interface HybridDemoPack {
  pack: DemoPackType;
  generatedAt: string;
  sites: {
    siteName: string;
    siteSlug: string;
    profile: SiteProfile;
    benchmarkArchetype: BenchmarkArchetype;
    tenantId?: string;
    assets: Partial<CanonAsset>[];
    stats: {
      totalAssets: number;
      realBenchmarkFields: number;
      syntheticFields: number;
      inferredFields: number;
    };
  }[];
}

const PACK_SPECS: Record<DemoPackType, DemoSiteSpec[]> = {
  single_plant_baseline: [
    {
      siteName: "Demo Chemical Plant",
      siteSlug: "demo-chemical-plant",
      profile: "chemical",
      targetAssetCount: 2600,
      benchmark: "swat_like",
    },
  ],
  multi_plant_portfolio: [
    {
      siteName: "North Plant",
      siteSlug: "north-plant",
      profile: "chemical",
      targetAssetCount: 2400,
      benchmark: "swat_like",
    },
    {
      siteName: "East Utilities",
      siteSlug: "east-utilities",
      profile: "water",
      targetAssetCount: 2100,
      benchmark: "wadi_like",
    },
    {
      siteName: "South Power Block",
      siteSlug: "south-power-block",
      profile: "power",
      targetAssetCount: 2800,
      benchmark: "power_grid_like",
    },
  ],
  multi_tenant_operator: [
    {
      siteName: "Tenant A - Plant 01",
      siteSlug: "tenant-a-plant-01",
      profile: "petrochemical",
      targetAssetCount: 2600,
      benchmark: "swat_like",
      tenantId: "tenant_a",
    },
    {
      siteName: "Tenant A - Plant 02",
      siteSlug: "tenant-a-plant-02",
      profile: "chemical",
      targetAssetCount: 2200,
      benchmark: "wadi_like",
      tenantId: "tenant_a",
    },
    {
      siteName: "Tenant B - Utility Site",
      siteSlug: "tenant-b-utility-site",
      profile: "water",
      targetAssetCount: 1800,
      benchmark: "wadi_like",
      tenantId: "tenant_b",
    },
  ],
  cross_domain_showcase: [
    {
      siteName: "Gulf Coast Refinery",
      siteSlug: "gulf-coast-refinery",
      profile: "petrochemical",
      targetAssetCount: 3000,
      benchmark: "swat_like",
    },
    {
      siteName: "Metro Automotive Plant",
      siteSlug: "metro-automotive-plant",
      profile: "automotive",
      targetAssetCount: 2600,
      benchmark: "wadi_like",
    },
    {
      siteName: "Orion Defense Manufacturing",
      siteSlug: "orion-defense-manufacturing",
      profile: "defense_manufacturing",
      targetAssetCount: 2200,
      benchmark: "power_grid_like",
    },
    {
      siteName: "Harbor Shipbuilding Yard",
      siteSlug: "harbor-shipbuilding-yard",
      profile: "shipbuilding",
      targetAssetCount: 2800,
      benchmark: "power_grid_like",
    },
  ],
};

function benchmarkSourceRef(benchmark: BenchmarkArchetype): string {
  if (benchmark === "swat_like") return "public-benchmark:SWaT-like";
  if (benchmark === "wadi_like") return "public-benchmark:WADI-like";
  return "public-benchmark:PowerGrid-like";
}

function addHybridProvenance(
  assets: Partial<CanonAsset>[],
  benchmark: BenchmarkArchetype
): Partial<CanonAsset>[] {
  const sourceRef = benchmarkSourceRef(benchmark);

  return assets.map((asset, index) => {
    const provenance: ProvenanceEntry[] = [
      {
        field: "tagNumber",
        sourceType: "synthetic",
        sourceRef: "planttrace-generator:v1",
        confidence: 0.98,
      },
      {
        field: "name",
        sourceType: "synthetic",
        sourceRef: "planttrace-generator:v1",
        confidence: 0.95,
      },
      {
        field: "network.protocol",
        sourceType: "real_benchmark",
        sourceRef,
        confidence: 0.72,
        note: "Protocol/telemetry realism aligned to benchmark archetype",
      },
      {
        field: "relationshipHints",
        sourceType: "inferred",
        sourceRef: "planttrace-relationship-inference:v1",
        confidence: 0.78,
      },
    ];

    return {
      ...asset,
      coordinates: {
        x: (index % 40) * 3,
        y: Math.floor(index / 40) * 3,
        z: asset.layer ? asset.layer * 2 : 0,
      },
      provenance,
    };
  });
}

function provenanceStats(assets: Partial<CanonAsset>[]) {
  let realBenchmarkFields = 0;
  let syntheticFields = 0;
  let inferredFields = 0;

  for (const asset of assets) {
    for (const entry of asset.provenance || []) {
      if (entry.sourceType === "real_benchmark") realBenchmarkFields++;
      if (entry.sourceType === "synthetic") syntheticFields++;
      if (entry.sourceType === "inferred") inferredFields++;
    }
  }

  return { realBenchmarkFields, syntheticFields, inferredFields };
}

export function generateHybridDemoPack(
  pack: DemoPackType,
  seedPrefix = "planttrace-hybrid"
): HybridDemoPack {
  const specs = PACK_SPECS[pack];

  const sites = specs.map((spec, idx) => {
    const generated = generateSyntheticSiteData({
      siteName: spec.siteName,
      siteSlug: spec.siteSlug,
      profile: spec.profile,
      targetAssetCount: spec.targetAssetCount,
      seed: `${seedPrefix}:${pack}:${idx}`,
    });

    const assets = addHybridProvenance(generated.assets, spec.benchmark);
    const stats = provenanceStats(assets);

    return {
      siteName: spec.siteName,
      siteSlug: spec.siteSlug,
      profile: spec.profile,
      benchmarkArchetype: spec.benchmark,
      tenantId: spec.tenantId,
      assets,
      stats: {
        totalAssets: assets.length,
        ...stats,
      },
    };
  });

  return {
    pack,
    generatedAt: new Date().toISOString(),
    sites,
  };
}
