import type { Metadata } from "next";
import "./globals.css";
import PlantRealityCanvas from "@/components/layout/PlantRealityCanvas";

export const metadata: Metadata = {
  title: "PlantTrace | OT Asset Assurance",
  description:
    "Build an evidence-backed OT asset baseline, verify coverage, and operationalize plant visibility.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased relative overflow-x-hidden">
        <PlantRealityCanvas />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
