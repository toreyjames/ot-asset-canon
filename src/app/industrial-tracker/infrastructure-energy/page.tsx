import IndustrialTrackerLayerPage from "@/components/industrial-tracker/IndustrialTrackerLayerPage";
import { getIntelligenceLayer } from "@/lib/platform/intelligence-stack";

const layer = getIntelligenceLayer("infrastructure-energy");

export default function InfrastructureEnergyPage() {
  if (!layer) return null;
  return <IndustrialTrackerLayerPage layer={layer} />;
}
