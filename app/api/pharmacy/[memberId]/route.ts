// Plain REST wrapper around getDemoPharmacyProfile: the full formulary,
// pharmacy directory, and canned prescription-rejection scenarios. See
// app/api/members/[memberId]/route.ts for the pattern this follows.
//
// Optional query params: drugName narrows formulary[] to one matching entry
// (404 drug_not_found if no such drug exists); pharmacyId narrows
// pharmacies[] to one matching entry (empty list, no error, if it doesn't
// match — mirrors search_demo_pharmacies); prescriptionReference narrows
// prescriptionRejections to one key (404 prescription_not_found if it isn't
// one of the canned references). Mirrors how the MCP tools
// (get_demo_formulary, get_demo_prescription_rejection) take these as
// arguments to look up one specific record server-side.

import { NextRequest, NextResponse } from "next/server";
import { getDemoPharmacyProfile, restErrorStatus } from "@/lib/healthcare-tools";

export async function GET(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const query = Object.fromEntries(req.nextUrl.searchParams);
  const result = getDemoPharmacyProfile({ memberId, ...query });
  if (!result.success) {
    return NextResponse.json(result, { status: restErrorStatus(result.error.code) });
  }
  return NextResponse.json(result, { status: 200 });
}
