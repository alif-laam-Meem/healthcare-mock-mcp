// Plain REST wrapper around getDemoProviderProfile: a member's PCP
// assignment (resolved to the full provider record, not just its ID) plus
// the full 16-provider directory. See app/api/members/[memberId]/route.ts
// for the pattern this follows.

import { NextRequest, NextResponse } from "next/server";
import { getDemoProviderProfile } from "@/lib/healthcare-tools";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const result = getDemoProviderProfile({ memberId });
  if (!result.success) {
    const status = result.error.code === "member_not_found" ? 404 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { status: 200 });
}
