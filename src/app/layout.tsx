import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OT Asset Canon | Converged Plant Intelligence",
  description:
    "The foundation for OT Security, Operations, and AI - a converged view of the plant from physical process through enterprise integration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-gray-50 dark:bg-gray-900">
        <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <div className="flex items-center gap-1">
                    {/* Canon layer indicator dots */}
                    <span className="w-2 h-2 rounded-full bg-layer1"></span>
                    <span className="w-2 h-2 rounded-full bg-layer2"></span>
                    <span className="w-2 h-2 rounded-full bg-layer3"></span>
                    <span className="w-2 h-2 rounded-full bg-layer4"></span>
                    <span className="w-2 h-2 rounded-full bg-layer5"></span>
                    <span className="w-2 h-2 rounded-full bg-layer6"></span>
                  </div>
                  <span className="ml-3 text-xl font-bold text-gray-900 dark:text-white">
                    OT Asset Canon
                  </span>
                </div>
                <nav className="ml-10 flex space-x-4">
                  <a
                    href="/"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Dashboard
                  </a>
                  <a
                    href="/ingest"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    1. Ingest Data
                  </a>
                  <a
                    href="/inventory"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    2. Inventory
                  </a>
                  <a
                    href="/explorer"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    3. Explorer
                  </a>
                  <a
                    href="/risk"
                    className="text-gray-500 dark:text-gray-500 px-3 py-2 rounded-md text-sm font-medium opacity-50 cursor-not-allowed"
                    title="Complete inventory first"
                  >
                    4. Risk (locked)
                  </a>
                </nav>
              </div>
              <div className="flex items-center">
                <a
                  href="/ai"
                  className="bg-layer5 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  AI Query
                </a>
              </div>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
