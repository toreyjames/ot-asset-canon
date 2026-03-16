import IndustrialTrackerLayerPage from "@/components/industrial-tracker/IndustrialTrackerLayerPage";
import { getIntelligenceLayer } from "@/lib/platform/intelligence-stack";

const layer = getIntelligenceLayer("supply-chains");

export default function SupplyChainsPage() {
  if (!layer) return null;
  return <IndustrialTrackerLayerPage layer={layer} />;
}
