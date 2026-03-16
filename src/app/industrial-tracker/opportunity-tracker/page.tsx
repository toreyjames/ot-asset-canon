import IndustrialTrackerLayerPage from "@/components/industrial-tracker/IndustrialTrackerLayerPage";
import { getIntelligenceLayer } from "@/lib/platform/intelligence-stack";

const layer = getIntelligenceLayer("opportunity-tracker");

export default function OpportunityTrackerPage() {
  if (!layer) return null;
  return <IndustrialTrackerLayerPage layer={layer} />;
}
