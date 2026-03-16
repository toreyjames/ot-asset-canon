import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import readline from "node:readline";
import yauzl from "yauzl";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const DEFAULT_FRS_ZIP_URL =
  "https://echo.epa.gov/files/echodownloads/frs_downloads.zip";
export const DEFAULT_ECHO_ZIP_URL =
  "https://echo.epa.gov/files/echodownloads/echo_exporter.zip";

export const STATE_FIPS = {
  AL: "01",
  AK: "02",
  AZ: "04",
  AR: "05",
  CA: "06",
  CO: "08",
  CT: "09",
  DE: "10",
  DC: "11",
  FL: "12",
  GA: "13",
  HI: "15",
  ID: "16",
  IL: "17",
  IN: "18",
  IA: "19",
  KS: "20",
  KY: "21",
  LA: "22",
  ME: "23",
  MD: "24",
  MA: "25",
  MI: "26",
  MN: "27",
  MS: "28",
  MO: "29",
  MT: "30",
  NE: "31",
  NV: "32",
  NH: "33",
  NJ: "34",
  NM: "35",
  NY: "36",
  NC: "37",
  ND: "38",
  OH: "39",
  OK: "40",
  OR: "41",
  PA: "42",
  RI: "44",
  SC: "45",
  SD: "46",
  TN: "47",
  TX: "48",
  UT: "49",
  VT: "50",
  VA: "51",
  WA: "53",
  WV: "54",
  WI: "55",
  WY: "56",
};

export function requireSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
    );
  }
}

