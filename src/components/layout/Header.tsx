"use client";

import { useState } from "react";
import Link from "next/link";
import BaseloadLogo from "@/components/marketing/BaseloadLogo";
import PlatformNav from "@/components/platform/PlatformNav";

interface Site {
  id: string;
  slug: string;
  name: string;
  reconstructionScore: number;
  gapCount: number;
}

interface HeaderProps {
  currentSite?: Site;
  sites?: Site[];
  userName?: string;
}

export default function Header({ currentSite, sites = [], userName = "User" }: HeaderProps) {
  const [siteMenuOpen, setSiteMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="app-shell-card m-3 mb-0 h-16 rounded-xl px-5 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="hidden xl:block">
          <BaseloadLogo compact accent="dark" />
        </div>
        <PlatformNav className="hidden lg:flex" />
        {currentSite ? (
          <div className="relative">
            <button
              onClick={() => setSiteMenuOpen(!siteMenuOpen)}
              className="app-nav-link flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors"
            >
              <span className="text-sm text-slate-500">Site</span>
              <span className="text-sm font-semibold text-slate-900">{currentSite.name}</span>
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
              </svg>
            </button>

            {siteMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSiteMenuOpen(false)} />
                <div className="app-menu absolute top-full left-0 mt-1 w-72 rounded-xl py-2 z-20">
                  <div className="px-3 py-2 border-b border-slate-200/80">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Switch Site</div>
                  </div>
                  {sites.map((site) => (
                    <Link
                      key={site.id}
                      href={`/sites/${site.slug}`}
                      onClick={() => setSiteMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2 hover:bg-slate-100 ${
                        site.id === currentSite.id ? "app-nav-link-active" : ""
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-900">{site.name}</div>
                        <div className="text-xs text-slate-500">{site.gapCount} gaps</div>
                      </div>
                      <div
                        className={`text-sm font-semibold ${
                          site.reconstructionScore >= 90
                            ? "text-emerald-400"
                            : site.reconstructionScore >= 70
                              ? "text-amber-300"
                              : "text-rose-300"
                        }`}
                      >
                        {site.reconstructionScore}%
                      </div>
                    </Link>
                  ))}
                  <div className="border-t border-slate-200/80 mt-2 pt-2 px-3">
                    <Link
                      href="/"
                      onClick={() => setSiteMenuOpen(false)}
                      className="flex items-center gap-2 text-sm text-cyan-700 hover:text-cyan-900 py-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                      </svg>
                      View All Sites
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-sm font-semibold text-slate-900">All Sites</div>
        )}

        {currentSite && (
          <div className="app-chip flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            {currentSite.reconstructionScore}% Reconstructed
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/ai"
          className="app-nav-link app-nav-link-active flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          AI Query
        </Link>

        <button className="app-nav-link p-2 rounded-lg transition-colors" aria-label="Notifications">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </button>

        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="app-nav-link flex items-center gap-2 p-1.5 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 app-nav-link-active rounded-full flex items-center justify-center text-sm font-medium">
              {userName.charAt(0).toUpperCase()}
            </div>
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
              <div className="app-menu absolute top-full right-0 mt-1 w-52 rounded-xl py-2 z-20">
                <div className="px-3 py-2 border-b border-slate-200/80">
                  <div className="text-sm font-medium text-slate-900">{userName}</div>
                  <div className="text-xs text-slate-500">Administrator</div>
                </div>
                <Link href="/framework" className="block px-3 py-2 text-sm app-nav-link rounded-md mx-1">
                  Framework
                </Link>
                <Link href="/roi" className="block px-3 py-2 text-sm app-nav-link rounded-md mx-1">
                  ROI Model
                </Link>
                <Link href="/ingest" className="block px-3 py-2 text-sm app-nav-link rounded-md mx-1">
                  Data Sources
                </Link>
                <div className="border-t border-slate-200/80 mt-1 pt-1">
                  <button className="block w-full text-left px-3 py-2 text-sm app-nav-link rounded-md mx-1">
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
