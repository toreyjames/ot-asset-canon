import type { Signal } from "../types";
import { computeOtRelevanceScore, extractTextForScoring } from "../ot-relevance";

interface EchoFacility {
  CWPName: string;
  RegistryID: string;
  CWPStreet: string;
  CWPCity: string;
  CWPState: string;
  CWPZip: string;
  CWPStatus: string;
  AIRIDs?: string;
  NPDESIDs?: string;
  RCRAIDs?: string;
  CWPNAICSCodes?: string;
  CWPSICCodes?: string;
  CWPPermitStatusDesc?: string;
  CWPInspectionCount?: number;
  CWPCaseIDs?: string;
  CWPFormalCount?: number;
  CWPInformalCount?: number;
  CWPViolStatus?: string;
  CWPDateLastInspection?: string;
  CWPDateLastFormalAction?: string;
  CWPComplianceStatus?: string;
  CWPSourceID?: string;
  FECCaseIDs?: string;
  CWPPenalties?: number;
}

function naicsToSector(codes: string | undefined): Signal["sector"] {
  if (!codes) return "manufacturing";
  const lower = codes.toLowerCase();
  if (lower.includes("3241") || lower.includes("3251") || lower.includes("3252") || lower.includes("3253") || lower.includes("3255") || lower.includes("3259")) return "chemical";
  if (lower.includes("3241")) return "oil-gas";
  if (lower.includes("2211")) return "energy";
  if (lower.includes("3344") || lower.includes("3345")) return "semiconductor";
  if (lower.includes("3254")) return "pharma";
  if (lower.includes("2213")) return "water";
  return "manufacturing";
}

function inferSignalType(facility: EchoFacility): Signal["signalType"] {
  if ((facility.CWPFormalCount || 0) > 0 || facility.CWPDateLastFormalAction) return "enforcement";
  if ((facility.CWPInspectionCount || 0) > 0) return "inspection";
  if (facility.CWPPermitStatusDesc?.toLowerCase().includes("permit")) return "facility-permit";
  return "facility-permit";
}

export async function fetchEpaSignals(): Promise<Signal[]> {
  const signals: Signal[] = [];

  const queries = [
    { output: "JSONP", qcolumns: "1,2,3,4,5,14,23,24,25,26,27,29,30,115", p_naics: "3251,3252,3253,3259,3241", p_act: "Y" },
    { output: "JSONP", qcolumns: "1,2,3,4,5,14,23,24,25,26,27,29,30,115", p_naics: "2211,2213,2212", p_act: "Y" },
    { output: "JSONP", qcolumns: "1,2,3,4,5,14,23,24,25,26,27,29,30,115", p_naics: "3344,3345,3361,3364", p_act: "Y" },
  ];

  for (const query of queries) {
    try {
      const params = new URLSearchParams(query);
      const res = await fetch(
        `https://echodata.epa.gov/echo/echo_rest_services.get_facilities?${params}`,
        { headers: { Accept: "application/json" } }
      );

      if (!res.ok) continue;

      const text = await res.text();
      const jsonText = text.replace(/^\/\*\*\/\w+\(/, "").replace(/\);?\s*$/, "");
      let data;
      try {
        data = JSON.parse(jsonText);
      } catch {
        continue;
      }

      const facilities = (data?.Results?.Facilities || []) as EchoFacility[];

      for (const fac of facilities.slice(0, 50)) {
        const id = `epa-${fac.RegistryID || fac.CWPSourceID}`;
        if (signals.some((s) => s.id === id)) continue;

        const description =
          `EPA-regulated facility: ${fac.CWPName}` +
          (fac.CWPComplianceStatus ? ` (${fac.CWPComplianceStatus})` : "") +
          (fac.CWPViolStatus ? ` — Violation status: ${fac.CWPViolStatus}` : "") +
          ((fac.CWPPenalties || 0) > 0 ? ` — Penalties: $${fac.CWPPenalties?.toLocaleString()}` : "");

        const fullText = extractTextForScoring(
          fac as unknown as Record<string, unknown>,
          description,
          [fac.CWPNAICSCodes, fac.CWPSICCodes]
        );
        const { score, keywords } = computeOtRelevanceScore(fullText);

        const location = fac.CWPCity && fac.CWPState
          ? `${fac.CWPCity}, ${fac.CWPState}`
          : fac.CWPState || "United States";

        signals.push({
          id,
          source: "epa",
          sourceId: fac.RegistryID || fac.CWPSourceID || "",
          timestamp: new Date(
            fac.CWPDateLastInspection || fac.CWPDateLastFormalAction || Date.now()
          ).toISOString(),
          entity: fac.CWPName,
          sector: naicsToSector(fac.CWPNAICSCodes),
          signalType: inferSignalType(fac),
          location,
          value: fac.CWPPenalties || 0,
          description: description.slice(0, 2000),
          url: `https://echo.epa.gov/detailed-facility-report?fid=${fac.RegistryID}`,
          otRelevanceScore: score,
          otKeywords: keywords,
          rawData: {
            registry_id: fac.RegistryID,
            naics: fac.CWPNAICSCodes,
            compliance_status: fac.CWPComplianceStatus,
            violation_status: fac.CWPViolStatus,
            inspection_count: fac.CWPInspectionCount,
            formal_action_count: fac.CWPFormalCount,
            penalties: fac.CWPPenalties,
          },
        });
      }

      await sleep(500);
    } catch {
      // continue
    }
  }

  return signals;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
