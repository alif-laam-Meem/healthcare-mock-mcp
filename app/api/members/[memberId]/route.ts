// Plain REST wrapper around the get_demo_member MCP tool, for callers (e.g.
// data-validation configs) that need a clean JSON response rather than the
// SSE-framed JSON-RPC envelope the MCP endpoint returns. Same synthetic data,
// same ToolSuccess/ToolError envelope — see lib/healthcare-tools.ts.

import { NextRequest, NextResponse } from "next/server";
import { getDemoMember } from "@/lib/healthcare-tools";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const result = getDemoMember({ memberId });
  if (!result.success) {
    const status = result.error.code === "member_not_found" ? 404 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { status: 200 });
}
