import type { Metadata } from "next";
import "./globals.css";
import PlantRealityCanvas from "@/components/layout/PlantRealityCanvas";
import { PLATFORM_BRAND } from "@/lib/platform/brand";

export const metadata: Metadata = {
  title: `${PLATFORM_BRAND.companyName} | ${PLATFORM_BRAND.tagline}`,
  description: PLATFORM_BRAND.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="theme-baseload antialiased relative overflow-x-hidden">
        <PlantRealityCanvas />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