export function readListEnv(name, fallback = []) {
  const value = process.env[name];
  if (!value) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readIntEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeName(value) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|llc|ltd|corp|co|company|pllc|lp)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalSourceName(value) {
  const normalized = String(value || "").trim().toLowerCase();

  switch (normalized) {
    case "usaspending":
    case "usaspending.gov":
      return "USAspending";
    case "epa frs":
    case "epa facility registry service":
      return "EPA FRS";
    case "epa echo":
    case "epa-echo":
      return "EPA ECHO";
    case "sec edgar":
    case "sec-edgar":
      return "SEC EDGAR";
    case "eia":
      return "EIA";
    case "eia grid monitor":
      return "EIA Grid Monitor";
    case "queued up interconnection queue":
      return "Queued Up Interconnection Queue";
    case "empire state development incentives":
    case "new york esd incentives":
      return "Empire State Development Incentives";
    case "texas strategic projects":
    case "texas governor strategic projects":
      return "Texas Strategic Projects";
    case "michigan strategic projects":
    case "michigan medc projects":
      return "Michigan Strategic Projects";
    case "arizona strategic projects":
    case "arizona commerce projects":
      return "Arizona Strategic Projects";
    case "arkansas strategic projects":
    case "arkansas aedc projects":
      return "Arkansas Strategic Projects";
    case "ohio strategic projects":
    case "ohio jobs projects":
      return "Ohio Strategic Projects";
    case "georgia strategic projects":
    case "georgia governor strategic projects":
      return "Georgia Strategic Projects";
    case "north carolina strategic projects":
    case "north carolina commerce projects":
      return "North Carolina Strategic Projects";
    case "tennessee strategic projects":
    case "tennessee ecd projects":
      return "Tennessee Strategic Projects";
    case "south carolina strategic projects":
    case "south carolina commerce projects":
      return "South Carolina Strategic Projects";
    case "kentucky strategic projects":
    case "kentucky ced projects":
      return "Kentucky Strategic Projects";
    case "virginia strategic projects":
    case "virginia vedp projects":
      return "Virginia Strategic Projects";
    case "indiana strategic projects":
    case "indiana iedc projects":
      return "Indiana Strategic Projects";
    case "alabama strategic projects":
    case "alabama commerce projects":
      return "Alabama Strategic Projects";
    case "louisiana strategic projects":
    case "louisiana led projects":
      return "Louisiana Strategic Projects";
    case "mississippi strategic projects":
    case "mississippi mda projects":
      return "Mississippi Strategic Projects";
    case "illinois strategic projects":
    case "illinois edc projects":
      return "Illinois Strategic Projects";
    case "missouri strategic projects":
    case "missouri ded projects":
      return "Missouri Strategic Projects";
    case "kansas strategic projects":
    case "kansas commerce projects":
      return "Kansas Strategic Projects";
    case "oklahoma strategic projects":
    case "oklahoma commerce projects":
      return "Oklahoma Strategic Projects";
    case "west virginia strategic projects":
    case "west virginia economic development projects":
      return "West Virginia Strategic Projects";
    case "iowa strategic projects":
    case "iowa ieda projects":
      return "Iowa Strategic Projects";
    case "new jersey strategic projects":
    case "new jersey njeda projects":
      return "New Jersey Strategic Projects";
    case "pennsylvania strategic projects":
    case "pennsylvania dced projects":
      return "Pennsylvania Strategic Projects";
    case "maryland strategic projects":
    case "maryland commerce projects":
      return "Maryland Strategic Projects";
    case "new mexico strategic projects":
    case "new mexico edd projects":
      return "New Mexico Strategic Projects";
    case "nevada strategic projects":
    case "nevada governor strategic projects":
      return "Nevada Strategic Projects";
    case "utah strategic projects":
    case "utah goeo projects":
      return "Utah Strategic Projects";
    case "idaho strategic projects":
    case "idaho commerce projects":
      return "Idaho Strategic Projects";
    case "nebraska strategic projects":
    case "nebraska ded projects":
      return "Nebraska Strategic Projects";
    case "california strategic projects":
    case "california gobiz projects":
      return "California Strategic Projects";
    case "florida strategic projects":
    case "florida governor projects":
      return "Florida Strategic Projects";
    case "colorado strategic projects":
    case "colorado governor projects":
      return "Colorado Strategic Projects";
    case "chips awards":
      return "CHIPS Awards";
    case "doe edf projects":
      return "DOE EDF Projects";
    case "baseload private capex feed":
    case "private capital feed":
      return "Baseload private capex feed";
    case "baseload private capital market feed":
      return "Baseload private capital market feed";
    case "baseload private infrastructure financing feed":
    case "private infrastructure financing feed":
      return "Baseload private infrastructure financing feed";
    case "baseload private manufacturing equity debt feed":
    case "private manufacturing equity debt feed":
      return "Baseload private manufacturing equity debt feed";
    case "baseload private transmission financing feed":
    case "private transmission financing feed":
      return "Baseload private transmission financing feed";
    case "baseload private water thermal financing feed":
    case "private water thermal financing feed":
      return "Baseload private water thermal financing feed";
    case "baseload private onsite power financing feed":
    case "private onsite power financing feed":
      return "Baseload private onsite power financing feed";
    case "baseload private industrial real estate financing feed":
    case "private industrial real estate financing feed":
      return "Baseload private industrial real estate financing feed";
    case "baseload private fuel logistics financing feed":
    case "private fuel logistics financing feed":
      return "Baseload private fuel logistics financing feed";
    case "baseload private rail logistics financing feed":
    case "private rail logistics financing feed":
      return "Baseload private rail logistics financing feed";
    case "baseload private circular industry financing feed":
    case "private circular industry financing feed":
      return "Baseload private circular industry financing feed";
    case "baseload private grid resilience financing feed":
    case "private grid resilience financing feed":
      return "Baseload private grid resilience financing feed";
    case "baseload private industrial communications financing feed":
    case "private industrial communications financing feed":
      return "Baseload private industrial communications financing feed";
    case "baseload private industrial steam financing feed":
    case "private industrial steam financing feed":
      return "Baseload private industrial steam financing feed";
    case "baseload private heavy equipment financing feed":
    case "private heavy equipment financing feed":
      return "Baseload private heavy equipment financing feed";
    case "baseload private waste heat recovery financing feed":
    case "private waste heat recovery financing feed":
      return "Baseload private waste heat recovery financing feed";
    case "baseload private industrial water rights financing feed":
    case "private industrial water rights financing feed":
      return "Baseload private industrial water rights financing feed";
    case "baseload private industrial cyber financing feed":
    case "private industrial cyber financing feed":
      return "Baseload private industrial cyber financing feed";
    case "baseload private industrial air separation financing feed":
    case "private industrial air separation financing feed":
      return "Baseload private industrial air separation financing feed";
    case "baseload private cooling infrastructure financing feed":
    case "private cooling infrastructure financing feed":
      return "Baseload private cooling infrastructure financing feed";
    case "baseload private materials handling financing feed":
    case "private materials handling financing feed":
      return "Baseload private materials handling financing feed";
    case "baseload private compressed air financing feed":
    case "private compressed air financing feed":
      return "Baseload private compressed air financing feed";
    case "baseload private industrial byproduct logistics financing feed":
    case "private industrial byproduct logistics financing feed":
      return "Baseload private industrial byproduct logistics financing feed";
    default:
      return String(value || "").trim() || "Unknown Source";
  }
}

