// Plain REST wrapper around getDemoClaimsBenefitsProfile: a member's full
// claims history plus their accumulators and the full benefits catalog. See
// app/api/members/[memberId]/route.ts for the pattern this follows.

import { NextRequest, NextResponse } from "next/server";
import { getDemoClaimsBenefitsProfile } from "@/lib/healthcare-tools";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const result = getDemoClaimsBenefitsProfile({ memberId });
  if (!result.success) {
    const status = result.error.code === "member_not_found" ? 404 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { status: 200 });
}
