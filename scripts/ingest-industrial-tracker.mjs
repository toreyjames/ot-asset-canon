import {
  emptyBundle,
  mergeRowsById,
  persistBundle,
  readIntEnv,
} from "./lib/industrial-tracker-ingestion/common.mjs";
import { ingestEiaElectricity } from "./lib/industrial-tracker-ingestion/eia-electricity.mjs";
import { ingestEiaGridMonitor } from "./lib/industrial-tracker-ingestion/eia-grid-monitor.mjs";
import { ingestDoeEdfProjects } from "./lib/industrial-tracker-ingestion/doe-edf-projects.mjs";
import { ingestEpaEcho } from "./lib/industrial-tracker-ingestion/epa-echo.mjs";
import { ingestEpaFrs } from "./lib/industrial-tracker-ingestion/epa-frs.mjs";
import { ingestProjectFeed } from "./lib/industrial-tracker-ingestion/project-feed.mjs";
import { ingestSecFilings } from "./lib/industrial-tracker-ingestion/sec-filings.mjs";
import { ingestInterconnectionQueue } from "./lib/industrial-tracker-ingestion/interconnection-queue.mjs";
import { ingestChipsAwards } from "./lib/industrial-tracker-ingestion/chips-awards.mjs";
import { ingestNyEsdIncentives } from "./lib/industrial-tracker-ingestion/ny-esd-incentives.mjs";
import { ingestTexasGovernorProjects } from "./lib/industrial-tracker-ingestion/texas-governor-projects.mjs";
import { ingestMichiganMedcProjects } from "./lib/industrial-tracker-ingestion/michigan-medc-projects.mjs";
import { ingestArizonaCommerceProjects } from "./lib/industrial-tracker-ingestion/arizona-commerce-projects.mjs";
import { ingestArkansasAedcProjects } from "./lib/industrial-tracker-ingestion/arkansas-aedc-projects.mjs";
import { ingestOhioJobsProjects } from "./lib/industrial-tracker-ingestion/ohio-jobs-projects.mjs";
import { ingestGeorgiaGovernorProjects } from "./lib/industrial-tracker-ingestion/georgia-governor-projects.mjs";
import { ingestNorthCarolinaCommerceProjects } from "./lib/industrial-tracker-ingestion/north-carolina-commerce-projects.mjs";
import { ingestTennesseeEcdProjects } from "./lib/industrial-tracker-ingestion/tennessee-ecd-projects.mjs";
import { ingestSouthCarolinaCommerceProjects } from "./lib/industrial-tracker-ingestion/south-carolina-commerce-projects.mjs";
import { ingestKentuckyCedProjects } from "./lib/industrial-tracker-ingestion/kentucky-ced-projects.mjs";
import { ingestVirginiaVedpProjects } from "./lib/industrial-tracker-ingestion/virginia-vedp-projects.mjs";
import { ingestIndianaIedcProjects } from "./lib/industrial-tracker-ingestion/indiana-iedc-projects.mjs";
import { ingestAlabamaCommerceProjects } from "./lib/industrial-tracker-ingestion/alabama-commerce-projects.mjs";
import { ingestLouisianaLedProjects } from "./lib/industrial-tracker-ingestion/louisiana-led-projects.mjs";
import { ingestMississippiMdaProjects } from "./lib/industrial-tracker-ingestion/mississippi-mda-projects.mjs";
import { ingestIllinoisEdcProjects } from "./lib/industrial-tracker-ingestion/illinois-edc-projects.mjs";
import { ingestMissouriDedProjects } from "./lib/industrial-tracker-ingestion/missouri-ded-projects.mjs";
import { ingestKansasCommerceProjects } from "./lib/industrial-tracker-ingestion/kansas-commerce-projects.mjs";
import { ingestOklahomaCommerceProjects } from "./lib/industrial-tracker-ingestion/oklahoma-commerce-projects.mjs";
import { ingestWestVirginiaEconomicDevelopmentProjects } from "./lib/industrial-tracker-ingestion/west-virginia-economic-development-projects.mjs";
import { ingestIowaIedaProjects } from "./lib/industrial-tracker-ingestion/iowa-ieda-projects.mjs";
import { ingestNewJerseyNjedaProjects } from "./lib/industrial-tracker-ingestion/new-jersey-njeda-projects.mjs";
import { ingestPennsylvaniaDcedProjects } from "./lib/industrial-tracker-ingestion/pennsylvania-dced-projects.mjs";
import { ingestMarylandCommerceProjects } from "./lib/industrial-tracker-ingestion/maryland-commerce-projects.mjs";
import { ingestNewMexicoEddProjects } from "./lib/industrial-tracker-ingestion/new-mexico-edd-projects.mjs";
import { ingestNevadaGovernorProjects } from "./lib/industrial-tracker-ingestion/nevada-governor-projects.mjs";
import { ingestIdahoCommerceProjects } from "./lib/industrial-tracker-ingestion/idaho-commerce-projects.mjs";
import { ingestNebraskaDedProjects } from "./lib/industrial-tracker-ingestion/nebraska-ded-projects.mjs";
import { ingestUtahGoeoProjects } from "./lib/industrial-tracker-ingestion/utah-goeo-projects.mjs";
import { ingestCaliforniaGobizProjects } from "./lib/industrial-tracker-ingestion/california-gobiz-projects.mjs";
import { ingestFloridaGovernorProjects } from "./lib/industrial-tracker-ingestion/florida-governor-projects.mjs";
import { ingestColoradoGovernorProjects } from "./lib/industrial-tracker-ingestion/colorado-governor-projects.mjs";
import { ingestWashingtonCommerceProjects } from "./lib/industrial-tracker-ingestion/washington-commerce-projects.mjs";
import { ingestOregonBusinessProjects } from "./lib/industrial-tracker-ingestion/oregon-business-projects.mjs";
import { ingestUsaSpending } from "./lib/industrial-tracker-ingestion/usaspending.mjs";
import { ingestPrivateCapitalFeed } from "./lib/industrial-tracker-ingestion/private-capital-feed.mjs";
import { pathToFileURL } from "node:url";

