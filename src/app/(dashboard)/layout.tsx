import AppShell from "@/components/layout/AppShell";

// Demo sites for header dropdown
const DEMO_SITES = [
  { id: "1", slug: "houston-plant", name: "Houston Plant", reconstructionScore: 84, gapCount: 7 },
  { id: "2", slug: "rotterdam-facility", name: "Rotterdam Facility", reconstructionScore: 94, gapCount: 3 },
  { id: "3", slug: "singapore-ops", name: "Singapore Operations", reconstructionScore: 71, gapCount: 12 },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell sites={DEMO_SITES} showSidebar={false}>
      {children}
    </AppShell>
  );
}
