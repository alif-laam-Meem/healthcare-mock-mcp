// Plain REST wrapper around the get_demo_eligibility MCP tool. See
// app/api/members/[memberId]/route.ts for the pattern this follows.

import { NextRequest, NextResponse } from "next/server";
import { getDemoEligibility, restErrorStatus } from "@/lib/healthcare-tools";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const result = getDemoEligibility({ memberId });
  if (!result.success) {
    return NextResponse.json(result, { status: restErrorStatus(result.error.code) });
  }
  return NextResponse.json(result, { status: 200 });
}
