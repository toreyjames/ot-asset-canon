import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readListEnv } from "./lib/industrial-tracker-ingestion/common.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const dataDir = path.join(projectRoot, "data");
const progressPath = path.join(dataDir, "state-ingestion-progress.json");
const logPath = path.join(dataDir, "state-ingestion.log");

const STATE_SOURCES = [
  { key: "alabama-commerce-projects", label: "Alabama" },
  { key: "arizona-commerce-projects", label: "Arizona" },
  { key: "arkansas-aedc-projects", label: "Arkansas" },
  { key: "california-gobiz-projects", label: "California" },
  { key: "colorado-governor-projects", label: "Colorado" },
  { key: "florida-governor-projects", label: "Florida" },
  { key: "georgia-governor-projects", label: "Georgia" },
  { key: "idaho-commerce-projects", label: "Idaho" },
  { key: "illinois-edc-projects", label: "Illinois" },
  { key: "indiana-iedc-projects", label: "Indiana" },
  { key: "iowa-ieda-projects", label: "Iowa" },
  { key: "kansas-commerce-projects", label: "Kansas" },
  { key: "kentucky-ced-projects", label: "Kentucky" },
  { key: "louisiana-led-projects", label: "Louisiana" },
  { key: "maryland-commerce-projects", label: "Maryland" },
  { key: "michigan-medc-projects", label: "Michigan" },
  { key: "mississippi-mda-projects", label: "Mississippi" },
  { key: "missouri-ded-projects", label: "Missouri" },
  { key: "nebraska-ded-projects", label: "Nebraska" },
  { key: "nevada-governor-projects", label: "Nevada" },
  { key: "new-jersey-njeda-projects", label: "New Jersey" },
  { key: "new-mexico-edd-projects", label: "New Mexico" },
  { key: "north-carolina-commerce-projects", label: "North Carolina" },
  { key: "ohio-jobs-projects", label: "Ohio" },
  { key: "oklahoma-commerce-projects", label: "Oklahoma" },
  { key: "oregon-business-projects", label: "Oregon" },
  { key: "pennsylvania-dced-projects", label: "Pennsylvania" },
  { key: "south-carolina-commerce-projects", label: "South Carolina" },
  { key: "tennessee-ecd-projects", label: "Tennessee" },
  { key: "texas-governor-projects", label: "Texas" },
  { key: "utah-goeo-projects", label: "Utah" },
  { key: "virginia-vedp-projects", label: "Virginia" },
  { key: "washington-commerce-projects", label: "Washington" },
  { key: "west-virginia-economic-development-projects", label: "West Virginia" },
];

const forcedStateKeys = new Set(readListEnv("STATE_INGEST_FORCE_STATES"));
const onlyStateKeys = new Set(readListEnv("STATE_INGEST_ONLY_STATES"));
const skipStateKeys = new Set(readListEnv("STATE_INGEST_SKIP_STATES"));
const forceAll = process.env.STATE_INGEST_FORCE_ALL === "1";
const continueOnError = process.env.STATE_INGEST_CONTINUE_ON_ERROR !== "0";

async function loadProgress() {
  try {
    const raw = await fs.readFile(progressPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveProgress(progress) {
  await fs.mkdir(path.dirname(progressPath), { recursive: true });
  await fs.writeFile(progressPath, JSON.stringify(progress, null, 2));
}

async function appendLog(entry) {
  const line = `[${new Date().toISOString()}] ${entry}`;
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, `${line}\n`);
}

function spawnIngestion(sourceKey) {
  const env = { ...process.env, INDUSTRIAL_TRACKER_SOURCES: sourceKey };
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "ingest:industrial-tracker"], {
      cwd: projectRoot,
      env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ingestion for ${sourceKey} exited with code ${code} ${signal ?? ""}`.trim()));
      }
    });
  });
}

function shouldRunState(source, existingProgress) {
  if (onlyStateKeys.size && !onlyStateKeys.has(source.key)) {
    return false;
  }

  if (skipStateKeys.has(source.key)) {
    return false;
  }

  if (forceAll || forcedStateKeys.has(source.key)) {
    return true;
  }

  const entry = existingProgress[source.key];
  return entry?.status !== "success";
}

async function processSource(source, progress) {
  const start = Date.now();
  const previous = progress[source.key] || {};
  await appendLog(`starting ${source.label} (${source.key}) [attempt ${previous.attempts ? previous.attempts + 1 : 1}]`);
  try {
    await spawnIngestion(source.key);
    const duration = Date.now() - start;
    progress[source.key] = {
      label: source.label,
      status: "success",
      attempts: (previous.attempts || 0) + 1,
      lastRunAt: new Date().toISOString(),
      durationMs: duration,
    };
    await appendLog(`finished ${source.label} (${source.key}) in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - start;
    progress[source.key] = {
      label: source.label,
      status: "failed",
      attempts: (previous.attempts || 0) + 1,
      lastRunAt: new Date().toISOString(),
      durationMs: duration,
      lastError: error.message,
    };
    await appendLog(`failed ${source.label} (${source.key}) after ${duration}ms: ${error.message}`);
    if (!continueOnError) {
      throw error;
    }
  } finally {
    await saveProgress(progress);
  }
}

function formatSummary(progress) {
  return STATE_SOURCES.map((source) => {
    const entry = progress[source.key];
    const status = entry?.status ?? "pending";
    const suffix = entry?.durationMs ? ` (${entry.durationMs}ms)` : "";
    return `${source.label}: ${status}${suffix}`;
  }).join("\n");
}

async function main() {
  const progress = await loadProgress();

  for (const source of STATE_SOURCES) {
    if (!shouldRunState(source, progress)) {
      console.log(`skipping ${source.label} (${source.key})`);
      continue;
    }
    await processSource(source, progress);
  }

  console.log("state ingestion automation finished");
  console.log(formatSummary(progress));
  await appendLog("state ingestion automation finished");
}

main().catch(async (error) => {
  await appendLog(`automation aborted: ${error.message}`);
  console.error(error);
  process.exit(1);
});
