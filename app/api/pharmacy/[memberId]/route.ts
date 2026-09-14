// Plain REST wrapper around getDemoPharmacyProfile: the full formulary,
// pharmacy directory, and canned prescription-rejection scenarios. See
// app/api/members/[memberId]/route.ts for the pattern this follows.

import { NextRequest, NextResponse } from "next/server";
import { getDemoPharmacyProfile } from "@/lib/healthcare-tools";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const result = getDemoPharmacyProfile({ memberId });
  if (!result.success) {
    const status = result.error.code === "member_not_found" ? 404 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { status: 200 });
}
