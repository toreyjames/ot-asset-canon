import { ingestProjectFeed } from "./project-feed.mjs";

function sourceListFromValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function ingestPrivateCapitalFeed(config = {}) {
  let sources = sourceListFromValue(
    config.source || process.env.INDUSTRIAL_TRACKER_PRIVATE_CAPITAL
  );

  // Fallback: reuse project-feed list but only keep entries tagged as private-capital files.
  if (!sources.length) {
    sources = sourceListFromValue(process.env.INDUSTRIAL_TRACKER_PROJECT_FEED).filter((entry) =>
      /private|capex/i.test(entry)
    );
  }

  if (!sources.length) {
    throw new Error(
      "INDUSTRIAL_TRACKER_PRIVATE_CAPITAL is not configured and no private-capital entries were found in INDUSTRIAL_TRACKER_PROJECT_FEED."
    );
  }

  return ingestProjectFeed({ source: sources });
}
