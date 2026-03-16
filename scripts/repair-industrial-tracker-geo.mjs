const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to repair Industrial Tracker geography."
  );
  process.exit(1);
}

async function supabaseFetch(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function withPagination(path, limit, offset) {
  const [pathname, queryString = ""] = path.split("?");
  const params = new URLSearchParams(queryString);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

async function supabaseFetchAll(path, pageSize = 1000) {
  const rows = [];
  let offset = 0;

  while (true) {
    const batch = (await supabaseFetch(withPagination(path, pageSize, offset))) || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function patchRows(table, rows, key = "id") {
  if (!rows.length) return;

  for (const row of rows) {
    const { [key]: keyValue, ...changes } = row;
    if (!keyValue || !Object.keys(changes).length) continue;

    await supabaseFetch(`${table}?${key}=eq.${encodeURIComponent(keyValue)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify(changes),
    });
  }
}

function chooseGeoByCounty(geoByCounty, countyFips) {
  if (!countyFips) return null;
  return geoByCounty.get(countyFips) || null;
}

function normalizeCountyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(county|parish|borough|census area|municipio|municipality|city and borough|city)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeCount(label, rows) {
  return { label, updated: rows.length };
}

async function main() {
  const [geoRows, facilityRows, investmentRows, permitRows, projectRows, evidenceRows, signalRows, frsSourceRows] =
    await Promise.all([
      supabaseFetchAll("geo_dim?select=id,county_fips,county_name,cbsa_code,state_code"),
      supabaseFetchAll("facility_master?select=id,geo_id,county_fips,cbsa_code,address,facility_source_ids,metadata"),
      supabaseFetchAll(
        "investment_events?select=id,geo_id,county_fips,cbsa_code,place_of_performance,recipient_location,facility_id"
      ),
      supabaseFetchAll(
        "permit_or_milestone_events?select=id,geo_id,county_fips,cbsa_code,facility_id"
      ),
      supabaseFetchAll("industrial_projects?select=id,geo_id,facility_id"),
      supabaseFetchAll("evidence_records?select=id,geo_id,facility_id"),
      supabaseFetchAll("derived_signals?select=id,geo_id,facility_id"),
      supabaseFetchAll("source_records?source_system=eq.EPA%20FRS&select=raw_payload"),
    ]);

  const geoByCounty = new Map(
    (geoRows || [])
      .filter((row) => row.county_fips)
      .map((row) => [row.county_fips, row])
  );
  const geoByStateAndCounty = new Map(
    (geoRows || [])
      .filter((row) => row.state_code && row.county_name)
      .map((row) => [
        `${row.state_code}:${normalizeCountyName(row.county_name)}`,
        row,
      ])
  );
  const frsCountyById = new Map(
    (frsSourceRows || [])
      .map((row) => row.raw_payload || {})
      .filter((row) => row.registry_id && row.fac_state && row.fac_county)
      .map((row) => [
        String(row.registry_id),
        {
          stateCode: String(row.fac_state).slice(0, 2).toUpperCase(),
          countyName: String(row.fac_county),
        },
      ])
  );

  const facilityUpdates = [];
  for (const row of facilityRows || []) {
    const frsId = row.facility_source_ids?.frsId || null;
    const frsCounty = frsId ? frsCountyById.get(String(frsId)) : null;
    const countyFips = row.county_fips || row.address?.countyFips || null;
    const geo =
      chooseGeoByCounty(geoByCounty, countyFips) ||
      (frsCounty
        ? geoByStateAndCounty.get(
            `${frsCounty.stateCode}:${normalizeCountyName(frsCounty.countyName)}`
          ) || null
        : null);
    if (!geo) continue;

    const next = {
      id: row.id,
      geo_id: row.geo_id || geo.id,
      county_fips: row.county_fips || countyFips || geo.county_fips,
      cbsa_code: row.cbsa_code || geo.cbsa_code || null,
    };

    if (
      next.geo_id !== row.geo_id ||
      next.county_fips !== row.county_fips ||
      next.cbsa_code !== row.cbsa_code
    ) {
      facilityUpdates.push(next);
    }
  }
  await patchRows("facility_master", facilityUpdates);

  const updatedFacilityRows =
    facilityUpdates.length > 0
      ? await supabaseFetch(
          "facility_master?select=id,geo_id,county_fips,cbsa_code,address,facility_source_ids,metadata&limit=10000"
        )
      : facilityRows;
  const facilityById = new Map((updatedFacilityRows || []).map((row) => [row.id, row]));

  const investmentUpdates = [];
  for (const row of investmentRows || []) {
    const facility = row.facility_id ? facilityById.get(row.facility_id) : null;
    const countyFips =
      row.county_fips ||
      row.place_of_performance?.countyFips ||
      row.recipient_location?.countyFips ||
      facility?.county_fips ||
      facility?.address?.countyFips ||
      null;
    const geo = chooseGeoByCounty(geoByCounty, countyFips) || (facility?.geo_id ? { id: facility.geo_id, cbsa_code: facility.cbsa_code } : null);
    if (!geo && !facility) continue;

    const next = {
      id: row.id,
      geo_id: row.geo_id || geo?.id || facility?.geo_id || null,
      county_fips: row.county_fips || countyFips,
      cbsa_code: row.cbsa_code || geo?.cbsa_code || facility?.cbsa_code || null,
    };

    if (
      next.geo_id !== row.geo_id ||
      next.county_fips !== row.county_fips ||
      next.cbsa_code !== row.cbsa_code
    ) {
      investmentUpdates.push(next);
    }
  }
  await patchRows("investment_events", investmentUpdates);

  const permitUpdates = [];
  for (const row of permitRows || []) {
    const facility = row.facility_id ? facilityById.get(row.facility_id) : null;
    const countyFips = row.county_fips || facility?.county_fips || facility?.address?.countyFips || null;
    const geo = chooseGeoByCounty(geoByCounty, countyFips) || (facility?.geo_id ? { id: facility.geo_id, cbsa_code: facility.cbsa_code } : null);
    if (!geo && !facility) continue;

    const next = {
      id: row.id,
      geo_id: row.geo_id || geo?.id || facility?.geo_id || null,
      county_fips: row.county_fips || countyFips,
      cbsa_code: row.cbsa_code || geo?.cbsa_code || facility?.cbsa_code || null,
    };

    if (
      next.geo_id !== row.geo_id ||
      next.county_fips !== row.county_fips ||
      next.cbsa_code !== row.cbsa_code
    ) {
      permitUpdates.push(next);
    }
  }
  await patchRows("permit_or_milestone_events", permitUpdates);

  const projectUpdates = [];
  for (const row of projectRows || []) {
    const facility = row.facility_id ? facilityById.get(row.facility_id) : null;
    if (!facility?.geo_id || row.geo_id) continue;
    projectUpdates.push({
      id: row.id,
      geo_id: facility.geo_id,
    });
  }
  await patchRows("industrial_projects", projectUpdates);

  const evidenceUpdates = [];
  for (const row of evidenceRows || []) {
    const facility = row.facility_id ? facilityById.get(row.facility_id) : null;
    if (!facility?.geo_id || row.geo_id) continue;
    evidenceUpdates.push({
      id: row.id,
      geo_id: facility.geo_id,
    });
  }
  await patchRows("evidence_records", evidenceUpdates);

  const signalUpdates = [];
  for (const row of signalRows || []) {
    const facility = row.facility_id ? facilityById.get(row.facility_id) : null;
    if (!facility?.geo_id || row.geo_id) continue;
    signalUpdates.push({
      id: row.id,
      geo_id: facility.geo_id,
    });
  }
  await patchRows("derived_signals", signalUpdates);

  const summary = [
    summarizeCount("facility_master", facilityUpdates),
    summarizeCount("investment_events", investmentUpdates),
    summarizeCount("permit_or_milestone_events", permitUpdates),
    summarizeCount("industrial_projects", projectUpdates),
    summarizeCount("evidence_records", evidenceUpdates),
    summarizeCount("derived_signals", signalUpdates),
  ];

  console.log("Industrial Tracker geography repair complete.");
  console.log(
    JSON.stringify(
      {
        geoRows: (geoRows || []).length,
        facilities: (facilityRows || []).length,
        investments: (investmentRows || []).length,
        permits: (permitRows || []).length,
      },
      null,
      2
    )
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
