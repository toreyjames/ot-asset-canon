import IndustrialTrackerLayerPage from "@/components/industrial-tracker/IndustrialTrackerLayerPage";
import { getIntelligenceLayer } from "@/lib/platform/intelligence-stack";

const layer = getIntelligenceLayer("facility-graph");

export default function FacilityGraphPage() {
  if (!layer) return null;
  return <IndustrialTrackerLayerPage layer={layer} />;
}
