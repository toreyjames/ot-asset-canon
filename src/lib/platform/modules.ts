export type PlatformModuleId = "planttrace" | "industrial-tracker";

export interface PlatformModuleDefinition {
  id: PlatformModuleId;
  name: string;
  href: string;
  scope: "inside-the-plant" | "outside-the-plant";
  description: string;
}

export const PLATFORM_MODULES: PlatformModuleDefinition[] = [
  {
    id: "planttrace",
    name: "Mission Map",
    href: "/planttrace",
    scope: "inside-the-plant",
    description:
      "Reconstruct OT and facility reality from engineering, network, and operational evidence.",
  },
  {
    id: "industrial-tracker",
    name: "Industrial Tracker",
    href: "/industrial-tracker",
    scope: "outside-the-plant",
    description:
      "Track supply chains, incentives, permits, energy, logistics, and where industrial money is moving.",
  },
];