function mergeBundles(...bundles) {
  const merged = emptyBundle();

  for (const key of Object.keys(merged)) {
    merged[key] = mergeRowsById(...bundles.map((bundle) => bundle[key] || []));
  }

  return merged;
}

function sourceCleanupConfig(sourceName) {
  switch (sourceName) {
    case "usaspending":
      return {
        replaceSourceSystems: ["USAspending"],
        cleanupPaths: ["evidence_records?dataset=eq.spending_by_award"],
      };
    case "ny-esd-incentives":
      return {
        replaceSourceSystems: ["Empire State Development Incentives"],
        cleanupPaths: [],
      };
    case "texas-governor-projects":
      return {
        replaceSourceSystems: ["Texas Strategic Projects"],
        cleanupPaths: [],
      };
    case "michigan-medc-projects":
      return {
        replaceSourceSystems: ["Michigan Strategic Projects"],
        cleanupPaths: [],
      };
    case "arizona-commerce-projects":
      return {
        replaceSourceSystems: ["Arizona Strategic Projects"],
        cleanupPaths: [],
      };
    case "arkansas-aedc-projects":
      return {
        replaceSourceSystems: ["Arkansas Strategic Projects"],
        cleanupPaths: [],
      };
    case "ohio-jobs-projects":
      return {
        replaceSourceSystems: ["Ohio Strategic Projects"],
        cleanupPaths: [],
      };
    case "georgia-governor-projects":
      return {
        replaceSourceSystems: ["Georgia Strategic Projects"],
        cleanupPaths: [],
      };
    case "north-carolina-commerce-projects":
      return {
        replaceSourceSystems: ["North Carolina Strategic Projects"],
        cleanupPaths: [],
      };
    case "tennessee-ecd-projects":
      return {
        replaceSourceSystems: ["Tennessee Strategic Projects"],
        cleanupPaths: [],
      };
    case "south-carolina-commerce-projects":
      return {
        replaceSourceSystems: ["South Carolina Strategic Projects"],
        cleanupPaths: [],
      };
    case "kentucky-ced-projects":
      return {
        replaceSourceSystems: ["Kentucky Strategic Projects"],
        cleanupPaths: [],
      };
    case "virginia-vedp-projects":
      return {
        replaceSourceSystems: ["Virginia Strategic Projects"],
        cleanupPaths: [],
      };
    case "indiana-iedc-projects":
      return {
        replaceSourceSystems: ["Indiana Strategic Projects"],
        cleanupPaths: [],
      };
    case "alabama-commerce-projects":
      return {
        replaceSourceSystems: ["Alabama Strategic Projects"],
        cleanupPaths: [],
      };
    case "louisiana-led-projects":
      return {
        replaceSourceSystems: ["Louisiana Strategic Projects"],
        cleanupPaths: [],
      };
    case "mississippi-mda-projects":
      return {
        replaceSourceSystems: ["Mississippi Strategic Projects"],
        cleanupPaths: [],
      };
    case "illinois-edc-projects":
      return {
        replaceSourceSystems: ["Illinois Strategic Projects"],
        cleanupPaths: [],
      };
    case "missouri-ded-projects":
      return {
        replaceSourceSystems: ["Missouri Strategic Projects"],
        cleanupPaths: [],
      };
    case "kansas-commerce-projects":
      return {
        replaceSourceSystems: ["Kansas Strategic Projects"],
        cleanupPaths: [],
      };
    case "oklahoma-commerce-projects":
      return {
        replaceSourceSystems: ["Oklahoma Strategic Projects"],
        cleanupPaths: [],
      };
    case "west-virginia-economic-development-projects":
      return {
        replaceSourceSystems: ["West Virginia Strategic Projects"],
        cleanupPaths: [],
      };
    case "iowa-ieda-projects":
      return {
        replaceSourceSystems: ["Iowa Strategic Projects"],
        cleanupPaths: [],
      };
    case "new-jersey-njeda-projects":
      return {
        replaceSourceSystems: ["New Jersey Strategic Projects"],
        cleanupPaths: [],
      };
    case "pennsylvania-dced-projects":
      return {
        replaceSourceSystems: ["Pennsylvania Strategic Projects"],
        cleanupPaths: [],
      };
    case "maryland-commerce-projects":
      return {
        replaceSourceSystems: ["Maryland Strategic Projects"],
        cleanupPaths: [],
      };
    case "new-mexico-edd-projects":
      return {
        replaceSourceSystems: ["New Mexico Strategic Projects"],
        cleanupPaths: [],
      };
    case "nevada-governor-projects":
      return {
        replaceSourceSystems: ["Nevada Strategic Projects"],
        cleanupPaths: [],
      };
    case "utah-goeo-projects":
      return {
        replaceSourceSystems: ["Utah Strategic Projects"],
        cleanupPaths: [],
      };
    case "idaho-commerce-projects":
      return {
        replaceSourceSystems: ["Idaho Strategic Projects"],
        cleanupPaths: [],
      };
    case "nebraska-ded-projects":
      return {
        replaceSourceSystems: ["Nebraska Strategic Projects"],
        cleanupPaths: [],
      };
    case "california-gobiz-projects":
      return {
        replaceSourceSystems: ["California Strategic Projects"],
        cleanupPaths: [],
      };
    case "florida-governor-projects":
      return {
        replaceSourceSystems: ["Florida Strategic Projects"],
        cleanupPaths: [],
      };
    case "colorado-governor-projects":
      return {
        replaceSourceSystems: ["Colorado Strategic Projects"],
        cleanupPaths: [],
      };
    case "washington-commerce-projects":
      return {
        replaceSourceSystems: ["Washington Strategic Projects"],
        cleanupPaths: [],
      };
    case "oregon-business-projects":
      return {
        replaceSourceSystems: ["Oregon Strategic Projects"],
        cleanupPaths: [],
      };
    case "private-capital-feed":
      return {
        replaceSourceSystems: [
          "Baseload private capex feed",
          "Baseload private capital market feed",
          "Baseload private infrastructure financing feed",
          "Baseload private manufacturing equity debt feed",
          "Baseload private transmission financing feed",
          "Baseload private water thermal financing feed",
          "Baseload private onsite power financing feed",
          "Baseload private industrial real estate financing feed",
          "Baseload private fuel logistics financing feed",
          "Baseload private rail logistics financing feed",
          "Baseload private circular industry financing feed",
          "Baseload private grid resilience financing feed",
          "Baseload private industrial communications financing feed",
          "Baseload private industrial steam financing feed",
          "Baseload private heavy equipment financing feed",
          "Baseload private waste heat recovery financing feed",
          "Baseload private industrial water rights financing feed",
          "Baseload private industrial cyber financing feed",
          "Baseload private industrial air separation financing feed",
          "Baseload private cooling infrastructure financing feed",
          "Baseload private materials handling financing feed",
          "Baseload private compressed air financing feed",
          "Baseload private industrial byproduct logistics financing feed",
        ],
        cleanupPaths: [],
      };
    default:
      return {
        replaceSourceSystems: [],
        cleanupPaths: [],
      };
  }
}

