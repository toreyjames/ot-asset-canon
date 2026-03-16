import IndustrialTrackerLayerPage from "@/components/industrial-tracker/IndustrialTrackerLayerPage";
import { getIntelligenceLayer } from "@/lib/platform/intelligence-stack";

const layer = getIntelligenceLayer("national-base");

export default function NationalBasePage() {
  if (!layer) return null;
  return <IndustrialTrackerLayerPage layer={layer} />;
}
