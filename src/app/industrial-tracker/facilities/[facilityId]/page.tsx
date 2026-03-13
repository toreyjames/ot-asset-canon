import Link from "next/link";
import BaseloadLogo from "@/components/marketing/BaseloadLogo";
import { loadIndustrialTrackerFacilityDetail } from "@/lib/industrial-tracker/facility-detail";

function formatDate(value?: string) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function IndustrialTrackerFacilityPage({
  params,
}: {
  params: Promise<{ facilityId: string }>;
}) {
  const { facilityId } = await params;
  const detail = await loadIndustrialTrackerFacilityDetail(facilityId);

  if (!detail) {
    return (
      <div className="min-h-screen bg-[#071019] px-4 py-10 text-slate-100 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <BaseloadLogo href="/" />
          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h1 className="text-2xl font-semibold text-white">Facility not found</h1>
            <p className="mt-3 text-sm text-slate-300">
              This Industrial Tracker facility detail does not exist in the current graph.
            </p>
            <Link
              href="/industrial-tracker"
              className="mt-6 inline-flex rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200"
            >
              Back to Industrial Tracker
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#071019] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <BaseloadLogo href="/" />
          <div className="flex items-center gap-3">
            <Link
              href="/industrial-tracker"
              className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60"
            >
              Back to Industrial Tracker
            </Link>
            <Link
              href="/planttrace"
              className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-emerald-400/60"
            >
              PlantTrace
            </Link>
          </div>
        </header>

        <main className="mt-12">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">
                Facility Detail
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-white md:text-5xl">
                {detail.facilityName}
              </h1>
              <p className="mt-3 text-base text-slate-300">{detail.geography}</p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <MetricCard
                  label="Latest Evidence"
                  value={detail.latestEvidenceType || "observed"}
                  note={formatDate(detail.latestObservedAt)}
                />
                <MetricCard
                  label="Latest Event"
                  value={detail.latestEventType || "observed"}
                  note={
                    detail.programLinks.length > 0
                      ? `${detail.programLinks.length} program links`
                      : "No program links yet"
                  }
                />
                <MetricCard
                  label="Facility IDs"
                  value={Object.keys(detail.sourceIds).length.toString()}
                  note={detail.companyName || "No linked entity"}
                />
                <MetricCard
                  label="Map Point"
                  value={detail.mapPoint?.status || "pending"}
                  note={
                    detail.mapPoint
                      ? `${detail.mapPoint.latitude.toFixed(4)}, ${detail.mapPoint.longitude.toFixed(4)}`
                      : "No validated coordinates in metadata"
                  }
                />
              </div>

              <div className="mt-8 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Source Anchors
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(detail.sourceIds).length > 0 ? (
                    Object.entries(detail.sourceIds).map(([key, value]) => (
                      <span
                        key={key}
                        className="rounded-full border border-slate-700 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300"
                      >
                        {key}: {value}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">No source IDs recorded.</span>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Program Links</p>
              <div className="mt-4 space-y-3">
                {detail.programLinks.length > 0 ? (
                  detail.programLinks.map((link) => (
                    <div
                      key={`${link.programType}-${link.externalProgramId}`}
                      className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-white">{link.programType}</div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          {link.agency || "EPA"}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-cyan-300">{link.externalProgramId}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
                    No EPA program links are attached to this facility yet.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <TimelineSection
              title="Evidence Timeline"
              items={detail.evidenceTimeline.map((item) => ({
                id: item.id,
                title: item.evidenceType,
                subtitle: item.sourceName,
                date: item.observedAt,
              }))}
            />

            <TimelineSection
              title="Facility Event Timeline"
              items={detail.eventTimeline.map((item) => ({
                id: item.id,
                title: item.eventType,
                subtitle: "Industrial Tracker event",
                date: item.occurredAt,
              }))}
            />
          </div>

          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold text-white">Action Queue</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <ActionCard
                title="Validate process hierarchy"
                detail={
                  detail.programLinks.length > 0
                    ? "Program links present. Confirm site/facility/line assignment in mission map."
                    : "Program links missing. Prioritize registry + permit anchor linkage."
                }
              />
              <ActionCard
                title="Confirm map location"
                detail={
                  detail.mapPoint?.status === "validated"
                    ? "Coordinates validated for map placement."
                    : "Coordinate metadata missing or invalid. Add verified lat/lon."
                }
              />
              <ActionCard
                title="Increase evidence confidence"
                detail={
                  detail.evidenceTimeline.length >= 4
                    ? "Evidence depth is strong enough for line-level inference."
                    : "Collect additional evidence sources to raise confidence."
                }
              />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-3 text-lg font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{note}</div>
    </div>
  );
}

function TimelineSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; title: string; subtitle: string; date: string }>;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{item.title}</div>
                  <div className="mt-1 text-sm text-slate-400">{item.subtitle}</div>
                </div>
                <div className="text-xs text-slate-500">{formatDate(item.date)}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
            No timeline records available.
          </div>
        )}
      </div>
    </section>
  );
}

function ActionCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="mt-2 text-sm text-slate-400">{detail}</div>
    </div>
  );
}
