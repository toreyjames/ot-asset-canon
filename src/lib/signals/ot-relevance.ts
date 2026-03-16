const OT_KEYWORD_SCORES: Record<string, number> = {
  "scada": 20,
  "ics": 20,
  "ot cyber": 20,
  "ot security": 20,
  "operational technology": 18,
  "industrial control": 18,
  "cybersecurity": 15,
  "cyber security": 15,
  "dcs": 15,
  "plc": 15,
  "hmi": 15,
  "rtu": 12,
  "nerc cip": 15,
  "critical infrastructure": 14,
  "manufacturing": 10,
  "production line": 10,
  "facility construction": 10,
  "plant modernization": 12,
  "nuclear": 12,
  "semiconductor": 10,
  "data center": 8,
  "energy": 6,
  "pipeline": 8,
  "substation": 10,
  "grid": 8,
  "automation": 8,
  "process control": 12,
  "safety instrumented": 14,
  "sis": 14,
  "historian": 10,
  "dnp3": 12,
  "modbus": 12,
  "opc ua": 12,
  "opc": 10,
  "nist 800-82": 18,
  "iec 62443": 18,
  "iiot": 10,
  "industrial internet": 10,
  "smart factory": 8,
  "digital twin": 8,
  "defense industrial base": 14,
  "cmmc": 12,
  "dfars": 10,
  "nist 800-171": 12,
  "zero trust": 8,
  "network segmentation": 10,
  "purdue model": 15,
  "air gap": 10,
  "chemical plant": 10,
  "refinery": 10,
  "water treatment": 10,
  "wastewater": 8,
  "electric utility": 10,
  "oil and gas": 8,
  "oil & gas": 8,
  "pharmaceutical": 8,
  "bms": 8,
  "building management": 6,
  "fire suppression": 6,
  "access control": 6,
  "physical security": 6,
};

export function computeOtRelevanceScore(text: string): {
  score: number;
  keywords: string[];
} {
  const lower = text.toLowerCase();
  let total = 0;
  const matched: string[] = [];

  for (const [keyword, weight] of Object.entries(OT_KEYWORD_SCORES)) {
    if (lower.includes(keyword)) {
      total += weight;
      matched.push(keyword);
    }
  }

  const score = Math.min(100, total);
  return { score, keywords: matched };
}

export function extractTextForScoring(
  rawPayload: Record<string, unknown>,
  description?: string | null,
  additionalFields?: (string | null | undefined)[]
): string {
  const parts: string[] = [];

  if (description) parts.push(description);
  if (additionalFields) {
    for (const f of additionalFields) {
      if (f) parts.push(f);
    }
  }

  const walk = (obj: unknown, depth = 0): void => {
    if (depth > 3) return;
    if (typeof obj === "string") {
      parts.push(obj);
    } else if (Array.isArray(obj)) {
      for (const item of obj) walk(item, depth + 1);
    } else if (obj && typeof obj === "object") {
      for (const val of Object.values(obj)) walk(val, depth + 1);
    }
  };
  walk(rawPayload);

  return parts.join(" ");
}
