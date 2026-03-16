import { NextResponse } from "next/server";
import { getCompanyProfile } from "@/lib/canonical/service";

export async function GET(_req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const { companyId: rawCompanyId } = await params;
    const companyId = decodeURIComponent(rawCompanyId);
    const company = await getCompanyProfile(companyId);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    return NextResponse.json(company);
  } catch (error) {
    console.error("/api/company/[companyId] error", error);
    return NextResponse.json({ error: "Failed to load company profile" }, { status: 500 });
  }
}
