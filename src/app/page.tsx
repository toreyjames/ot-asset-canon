import { LAYER_NAMES, LAYER_DESCRIPTIONS, type CanonLayer } from "@/types/canon";

export default function Dashboard() {
  const layers: CanonLayer[] = [6, 5, 4, 3, 2, 1];

  // Sample stats - in production these would come from the database
  const stats = {
    totalAssets: 1247,
    criticalAssets: 89,
    attackPaths: 23,
    openVulnerabilities: 156,
    riskScore: 72,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Converged Plant Intelligence
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Single unified view from physical process through enterprise integration
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <StatCard
          title="Total Assets"
          value={stats.totalAssets.toLocaleString()}
          subtitle="In Canon"
        />
        <StatCard
          title="Critical Assets"
          value={stats.criticalAssets.toString()}
          subtitle="Safety/Security"
          color="critical"
        />
        <StatCard
          title="Attack Paths"
          value={stats.attackPaths.toString()}
          subtitle="Identified"
          color="high"
        />
        <StatCard
          title="Vulnerabilities"
          value={stats.openVulnerabilities.toString()}
          subtitle="Open CVEs"
          color="medium"
        />
        <StatCard
          title="Risk Score"
          value={`${stats.riskScore}/100`}
          subtitle="Proportionality"
          color="low"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Canon Architecture Stack */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Canon Architecture
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Bottom-up from physics - every asset contextualized by what it controls
              and what consequence its failure produces
            </p>

            <div className="canon-stack">
              {layers.map((layer) => (
                <LayerCard key={layer} layer={layer} />
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="space-y-6">
          {/* AI Query Quick Start */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              AI-Powered Query
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Ask questions about your plant using natural language
            </p>
            <div className="space-y-2">
              <QuickQuery query="What controllers affect reactor R-101?" />
              <QuickQuery query="Trace attack path from vendor VPN to safety system" />
              <QuickQuery query="What's the consequence if TIC-101 is compromised?" />
              <QuickQuery query="Show assets with critical CVEs on safety systems" />
            </div>
            <a
              href="/ai"
              className="mt-4 inline-block w-full text-center bg-layer5 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Open AI Query Interface
            </a>
          </div>

          {/* Risk Proportionality Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Risk Proportionality (Build Clock)
            </h2>
            <div className="space-y-3">
              <ProportionalityBar
                label="Process Control Zone"
                value={85}
                judgment="proportional"
              />
              <ProportionalityBar
                label="Safety Systems"
                value={62}
                judgment="underspend"
              />
              <ProportionalityBar
                label="Network Infrastructure"
                value={78}
                judgment="proportional"
              />
              <ProportionalityBar
                label="Enterprise Integration"
                value={45}
                judgment="underspend"
              />
            </div>
            <a
              href="/risk"
              className="mt-4 inline-block w-full text-center border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2 rounded-md text-sm font-medium"
            >
              View Full Assessment
            </a>
          </div>
        </div>
      </div>

      {/* The Core Problem */}
      <div className="mt-8 bg-gradient-to-r from-layer1/10 via-layer3/10 to-layer5/10 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Why the Canon Matters
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <h3 className="font-medium text-layer1 mb-2">Engineering</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Knows the process consequence but not the network exposure path
            </p>
          </div>
          <div>
            <h3 className="font-medium text-layer3 mb-2">OT/Control Systems</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Knows the automation but may not know the full consequence chain
            </p>
          </div>
          <div>
            <h3 className="font-medium text-layer5 mb-2">IT/Cybersecurity</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Knows the network but doesn't understand physical-world impact
            </p>
          </div>
        </div>
        <p className="mt-4 text-gray-700 dark:text-gray-300 font-medium">
          The Canon converges these views — enabling security that understands consequences
          and operations that account for cyber exposure.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color?: "critical" | "high" | "medium" | "low";
}) {
  const colorClasses = {
    critical: "border-critical",
    high: "border-high",
    medium: "border-medium",
    low: "border-low",
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 ${
        color ? colorClasses[color] : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-500">{subtitle}</p>
    </div>
  );
}

function LayerCard({ layer }: { layer: CanonLayer }) {
  const layerColors: Record<CanonLayer, string> = {
    1: "layer-1",
    2: "layer-2",
    3: "layer-3",
    4: "layer-4",
    5: "layer-5",
    6: "layer-6",
  };

  // Sample asset counts per layer
  const assetCounts: Record<CanonLayer, number> = {
    1: 47,
    2: 312,
    3: 89,
    4: 156,
    5: 423,
    6: 220,
  };

  return (
    <a
      href={`/explorer?layer=${layer}`}
      className={`canon-layer ${layerColors[layer]} cursor-pointer`}
    >
      <div className="flex justify-between items-center">
        <div>
          <span className="text-sm opacity-75">Layer {layer}</span>
          <h3 className="font-semibold">{LAYER_NAMES[layer]}</h3>
          <p className="text-sm opacity-75 mt-1">{LAYER_DESCRIPTIONS[layer]}</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold">{assetCounts[layer]}</span>
          <p className="text-sm opacity-75">assets</p>
        </div>
      </div>
    </a>
  );
}

function QuickQuery({ query }: { query: string }) {
  return (
    <a
      href={`/ai?q=${encodeURIComponent(query)}`}
      className="block text-sm text-gray-600 dark:text-gray-400 hover:text-layer5 dark:hover:text-blue-400 truncate"
    >
      &quot;{query}&quot;
    </a>
  );
}

function ProportionalityBar({
  label,
  value,
  judgment,
}: {
  label: string;
  value: number;
  judgment: "overspend" | "proportional" | "underspend";
}) {
  const judgmentColors = {
    overspend: "bg-yellow-500",
    proportional: "bg-green-500",
    underspend: "bg-red-500",
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span
          className={`font-medium ${
            judgment === "proportional"
              ? "text-green-600"
              : judgment === "underspend"
                ? "text-red-600"
                : "text-yellow-600"
          }`}
        >
          {judgment}
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${judgmentColors[judgment]} rounded-full`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
