export default function FrameworkPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-gray-900">PlantTrace Framework v1</h1>
      <p className="mt-3 text-gray-600">
        A multi-plant framework for establishing asset truth first: count assets, prove evidence, and verify baseline
        security coverage. Risk and consequence are downstream overlays.
      </p>

      <section className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900">Problem We Solve</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li><strong>Primary:</strong> Industrial organizations often lack a stable, evidence-backed OT inventory across plants.</li>
          <li><strong>Secondary:</strong> Teams lack a central view of asset evidence quality and baseline security coverage.</li>
          <li><strong>Long-term:</strong> Poor inventory quality blocks reliable CMDB synchronization and lifecycle management.</li>
          <li>Risk, vulnerability, and criticality workflows are low-confidence without this upstream asset truth.</li>
        </ul>
      </section>

      <section className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900">Framework Layers</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900">1. Portfolio Layer</h3>
            <p className="text-gray-600 mt-1">Org-wide view across plants, trends, and coverage posture.</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900">2. Plant Layer</h3>
            <p className="text-gray-600 mt-1">Site-level reconstruction, completeness, and baseline controls.</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900">3. Line/Unit Layer</h3>
            <p className="text-gray-600 mt-1">Process continuity, redundancy groups, and failover behavior.</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900">4. Asset Layer</h3>
            <p className="text-gray-600 mt-1">Identity, source evidence, and baseline coverage status.</p>
          </div>
        </div>
      </section>

      <section className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900">Agent Workflow</h2>
        <ol className="mt-3 space-y-2 text-sm text-gray-700 list-decimal pl-5">
          <li>Ingest Agent: normalize OT, engineering, and security telemetry.</li>
          <li>Entity Agent: deduplicate and resolve asset identity.</li>
          <li>Topology Agent: build a light process/control/network map.</li>
          <li>Continuity Agent: validate operational continuity and redundancy assumptions.</li>
          <li>Coverage Agent: determine securable assets and baseline control presence.</li>
          <li>Evidence Agent: provide explainable provenance for every assertion.</li>
        </ol>
      </section>

      <section className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900">Data and Storage Strategy</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li>Use canonical current-state tables for fast query paths.</li>
          <li>Store deltas and snapshot aggregates to control storage growth.</li>
          <li>Store heavy raw connector files in object storage with lifecycle retention.</li>
          <li>Return sampled assets to UI for visualization while keeping full datasets server-side.</li>
        </ul>
      </section>

      <section className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900">Boundaries</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li>This is not a vulnerability scoring engine.</li>
          <li>This does not assign customer criticality or risk ratings.</li>
          <li>This system supplies evidence and coverage context into those workflows.</li>
        </ul>
      </section>
    </div>
  );
}
