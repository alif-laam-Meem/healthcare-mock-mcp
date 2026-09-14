// Plain REST wrapper around the get_demo_dependents MCP tool. See
// app/api/members/[memberId]/route.ts for the pattern this follows.
//
// Optional query param: dependentId — narrows the dependents[] array to one
// matching entry (404 dependent_not_found if it doesn't belong to this
// member), mirroring how MCP tools take an ID as an argument to look up one
// specific record server-side instead of returning everything.

import { NextRequest, NextResponse } from "next/server";
import { getDemoDependents, restErrorStatus } from "@/lib/healthcare-tools";

export async function GET(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const query = Object.fromEntries(req.nextUrl.searchParams);
  const result = getDemoDependents({ memberId, ...query });
  if (!result.success) {
    return NextResponse.json(result, { status: restErrorStatus(result.error.code) });
  }
  return NextResponse.json(result, { status: 200 });
}
