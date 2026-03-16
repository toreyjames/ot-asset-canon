import path from "node:path";

import {
  STATE_FIPS,
  buildGeoRow,
  downloadToTemp,
  readIntEnv,
  runCommandJson,
  supabaseFetch,
  upsertRows,
} from "./lib/industrial-tracker-ingestion/common.mjs";

const DEFAULT_CBSA_URL =
  "https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx";
const STATE_CODE_BY_FIPS = Object.fromEntries(
  Object.entries(STATE_FIPS).map(([stateCode, stateFips]) => [stateFips, stateCode])
);

async function main() {
  const workbookUrl = process.env.CBSA_DELINEATION_URL || DEFAULT_CBSA_URL;
  const limit = readIntEnv("CBSA_IMPORT_LIMIT", 0);
  const workbookPath = await downloadToTemp(workbookUrl, "cbsa-delineation.xlsx");
  const parserPath = path.resolve(
    "scripts/lib/industrial-tracker-ingestion/parse_cbsa_delineation.py"
  );
  const parsedRows = await runCommandJson("python3", [parserPath, workbookPath]);
  const limitedRows = limit > 0 ? parsedRows.slice(0, limit) : parsedRows;

  const existingRows =
    limitedRows.length > 0
      ? await supabaseFetch(
          `geo_dim?select=id,county_fips,metadata&county_fips=in.(${limitedRows
            .map((row) => row.countyFips)
            .join(",")})`
        )
      : [];
  const existingByCounty = new Map(
    (existingRows || []).map((row) => [row.county_fips, row])
  );

  const geoRows = limitedRows
    .map((row) => {
      const existing = existingByCounty.get(row.countyFips);
      const built = buildGeoRow({
        countyFips: row.countyFips,
        stateCode: STATE_CODE_BY_FIPS[row.stateFips] || null,
        countyName: row.countyName,
        cbsaCode: row.cbsaCode,
        cbsaName: row.cbsaName,
        metadata: {
          ...(existing?.metadata || {}),
          cbsaAreaType: row.areaType,
          cbsaCountyRole: row.countyRole,
          cbsaStateName: row.stateName,
          cbsaSource: "U.S. Census Bureau delineation list 1 (2023)",
        },
      });

      if (!built) return null;

      return {
        ...built,
        id: existing?.id || built.id,
        state_fips: row.stateFips || built.state_fips,
        state_code: STATE_CODE_BY_FIPS[row.stateFips] || built.state_code || null,
      };
    })
    .filter(Boolean);

  await upsertRows("geo_dim", geoRows, "county_fips");

  console.log(
    JSON.stringify(
      {
        imported: geoRows.length,
        workbookUrl,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
