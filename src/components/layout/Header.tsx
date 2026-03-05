"use client";

import { useState } from "react";
import Link from "next/link";

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
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      {/* Left: Breadcrumb / Site selector */}
      <div className="flex items-center gap-4">
        {currentSite ? (
          <div className="relative">
            <button
              onClick={() => setSiteMenuOpen(!siteMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-sm text-gray-500">Site:</span>
              <span className="text-sm font-semibold text-gray-900">{currentSite.name}</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
              </svg>
            </button>

            {/* Dropdown */}
            {siteMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSiteMenuOpen(false)} />
                <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Switch Site</div>
                  </div>
                  {sites.map((site) => (
                    <Link
                      key={site.id}
                      href={`/sites/${site.slug}`}
                      onClick={() => setSiteMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2 hover:bg-gray-50 ${
                        site.id === currentSite.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900">{site.name}</div>
                        <div className="text-xs text-gray-500">{site.gapCount} gaps</div>
                      </div>
                      <div className={`text-sm font-semibold ${
                        site.reconstructionScore >= 90 ? "text-green-600" :
                        site.reconstructionScore >= 70 ? "text-yellow-600" : "text-red-600"
                      }`}>
                        {site.reconstructionScore}%
                      </div>
                    </Link>
                  ))}
                  <div className="border-t border-gray-100 mt-2 pt-2 px-3">
                    <Link
                      href="/"
                      onClick={() => setSiteMenuOpen(false)}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 py-1"
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
          <div className="text-sm font-semibold text-gray-900">All Sites</div>
        )}

        {/* Reconstruction score badge */}
        {currentSite && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            currentSite.reconstructionScore >= 90
              ? "bg-green-100 text-green-700"
              : currentSite.reconstructionScore >= 70
                ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            {currentSite.reconstructionScore}% Reconstructed
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* AI Query */}
        <Link
          href="/ai"
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          </svg>
          AI Query
        </Link>

        {/* Notifications */}
        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {userName.charAt(0).toUpperCase()}
            </div>
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                <div className="px-3 py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-900">{userName}</div>
                  <div className="text-xs text-gray-500">Administrator</div>
                </div>
                <Link
                  href="/settings"
                  className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Account Settings
                </Link>
                <Link
                  href="/help"
                  className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Help & Support
                </Link>
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
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