export function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(/[$,%\s,]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isoDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

export function formatCountyFips(stateCode, countyCode) {
  const stateFips = STATE_FIPS[stateCode] || stateCode || "";
  const county = String(countyCode || "").padStart(3, "0");
  if (!stateFips || county.length !== 3 || county === "000") return null;
  return `${stateFips}${county}`;
}

export function deterministicUuid(input) {
  const hash = crypto.createHash("md5").update(String(input)).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${((Number.parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80)
      .toString(16)
      .padStart(2, "0")}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function emptyBundle() {
  return {
    geoRows: [],
    entityRows: [],
    facilityRows: [],
    sourceRows: [],
    investmentRows: [],
    permitRows: [],
    projectRows: [],
    evidenceRows: [],
    signalRows: [],
    facilityEventRows: [],
    programLinkRows: [],
    resolutionRows: [],
  };
}

export function mergeRowsById(...rowGroups) {
  const map = new Map();

  for (const rows of rowGroups) {
    for (const row of rows || []) {
      if (!row?.id) continue;
      map.set(row.id, { ...(map.get(row.id) || {}), ...row });
    }
  }

  return Array.from(map.values());
}

export async function supabaseFetch(pathname, init = {}) {
  requireSupabase();

  const headers = new Headers(init.headers || {});
  headers.set("apikey", SUPABASE_SERVICE_ROLE_KEY);
  headers.set("Authorization", `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export function normalizeForPostgrest(rows) {
  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  return rows.map((row) =>
    Object.fromEntries(keys.map((key) => [key, key in row ? row[key] : null]))
  );
}

export async function upsertRows(table, rows, onConflict = "id") {
  if (!rows.length) return;

  await supabaseFetch(`${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(normalizeForPostgrest(rows)),
  });
}

export async function deleteRows(pathname) {
  await supabaseFetch(pathname, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });
}

export async function persistBundle(bundle, options = {}) {
  const cleanupPaths = options.cleanupPaths || [];
  const replaceSourceSystems = options.replaceSourceSystems || [];

  for (const cleanupPath of cleanupPaths) {
    await deleteRows(cleanupPath);
  }

  for (const sourceSystem of replaceSourceSystems) {
    await deleteRows(
      `source_records?source_system=eq.${encodeURIComponent(sourceSystem)}`
    );
  }

  const mergedGeoRows = mergeRowsById(bundle.geoRows);
  const countyRows = mergedGeoRows.filter((row) => row.county_fips);
  const existingGeoRows =
    countyRows.length > 0
      ? await supabaseFetch(
          `geo_dim?select=id,county_fips&county_fips=in.(${countyRows
            .map((row) => row.county_fips)
            .join(",")})`
        )
      : [];
  const existingGeoIdByCounty = new Map(
    (existingGeoRows || []).map((row) => [row.county_fips, row.id])
  );
  const geoIdRemap = new Map();
  const normalizedCountyRows = countyRows.map((row) => ({
    ...(geoIdRemap.set(row.id, existingGeoIdByCounty.get(row.county_fips) || row.id), row),
    id: existingGeoIdByCounty.get(row.county_fips) || row.id,
  }));
  const remapGeoId = (rows) =>
    rows.map((row) =>
      row.geo_id && geoIdRemap.has(row.geo_id)
        ? { ...row, geo_id: geoIdRemap.get(row.geo_id) }
        : row
    );

  await upsertRows(
    "geo_dim",
    normalizedCountyRows,
    "county_fips"
  );
  await upsertRows(
    "geo_dim",
    mergedGeoRows.filter((row) => !row.county_fips),
    "id"
  );
  await upsertRows("entity_master", mergeRowsById(bundle.entityRows));
  await upsertRows("facility_master", mergeRowsById(remapGeoId(bundle.facilityRows)));
  await upsertRows("source_records", mergeRowsById(bundle.sourceRows));
  await upsertRows("industrial_projects", mergeRowsById(remapGeoId(bundle.projectRows)));
  await upsertRows("evidence_records", mergeRowsById(remapGeoId(bundle.evidenceRows)));
  await upsertRows("derived_signals", mergeRowsById(remapGeoId(bundle.signalRows)));
  await upsertRows("facility_events", mergeRowsById(bundle.facilityEventRows));
  await upsertRows("investment_events", mergeRowsById(remapGeoId(bundle.investmentRows)));
  await upsertRows("permit_or_milestone_events", mergeRowsById(remapGeoId(bundle.permitRows)));
  await upsertRows("program_links", mergeRowsById(bundle.programLinkRows));
  await upsertRows("entity_resolution_decisions", mergeRowsById(bundle.resolutionRows));
}

export async function downloadToTemp(url, basename) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${url}`);
  }

  const target = path.join(os.tmpdir(), `${Date.now()}-${basename}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(target, buffer);
  return target;
}

export async function readJsonSource(source) {
  if (!source) {
    throw new Error("JSON source is required.");
  }

  if (/^https?:\/\//i.test(source)) {
    try {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`JSON download failed: ${response.status} ${source}`);
      }

      return response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`JSON fetch failed for ${source}: ${message}`);
    }
  }

  const text = await fs.readFile(path.resolve(source), "utf8");
  return JSON.parse(text);
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(" ")} failed: ${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });
}

