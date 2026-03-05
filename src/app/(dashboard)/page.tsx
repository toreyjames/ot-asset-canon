import Link from "next/link";

// Demo data - in production this would come from the database
const DEMO_SITES = [
  {
    id: "1",
    slug: "houston-plant",
    name: "Houston Plant",
    location: "Houston, TX",
    inferredPlantType: "Petrochemical",
    plantTypeConfidence: 87,
    assetCount: 156,
    gapCount: 7,
    reconstructionScore: 84,
    canRunPlant: true,
    lastDataIngestion: "2024-02-15T14:30:00Z",
    layerScores: [
      { layer: 1, score: 64, status: "partial" },
      { layer: 2, score: 94, status: "partial" },
      { layer: 3, score: 100, status: "complete" },
    ],
  },
  {
    id: "2",
    slug: "rotterdam-facility",
    name: "Rotterdam Facility",
    location: "Rotterdam, Netherlands",
    inferredPlantType: "Chemical",
    plantTypeConfidence: 92,
    assetCount: 203,
    gapCount: 3,
    reconstructionScore: 94,
    canRunPlant: true,
    lastDataIngestion: "2024-02-14T09:15:00Z",
    layerScores: [
      { layer: 1, score: 89, status: "partial" },
      { layer: 2, score: 96, status: "partial" },
      { layer: 3, score: 100, status: "complete" },
    ],
  },
  {
    id: "3",
    slug: "singapore-ops",
    name: "Singapore Operations",
    location: "Singapore",
    inferredPlantType: "Polymer",
    plantTypeConfidence: 78,
    assetCount: 89,
    gapCount: 12,
    reconstructionScore: 71,
    canRunPlant: false,
    lastDataIngestion: "2024-02-10T22:00:00Z",
    layerScores: [
      { layer: 1, score: 52, status: "partial" },
      { layer: 2, score: 78, status: "partial" },
      { layer: 3, score: 85, status: "partial" },
    ],
  },
];

export default function SitesDashboard() {
  const totalAssets = DEMO_SITES.reduce((sum, site) => sum + site.assetCount, 0);
  const totalGaps = DEMO_SITES.reduce((sum, site) => sum + site.gapCount, 0);
  const avgScore = Math.round(
    DEMO_SITES.reduce((sum, site) => sum + site.reconstructionScore, 0) / DEMO_SITES.length
  );
  const readySites = DEMO_SITES.filter((site) => site.canRunPlant).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Sites Overview</h1>
        <p className="mt-1 text-gray-500">
          Monitor reconstruction progress across all facilities
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Total Sites"
          value={DEMO_SITES.length.toString()}
          subtext={`${readySites} ready to run`}
        />
        <SummaryCard
          label="Total Assets"
          value={totalAssets.toLocaleString()}
          subtext="Across all sites"
        />
        <SummaryCard
          label="Open Gaps"
          value={totalGaps.toString()}
          subtext="Requiring attention"
          variant={totalGaps > 10 ? "warning" : "default"}
        />
        <SummaryCard
          label="Avg. Reconstruction"
          value={`${avgScore}%`}
          subtext="Portfolio score"
          variant={avgScore >= 80 ? "success" : avgScore >= 60 ? "warning" : "danger"}
        />
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {DEMO_SITES.map((site) => (
          <SiteCard key={site.id} site={site} />
        ))}

        {/* Add New Site Card */}
        <Link
          href="/sites/new"
          className="flex flex-col items-center justify-center p-8 bg-white rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors group"
        >
          <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center mb-3 transition-colors">
            <svg
              className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-600 group-hover:text-blue-600 transition-colors">
            Add New Site
          </span>
        </Link>
      </div>

      {/* Philosophy Section */}
      <div className="mt-12 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">The Goal: Complete Asset Inventory</h3>
            <p className="mt-1 text-sm text-gray-600">
              The reconstruction score measures confidence in your asset data. A higher score means
              you can trust your inventory for security assessments, compliance audits, and operational
              decisions. Fill the gaps identified in each site to improve your score.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtext,
  variant = "default",
}: {
  label: string;
  value: string;
  subtext: string;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const variantStyles = {
    default: "bg-white",
    success: "bg-green-50 border-green-200",
    warning: "bg-amber-50 border-amber-200",
    danger: "bg-red-50 border-red-200",
  };

  const valueStyles = {
    default: "text-gray-900",
    success: "text-green-700",
    warning: "text-amber-700",
    danger: "text-red-700",
  };

  return (
    <div className={`p-5 rounded-xl border ${variantStyles[variant]}`}>
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${valueStyles[variant]}`}>{value}</div>
      <div className="text-sm text-gray-500 mt-1">{subtext}</div>
    </div>
  );
}

function SiteCard({ site }: { site: (typeof DEMO_SITES)[0] }) {
  const scoreColor =
    site.reconstructionScore >= 90
      ? "text-green-600 bg-green-100"
      : site.reconstructionScore >= 70
        ? "text-amber-600 bg-amber-100"
        : "text-red-600 bg-red-100";

  return (
    <Link
      href={`/sites/${site.slug}`}
      className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {site.name}
          </h3>
          <p className="text-sm text-gray-500">{site.location}</p>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-sm font-semibold ${scoreColor}`}>
          {site.reconstructionScore}%
        </div>
      </div>

      {/* Plant Type */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Inferred:</span>
        <span className="text-sm text-gray-700">{site.inferredPlantType}</span>
        <span className="text-xs text-gray-400">({site.plantTypeConfidence}% confidence)</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-lg font-semibold text-gray-900">{site.assetCount}</div>
          <div className="text-xs text-gray-500">Assets</div>
        </div>
        <div>
          <div className={`text-lg font-semibold ${site.gapCount > 5 ? "text-amber-600" : "text-gray-900"}`}>
            {site.gapCount}
          </div>
          <div className="text-xs text-gray-500">Gaps</div>
        </div>
        <div>
          <div className={`text-lg font-semibold ${site.canRunPlant ? "text-green-600" : "text-red-600"}`}>
            {site.canRunPlant ? "Yes" : "No"}
          </div>
          <div className="text-xs text-gray-500">Runnable</div>
        </div>
      </div>

      {/* Layer bars */}
      <div className="space-y-2">
        {site.layerScores.map((layer) => (
          <div key={layer.layer} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-6">L{layer.layer}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  layer.status === "complete"
                    ? "bg-green-500"
                    : layer.score >= 70
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${layer.score}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-8">{layer.score}%</span>
          </div>
        ))}
      </div>

      {/* Last updated */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Last updated: {new Date(site.lastDataIngestion).toLocaleDateString()}
        </span>
        <svg
          className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}
