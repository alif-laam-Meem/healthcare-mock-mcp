// MCP server entry point (Streamable HTTP transport) for the synthetic
// healthcare-administration demo tools. No stdio/SSE/WebSocket transport is
// registered here — this endpoint is meant for Vapi's "mcp" tool config
// pointed at https://<deployment>/api/mcp.
//
// TODO before exposing this beyond local/mock evaluation: require an
// authorization header (checked here, value stored in a Vercel env var and a
// Vapi secure credential) — no real PHI is served today, so this is
// intentionally left out for the initial mock-data evaluation.

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import * as tools from "@/lib/healthcare-tools";

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

const handler = createMcpHandler(
  (server) => {
  server.tool(
    "get_demo_member",
    "Retrieves a synthetic member's basic profile and plan information. Returns fabricated demo data only.",
    { memberId: z.string().optional() },
    async (args) => textResult(tools.getDemoMember(args))
  );

  server.tool(
    "get_demo_eligibility",
    "Returns a synthetic member's coverage status, plan, effective date, termination date, and data timestamp.",
    { memberId: z.string().optional() },
    async (args) => textResult(tools.getDemoEligibility(args))
  );

  server.tool(
    "get_demo_dependents",
    "Returns a synthetic member's dependents and their coverage status.",
    { memberId: z.string().optional() },
    async (args) => textResult(tools.getDemoDependents(args))
  );

  server.tool(
    "get_demo_pcp",
    "Returns a synthetic member's primary care provider assignment, or indicates that none is assigned.",
    { memberId: z.string().optional() },
    async (args) => textResult(tools.getDemoPcp(args))
  );

  server.tool(
    "search_demo_providers",
    "Searches the synthetic provider directory by specialty and location and returns network status.",
    {
      specialty: z.string().optional(),
      location: z.string().optional(),
      memberId: z.string().optional(),
      providerName: z.string().optional(),
    },
    async (args) => textResult(tools.searchDemoProviders(args))
  );

  server.tool(
    "get_demo_benefits",
    "Returns synthetic benefit details for a service type: copay, coinsurance, deductible applicability, limits, exclusions, and prior authorization requirements.",
    {
      memberId: z.string().optional(),
      serviceType: z.string().optional(),
      networkLevel: z.enum(["in_network", "out_of_network"]).optional(),
    },
    async (args) => textResult(tools.getDemoBenefits(args))
  );

  server.tool(
    "get_demo_accumulators",
    "Returns a synthetic member's individual and family deductible and out-of-pocket totals, amounts met, and remaining amounts.",
    { memberId: z.string().optional() },
    async (args) => textResult(tools.getDemoAccumulators(args))
  );

  server.tool(
    "estimate_demo_cost",
    "Provides a simulated cost range for a service, with stated assumptions and an estimate-only indicator. Not a real quote.",
    {
      memberId: z.string().optional(),
      serviceType: z.string().optional(),
      providerName: z.string().optional(),
      location: z.string().optional(),
      networkLevel: z.enum(["in_network", "out_of_network"]).optional(),
    },
    async (args) => textResult(tools.estimateDemoCost(args))
  );

  server.tool(
    "search_demo_claims",
    "Returns synthetic claims matching a member and optional filters (service date, provider name, status).",
    {
      memberId: z.string().optional(),
      serviceDate: z.string().optional(),
      providerName: z.string().optional(),
      status: z.enum(["submitted", "processing", "paid", "denied"]).optional(),
    },
    async (args) => textResult(tools.searchDemoClaims(args))
  );

  server.tool(
    "get_demo_claim_details",
    "Returns detailed synthetic claim status, amounts, codes, and processing history.",
    { claimId: z.string().optional(), memberId: z.string().optional() },
    async (args) => textResult(tools.getDemoClaimDetails(args))
  );

  server.tool(
    "get_demo_eob",
    "Returns a synthetic explanation of benefits: billed, allowed, plan-paid, disallowed, and member-responsibility amounts.",
    { claimId: z.string().optional() },
    async (args) => textResult(tools.getDemoEob(args))
  );

  server.tool(
    "simulate_demo_appeal",
    "Simulates submitting a claim appeal and returns a fictional confirmation number. Requires confirmed=true.",
    {
      memberId: z.string().optional(),
      claimId: z.string().optional(),
      reason: z.string().optional(),
      confirmed: z.boolean().optional(),
    },
    async (args) => textResult(tools.simulateDemoAppeal(args))
  );

  server.tool(
    "get_demo_formulary",
    "Returns synthetic formulary coverage for a drug: tier, prior authorization, step therapy, quantity limits, and specialty requirements.",
    {
      memberId: z.string().optional(),
      drugName: z.string().optional(),
      strength: z.string().optional(),
      form: z.string().optional(),
    },
    async (args) => textResult(tools.getDemoFormulary(args))
  );

  server.tool(
    "price_demo_medication",
    "Returns simulated retail, preferred, specialty, or mail-order pricing for a medication. Not a real pharmacy quote.",
    {
      memberId: z.string().optional(),
      drugName: z.string().optional(),
      daysSupply: z.string().optional(),
      quantity: z.string().optional(),
      pharmacyId: z.string().optional(),
    },
    async (args) => textResult(tools.priceDemoMedication(args))
  );

  server.tool(
    "search_demo_pharmacies",
    "Returns synthetic pharmacies near a location with network category, mail-order availability, and simulated distance.",
    {
      memberId: z.string().optional(),
      location: z.string().optional(),
      pharmacyName: z.string().optional(),
      pharmacyType: z.enum(["retail", "mail_order", "specialty"]).optional(),
    },
    async (args) => textResult(tools.searchDemoPharmacies(args))
  );

  server.tool(
    "get_demo_prescription_rejection",
    "Returns a simulated prescription rejection code, plain-language explanation, and next action.",
    { memberId: z.string().optional(), prescriptionReference: z.string().optional() },
    async (args) => textResult(tools.getDemoPrescriptionRejection(args))
  );

  server.tool(
    "create_demo_case",
    "Simulates creating a service case and returns a fictional case number. Requires confirmed=true.",
    {
      memberId: z.string().optional(),
      category: z.string().optional(),
      summary: z.string().optional(),
      confirmed: z.boolean().optional(),
    },
    async (args) => textResult(tools.createDemoCase(args))
  );

  server.tool(
    "escalate_demo_conversation",
    "Simulates escalating the conversation to the appropriate administrative or safety destination.",
    {
      reason: z.string().optional(),
      urgency: z.enum(["low", "normal", "high"]).optional(),
      memberId: z.string().optional(),
      summary: z.string().optional(),
    },
    async (args) => textResult(tools.escalateDemoConversation(args))
  );
  },
  {},
  { basePath: "/api" }
);

export { handler as GET, handler as POST, handler as DELETE };