export async function runCommandJson(command, args) {
  const stdout = await runCommand(command, args);
  return JSON.parse(stdout);
}

async function readZipBuffer(zipSource) {
  if (/^https?:\/\//i.test(zipSource)) {
    const response = await fetch(zipSource);
    if (!response.ok) {
      throw new Error(`ZIP download failed: ${response.status} ${zipSource}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  return fs.readFile(zipSource);
}

function openZipFromBuffer(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zipFile) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(zipFile);
    });
  });
}

export function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (character === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

export function lowerCaseKeys(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.toLowerCase().trim(), value])
  );
}

export function pickFirst(row, keys) {
  for (const key of keys) {
    const value = row[key.toLowerCase()];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return null;
}

export async function readCsvRowsFromZip({
  zipPath,
  zipUrl,
  filePatterns,
  rowLimit,
  states = [],
  stateColumns = [],
}) {
  const zipSource = zipUrl || zipPath;
  if (!zipSource) {
    throw new Error("zipUrl or zipPath is required.");
  }

  const zipBuffer = await readZipBuffer(zipSource);
  const zipFile = await openZipFromBuffer(zipBuffer);

  return await new Promise((resolve, reject) => {
    let settled = false;

    function fail(error) {
      if (settled) return;
      settled = true;
      zipFile.close();
      reject(error);
    }

    function finish(rows) {
      if (settled) return;
      settled = true;
      zipFile.close();
      resolve(rows);
    }

    zipFile.on("error", fail);

    zipFile.readEntry();
    zipFile.on("entry", (entry) => {
      const entryPath = entry.fileName || "";
      const matches = filePatterns.some((pattern) => pattern.test(entryPath));
      if (!matches) {
        zipFile.readEntry();
        return;
      }

      zipFile.openReadStream(entry, (streamError, stream) => {
        if (streamError || !stream) {
          fail(streamError || new Error(`Failed to read ZIP entry ${entryPath}`));
          return;
        }

        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
        const rows = [];
        let headers = null;

        rl.on("line", (line) => {
          if (settled) return;
          if (!headers) {
            headers = parseCsvLine(line);
            return;
          }

          if (!line.trim()) return;

          const values = parseCsvLine(line);
          const row = lowerCaseKeys(
            Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
          );

          if (states.length && stateColumns.length) {
            const stateValue = pickFirst(row, stateColumns)?.toUpperCase();
            if (!states.includes(stateValue)) {
              return;
            }
          }

          rows.push(row);

          if (rowLimit && rows.length >= rowLimit) {
            rl.close();
            stream.destroy();
            finish(rows);
          }
        });

        rl.once("close", () => {
          if (!settled) {
            finish(rows);
          }
        });

        rl.once("error", fail);
        stream.once("error", fail);
      });
    });

    zipFile.once("end", () => {
      if (!settled) {
        fail(new Error(`No CSV entry matched ${filePatterns.map(String).join(", ")}`));
      }
    });
  });
}

export function buildGeoRow({
  countyFips,
  stateCode,
  countyName,
  cbsaCode = null,
  cbsaName = null,
  metadata = {},
}) {
  if (!countyFips && !stateCode && !cbsaCode) {
    return null;
  }

  const stateFips = countyFips?.slice(0, 2) || STATE_FIPS[stateCode] || null;
  const id = deterministicUuid(`geo:${countyFips || stateFips || cbsaCode}`);

  return {
    id,
    county_fips: countyFips,
    state_fips: stateFips,
    cbsa_code: cbsaCode,
    state_code: stateCode || null,
    county_name: countyName || null,
    cbsa_name: cbsaName || null,
    metadata,
  };
}

export function techTagsFromText(...values) {
  const haystack = values
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const tags = new Set();

  if (haystack.includes("semiconductor") || haystack.includes("chip")) tags.add("semiconductor");
  if (haystack.includes("battery")) tags.add("battery");
  if (haystack.includes("chemical") || haystack.includes("petro")) tags.add("petrochemical");
  if (haystack.includes("assembly") || haystack.includes("electronics")) tags.add("electronics");
  if (haystack.includes("steel") || haystack.includes("metal")) tags.add("metals");
  if (haystack.includes("energy") || haystack.includes("power")) tags.add("energy");

  return Array.from(tags);
}
