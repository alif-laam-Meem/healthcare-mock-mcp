// Plain REST wrapper around getDemoClaimsBenefitsProfile: a member's full
// claims history plus their accumulators and the full benefits catalog. See
// app/api/members/[memberId]/route.ts for the pattern this follows.
//
// Optional query params: claimId narrows claims[] to one matching entry
// (404 claim_not_found if it doesn't belong to this member); serviceType
// (+ optional networkLevel, defaults to in_network) narrows benefitsCatalog[]
// to one matching entry (400 conflicting_demo_data if no such entry exists).
// Mirrors how the MCP tools (get_demo_claim_details, get_demo_benefits) take
// these as arguments to look up one specific record server-side.

import { NextRequest, NextResponse } from "next/server";
import { getDemoClaimsBenefitsProfile, restErrorStatus } from "@/lib/healthcare-tools";

export async function GET(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const query = Object.fromEntries(req.nextUrl.searchParams);
  const result = getDemoClaimsBenefitsProfile({ memberId, ...query });
  if (!result.success) {
    return NextResponse.json(result, { status: restErrorStatus(result.error.code) });
  }
  return NextResponse.json(result, { status: 200 });
}
