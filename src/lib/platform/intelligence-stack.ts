export interface IntelligenceLayerDefinition {
  id:
    | "national-base"
    | "infrastructure-energy"
    | "facility-graph"
    | "supply-chains"
    | "opportunity-tracker"
    | "planttrace";
  name: string;
  shortName: string;
  href: string;
  category: "industrial-tracker" | "planttrace";
  tagline: string;
  description: string;
  questions: string[];
  sources: string[];
}

export const BASELOAD_INTELLIGENCE_STACK: IntelligenceLayerDefinition[] = [
  {
    id: "national-base",
    name: "National Industrial Base",
    shortName: "National Base",
    href: "/industrial-tracker/national-base",
    category: "industrial-tracker",
    tagline: "Map where industrial capacity exists and where public dollars are landing.",
    description:
      "The macro layer of the platform: industrial footprint, sector mix, federal capital concentration, and strategic regional buildout.",
    questions: [
      "Where are the most important industrial regions and sectors?",
      "Which counties and metros are attracting federal manufacturing capital?",
      "How does current buildout compare across the national base?",
    ],
    sources: ["EPA FRS", "USAspending", "Census manufacturing", "BEA industry output", "EPA TRI"],
  },
  {
    id: "infrastructure-energy",
    name: "Infrastructure & Energy",
    shortName: "Infrastructure",
    href: "/industrial-tracker/infrastructure-energy",
    category: "industrial-tracker",
    tagline: "Understand which regions can support new industrial buildout.",
    description:
      "Power, utilities, and industrial feasibility: generation, grid pressure, service territories, and interconnection lead signals.",
    questions: [
      "Which regions have the power and utility support for large plants?",
      "Where are energy constraints likely to slow industrial expansion?",
      "Which interconnection and utility signals point to future buildout?",
    ],
    sources: ["EIA-860", "EIA-923", "eGRID", "Interconnection queues", "Utility territories"],
  },
  {
    id: "facility-graph",
    name: "Facility Evidence Graph",
    shortName: "Facility Graph",
    href: "/industrial-tracker/facility-graph",
    category: "industrial-tracker",
    tagline: "Anchor the platform on real facilities and observed evidence.",
    description:
      "The facility-centered evidence spine that links registry records, permits, emissions, program IDs, and regulatory observations into one graph.",
    questions: [
      "Which facilities are real, linked, and observed across datasets?",
      "What program systems and permits tie back to each site?",
      "How much evidence supports each facility record?",
    ],
    sources: ["EPA FRS", "EPA ECHO", "RCRAInfo", "NPDES", "GHGRP", "Air permits"],
  },
  {
    id: "supply-chains",
    name: "Supply Chains & Signals",
    shortName: "Supply Chains",
    href: "/industrial-tracker/supply-chains",
    category: "industrial-tracker",
    tagline: "Connect projects, freight, sourcing, and industrial movement.",
    description:
      "The flow layer: trade, freight, suppliers, project momentum, and industrial movement around facilities and regions.",
    questions: [
      "Where are supplier and logistics shifts changing industrial demand?",
      "Which projects are creating downstream sourcing opportunities?",
      "How are freight and trade flows reinforcing industrial clusters?",
    ],
    sources: ["Census trade", "USITC DataWeb", "FAF", "USACE WCSC", "Rail and port flows"],
  },
  {
    id: "opportunity-tracker",
    name: "Opportunity Tracker",
    shortName: "Opportunity Tracker",
    href: "/industrial-tracker/opportunity-tracker",
    category: "industrial-tracker",
    tagline: "Track where money and project momentum are concentrating.",
    description:
      "The capital and signal lens inside Industrial Tracker. It combines awards, incentives, permits, and emerging project signals into ranked industrial opportunity.",
    questions: [
      "Where is federal and incentive-backed industrial momentum building?",
      "Which geographies show both capital and project reality signals?",
      "What should be escalated now versus watched for validation?",
    ],
    sources: ["USAspending", "State incentives", "DOE/CHIPS awards", "Permitting timelines", "Industrial announcements"],
  },
  {
    id: "planttrace",
    name: "Mission Map",
    shortName: "Mission Map",
    href: "/planttrace",
    category: "planttrace",
    tagline: "Reconstruct what is likely inside the plant.",
    description:
      "The plant-level modeling lens that consumes evidence from the layers above to infer process type, automation, and OT environment characteristics.",
    questions: [
      "What is this facility likely doing operationally?",
      "What kind of process and automation environment does it imply?",
      "How does outside-the-fence evidence translate into plant reconstruction?",
    ],
    sources: ["Facility evidence graph", "Energy signals", "Permits", "Investment projects", "Operational evidence"],
  },
];

export const INDUSTRIAL_TRACKER_LAYERS = BASELOAD_INTELLIGENCE_STACK.filter(
  (layer) => layer.category === "industrial-tracker"
);

export function getIntelligenceLayer(layerId: IntelligenceLayerDefinition["id"]) {
  return BASELOAD_INTELLIGENCE_STACK.find((layer) => layer.id === layerId) || null;
}
