# Next Morning DB Fix Checklist

## Goal
Get production DB-backed routes healthy (`/api/assessment/data-boundary`, `/api/ingest`).

## 1) Set production DB URL in Vercel
- Vercel project: `ot-asset-canon`
- Env var name: `DATABASE_URL`
- Value format:
  - `postgresql://postgres:<PASSWORD>@db.wiqobjhgdkgcxsdsgaos.supabase.co:5432/postgres?sslmode=require`

## 2) Redeploy production
- Trigger a production deploy from Vercel or run:
  - `vercel --prod`

## 3) Verify health endpoint
- URL: `https://aibaseload.com/api/ops/health`
- Expected:
  - `ok: true`
  - `checks.envConfigured: true`
  - `checks.dbConnected: true`

## 4) Verify data-boundary write
- `POST https://aibaseload.com/api/assessment/data-boundary`
- JSON:
  - `{"orgSlug":"tmna","mode":"customer_agent"}`
- Expected: `200` and `ok: true`

## 5) Verify ingest DB path
- `POST https://aibaseload.com/api/ingest`
- JSON minimal payload:
  - `{"source":"manual","orgSlug":"tmna","data":[{"tagNumber":"SMOKE-TAG-DB-1","name":"Smoke PLC","assetType":"plc","layer":3}]}`
- Expected: non-`DB_URL_MISSING` result

## Notes
- `supabase db push` already applied migration `0002_crazy_lady_vermin.sql`.
- If any API returns `code: DB_URL_MISSING`, production env is still missing DB connection string.
