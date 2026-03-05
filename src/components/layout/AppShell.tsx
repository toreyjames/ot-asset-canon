"use client";

import Sidebar from "./Sidebar";
import Header from "./Header";

interface Site {
  id: string;
  slug: string;
  name: string;
  reconstructionScore: number;
  gapCount: number;
}

interface AppShellProps {
  children: React.ReactNode;
  currentSite?: Site;
  sites?: Site[];
  showSidebar?: boolean;
}

export default function AppShell({
  children,
  currentSite,
  sites = [],
  showSidebar = true,
}: AppShellProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      {showSidebar && (
        <Sidebar
          siteSlug={currentSite?.slug}
          siteName={currentSite?.name}
        />
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header
          currentSite={currentSite}
          sites={sites}
        />

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
