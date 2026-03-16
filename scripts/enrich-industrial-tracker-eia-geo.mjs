import path from "node:path";

import {
  downloadToTemp,
  runCommandJson,
  supabaseFetch,
} from "./lib/industrial-tracker-ingestion/common.mjs";

const DEFAULT_EIA_860_URL = "https://www.eia.gov/electricity/data/eia860/xls/eia8602024.zip";

function normalizeCountyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(county|parish|borough|census area|municipio|municipality|city and borough|city)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function patchRows(table, rows, key = "id") {
  for (const row of rows) {
    const { [key]: keyValue, ...changes } = row;
    if (!keyValue || !Object.keys(changes).length) continue;

    const headers = {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL}/rest/v1/${table}?${key}=eq.${encodeURIComponent(keyValue)}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(changes),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Patch failed for ${table}:${keyValue}: ${res.status} ${text}`);
    }
  }
}

async function main() {
  const zipUrl = process.env.EIA_860_URL || DEFAULT_EIA_860_URL;
  const zipPath = await downloadToTemp(zipUrl, "eia860.zip");
  const parserPath = path.resolve(
    "scripts/lib/industrial-tracker-ingestion/parse_eia860_plant.py"
  );
  const plantRows = await runCommandJson("python3", [parserPath, zipPath]);

  const [facilityRows, geoRows] = await Promise.all([
    supabaseFetch(
      "facility_master?metadata->>source=eq.EIA&select=id,geo_id,county_fips,cbsa_code,address,latitude,longitude,facility_source_ids"
    ),
    supabaseFetch("geo_dim?select=id,county_fips,cbsa_code,state_code,county_name"),
  ]);

  const eiaByPlantCode = new Map(
    plantRows.map((row) => [String(row.plantCode), row])
  );
  const geoByStateAndCounty = new Map(
    (geoRows || [])
      .filter((row) => row.state_code && row.county_name)
      .map((row) => [
        `${row.state_code}:${normalizeCountyName(row.county_name)}`,
        row,
      ])
  );

  const facilityUpdates = [];
  for (const row of facilityRows || []) {
    const plantCode = row.facility_source_ids?.eiaPlantCode;
    if (!plantCode) continue;
    const plant = eiaByPlantCode.get(String(plantCode));
    if (!plant?.state || !plant?.countyName) continue;
    const geo = geoByStateAndCounty.get(
      `${plant.state}:${normalizeCountyName(plant.countyName)}`
    );
    if (!geo) continue;

    const next = {
      id: row.id,
      geo_id: row.geo_id || geo.id,
      county_fips: row.county_fips || geo.county_fips,
      cbsa_code: row.cbsa_code || geo.cbsa_code || null,
      latitude: row.latitude || (plant.latitude != null ? String(plant.latitude) : null),
      longitude: row.longitude || (plant.longitude != null ? String(plant.longitude) : null),
      address: {
        ...(row.address || {}),
        street1: row.address?.street1 || plant.streetAddress || undefined,
        city: row.address?.city || plant.city || undefined,
        state: row.address?.state || plant.state || undefined,
        postalCode: row.address?.postalCode || plant.zip || undefined,
        countyFips: row.address?.countyFips || geo.county_fips || undefined,
      },
    };

    if (
      next.geo_id !== row.geo_id ||
      next.county_fips !== row.county_fips ||
      next.cbsa_code !== row.cbsa_code ||
      next.latitude !== row.latitude ||
      next.longitude !== row.longitude ||
      JSON.stringify(next.address) !== JSON.stringify(row.address || {})
    ) {
      facilityUpdates.push(next);
    }
  }

  await patchRows("facility_master", facilityUpdates);

  console.log(JSON.stringify({ updated: facilityUpdates.length, zipUrl }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