export async function runIndustrialTrackerIngestion(options = {}) {
  const sourceSelection = new Set(
    (
    options.sources?.join(",") ||
    process.env.INDUSTRIAL_TRACKER_SOURCES ||
    "usaspending,epa-frs,epa-echo,eia-electricity,eia-grid-monitor,interconnection-queue,ny-esd-incentives,texas-governor-projects,michigan-medc-projects,arizona-commerce-projects,arkansas-aedc-projects,ohio-jobs-projects,georgia-governor-projects,north-carolina-commerce-projects,tennessee-ecd-projects,south-carolina-commerce-projects,kentucky-ced-projects,virginia-vedp-projects,indiana-iedc-projects,alabama-commerce-projects,louisiana-led-projects,mississippi-mda-projects,illinois-edc-projects,missouri-ded-projects,kansas-commerce-projects,oklahoma-commerce-projects,west-virginia-economic-development-projects,iowa-ieda-projects,new-jersey-njeda-projects,pennsylvania-dced-projects,maryland-commerce-projects,new-mexico-edd-projects,nevada-governor-projects,utah-goeo-projects,idaho-commerce-projects,nebraska-ded-projects,california-gobiz-projects,florida-governor-projects,colorado-governor-projects,washington-commerce-projects,oregon-business-projects,chips-awards,doe-edf-projects,private-capital-feed"
    )
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );

  const bundles = [];
  const cleanupPaths = new Set();
  const replaceSourceSystems = new Set();
  const failures = [];

  async function ingestSource(sourceName, run) {
    try {
      bundles.push(await run());
      const cleanupConfig = sourceCleanupConfig(sourceName);
      cleanupConfig.cleanupPaths.forEach((path) => cleanupPaths.add(path));
      cleanupConfig.replaceSourceSystems.forEach((sourceSystem) =>
        replaceSourceSystems.add(sourceSystem)
      );
    } catch (error) {
      failures.push({
        source: sourceName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (sourceSelection.has("usaspending")) {
    await ingestSource("usaspending", () =>
      ingestUsaSpending({
        limit: readIntEnv("USASPENDING_LIMIT", 100),
        startDate: process.env.USASPENDING_START_DATE,
        endDate: process.env.USASPENDING_END_DATE,
      })
    );
  }

  if (sourceSelection.has("epa-frs")) {
    await ingestSource("epa-frs", () => ingestEpaFrs());
  }

  if (sourceSelection.has("epa-echo")) {
    await ingestSource("epa-echo", () => ingestEpaEcho());
  }

  if (sourceSelection.has("eia-electricity")) {
    await ingestSource("eia-electricity", () => ingestEiaElectricity());
  }

  if (sourceSelection.has("eia-grid-monitor")) {
    await ingestSource("eia-grid-monitor", () => ingestEiaGridMonitor());
  }

  if (sourceSelection.has("project-feed")) {
    await ingestSource("project-feed", () => ingestProjectFeed());
  }

  if (sourceSelection.has("sec-filings")) {
    await ingestSource("sec-filings", () => ingestSecFilings());
  }

  if (sourceSelection.has("private-capital-feed")) {
    await ingestSource("private-capital-feed", () => ingestPrivateCapitalFeed());
  }

  if (sourceSelection.has("interconnection-queue")) {
    await ingestSource("interconnection-queue", () => ingestInterconnectionQueue());
  }

  if (sourceSelection.has("ny-esd-incentives")) {
    await ingestSource("ny-esd-incentives", () => ingestNyEsdIncentives());
  }

  if (sourceSelection.has("texas-governor-projects")) {
    await ingestSource("texas-governor-projects", () => ingestTexasGovernorProjects());
  }

  if (sourceSelection.has("michigan-medc-projects")) {
    await ingestSource("michigan-medc-projects", () => ingestMichiganMedcProjects());
  }

  if (sourceSelection.has("arizona-commerce-projects")) {
    await ingestSource("arizona-commerce-projects", () => ingestArizonaCommerceProjects());
  }

  if (sourceSelection.has("arkansas-aedc-projects")) {
    await ingestSource("arkansas-aedc-projects", () => ingestArkansasAedcProjects());
  }

  if (sourceSelection.has("ohio-jobs-projects")) {
    await ingestSource("ohio-jobs-projects", () => ingestOhioJobsProjects());
  }

  if (sourceSelection.has("georgia-governor-projects")) {
    await ingestSource("georgia-governor-projects", () => ingestGeorgiaGovernorProjects());
  }

  if (sourceSelection.has("north-carolina-commerce-projects")) {
    await ingestSource("north-carolina-commerce-projects", () =>
      ingestNorthCarolinaCommerceProjects()
    );
  }

  if (sourceSelection.has("tennessee-ecd-projects")) {
    await ingestSource("tennessee-ecd-projects", () => ingestTennesseeEcdProjects());
  }

  if (sourceSelection.has("south-carolina-commerce-projects")) {
    await ingestSource("south-carolina-commerce-projects", () =>
      ingestSouthCarolinaCommerceProjects()
    );
  }

  if (sourceSelection.has("kentucky-ced-projects")) {
    await ingestSource("kentucky-ced-projects", () => ingestKentuckyCedProjects());
  }

  if (sourceSelection.has("virginia-vedp-projects")) {
    await ingestSource("virginia-vedp-projects", () => ingestVirginiaVedpProjects());
  }

  if (sourceSelection.has("indiana-iedc-projects")) {
    await ingestSource("indiana-iedc-projects", () => ingestIndianaIedcProjects());
  }

  if (sourceSelection.has("alabama-commerce-projects")) {
    await ingestSource("alabama-commerce-projects", () => ingestAlabamaCommerceProjects());
  }

  if (sourceSelection.has("louisiana-led-projects")) {
    await ingestSource("louisiana-led-projects", () => ingestLouisianaLedProjects());
  }

  if (sourceSelection.has("mississippi-mda-projects")) {
    await ingestSource("mississippi-mda-projects", () => ingestMississippiMdaProjects());
  }

  if (sourceSelection.has("illinois-edc-projects")) {
    await ingestSource("illinois-edc-projects", () => ingestIllinoisEdcProjects());
  }

  if (sourceSelection.has("missouri-ded-projects")) {
    await ingestSource("missouri-ded-projects", () => ingestMissouriDedProjects());
  }

  if (sourceSelection.has("kansas-commerce-projects")) {
    await ingestSource("kansas-commerce-projects", () => ingestKansasCommerceProjects());
  }

  if (sourceSelection.has("oklahoma-commerce-projects")) {
    await ingestSource("oklahoma-commerce-projects", () => ingestOklahomaCommerceProjects());
  }

  if (sourceSelection.has("west-virginia-economic-development-projects")) {
    await ingestSource("west-virginia-economic-development-projects", () =>
      ingestWestVirginiaEconomicDevelopmentProjects()
    );
  }

  if (sourceSelection.has("iowa-ieda-projects")) {
    await ingestSource("iowa-ieda-projects", () => ingestIowaIedaProjects());
  }

  if (sourceSelection.has("new-jersey-njeda-projects")) {
    await ingestSource("new-jersey-njeda-projects", () => ingestNewJerseyNjedaProjects());
  }

  if (sourceSelection.has("pennsylvania-dced-projects")) {
    await ingestSource("pennsylvania-dced-projects", () => ingestPennsylvaniaDcedProjects());
  }

  if (sourceSelection.has("maryland-commerce-projects")) {
    await ingestSource("maryland-commerce-projects", () => ingestMarylandCommerceProjects());
  }

  if (sourceSelection.has("new-mexico-edd-projects")) {
    await ingestSource("new-mexico-edd-projects", () => ingestNewMexicoEddProjects());
  }

  if (sourceSelection.has("nevada-governor-projects")) {
    await ingestSource("nevada-governor-projects", () => ingestNevadaGovernorProjects());
  }

  if (sourceSelection.has("utah-goeo-projects")) {
    await ingestSource("utah-goeo-projects", () => ingestUtahGoeoProjects());
  }

  if (sourceSelection.has("idaho-commerce-projects")) {
    await ingestSource("idaho-commerce-projects", () => ingestIdahoCommerceProjects());
  }

  if (sourceSelection.has("nebraska-ded-projects")) {
    await ingestSource("nebraska-ded-projects", () => ingestNebraskaDedProjects());
  }

  if (sourceSelection.has("california-gobiz-projects")) {
    await ingestSource("california-gobiz-projects", () => ingestCaliforniaGobizProjects());
  }

  if (sourceSelection.has("florida-governor-projects")) {
    await ingestSource("florida-governor-projects", () => ingestFloridaGovernorProjects());
  }

  if (sourceSelection.has("colorado-governor-projects")) {
    await ingestSource("colorado-governor-projects", () => ingestColoradoGovernorProjects());
  }

  if (sourceSelection.has("washington-commerce-projects")) {
    await ingestSource("washington-commerce-projects", () => ingestWashingtonCommerceProjects());
  }

  if (sourceSelection.has("oregon-business-projects")) {
    await ingestSource("oregon-business-projects", () => ingestOregonBusinessProjects());
  }

  if (sourceSelection.has("chips-awards")) {
    await ingestSource("chips-awards", () => ingestChipsAwards());
  }

  if (sourceSelection.has("doe-edf-projects")) {
    await ingestSource("doe-edf-projects", () => ingestDoeEdfProjects());
  }

  const merged = mergeBundles(...bundles);
  await persistBundle(merged, {
    cleanupPaths: Array.from(cleanupPaths),
    replaceSourceSystems: Array.from(replaceSourceSystems),
  });

  const summary = Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])
  );

  return {
    sources: Array.from(sourceSelection),
    summary,
    failures,
  };
}

async function main() {
  const result = await runIndustrialTrackerIngestion();
  console.log("Industrial Tracker ingestion complete.");
  console.log(JSON.stringify(result.summary, null, 2));

  if (result.failures.length) {
    console.warn("Some sources failed during ingestion.");
    console.warn(JSON.stringify(result.failures, null, 2));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
