// Plain REST wrapper around getDemoProviderProfile: a member's PCP
// assignment (resolved to the full provider record, not just its ID) plus
// the full 16-provider directory. See app/api/members/[memberId]/route.ts
// for the pattern this follows.
//
// Optional query param: providerId narrows providerDirectory[] to one
// matching entry (404 provider_not_found if no such provider exists).

import { NextRequest, NextResponse } from "next/server";
import { getDemoProviderProfile, restErrorStatus } from "@/lib/healthcare-tools";

export async function GET(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const query = Object.fromEntries(req.nextUrl.searchParams);
  const result = getDemoProviderProfile({ memberId, ...query });
  if (!result.success) {
    return NextResponse.json(result, { status: restErrorStatus(result.error.code) });
  }
  return NextResponse.json(result, { status: 200 });
}
