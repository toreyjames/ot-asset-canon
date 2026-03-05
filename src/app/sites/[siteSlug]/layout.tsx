import AppShell from "@/components/layout/AppShell";

// Demo sites - in production this would come from database
const DEMO_SITES = [
  { id: "1", slug: "houston-plant", name: "Houston Plant", reconstructionScore: 84, gapCount: 7 },
  { id: "2", slug: "rotterdam-facility", name: "Rotterdam Facility", reconstructionScore: 94, gapCount: 3 },
  { id: "3", slug: "singapore-ops", name: "Singapore Operations", reconstructionScore: 71, gapCount: 12 },
];

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const currentSite = DEMO_SITES.find((s) => s.slug === siteSlug) || DEMO_SITES[0];

  return (
    <AppShell currentSite={currentSite} sites={DEMO_SITES} showSidebar={true}>
      {children}
    </AppShell>
  );
}
