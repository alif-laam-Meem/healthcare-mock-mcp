// Implementations for the 18 synthetic healthcare-administration MCP tools.
//
// Safety: these are administrative simulations only. No diagnosis, treatment,
// dosage-change, medication-substitution, emergency-dispatch, or real-coverage
// logic lives here. All data is synthetic; a missing memberId is never
// defaulted to a fallback member.

import {
  DATA_AS_OF,
  BENEFITS,
  FORMULARY,
  PHARMACIES,
  PRESCRIPTION_REJECTIONS,
  PROVIDERS,
  findAccumulators,
  findClaim,
  findClaimsByMember,
  findDependents,
  findFormularyEntry,
  findMember,
  findMembersByIdentifiers,
  findProvider,
  type Member,
  type Provider,
} from "./demo-data";

// ---------------------------------------------------------------------------
// Envelope helpers
// ---------------------------------------------------------------------------
export interface ToolSuccess<T> {
  success: true;
  synthetic: true;
  tool: string;
  data: T;
  asOf: string;
  warnings: string[];
}
export interface ToolError {
  success: false;
  synthetic: true;
  tool: string;
  error: { code: string; message: string };
}
export type ToolResult<T> = ToolSuccess<T> | ToolError;

function ok<T>(tool: string, data: T, warnings: string[] = []): ToolSuccess<T> {
  return { success: true, synthetic: true, tool, data, asOf: new Date().toISOString(), warnings };
}
function err(tool: string, code: string, message: string): ToolError {
  return { success: false, synthetic: true, tool, error: { code, message } };
}

// Deterministic per-input pseudo-random fraction in [0, 1) — used for
// simulated values (pricing, distance) that must stay stable across repeated
// calls with the same arguments, without depending on call order.
function seededFraction(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function requireString(
  tool: string,
  input: Record<string, unknown>,
  field: string
): { value: string } | { error: ToolError } {
  const value = input[field];
  if (typeof value !== "string" || value.trim() === "") {
    return { error: err(tool, "missing_required_parameter", `${field} is required.`) };
  }
  return { value };
}

function requireMember(tool: string, memberId: string): { member: Member } | { error: ToolError } {
  const member = findMember(memberId);
  if (!member) {
    return { error: err(tool, "member_not_found", `No synthetic member matched memberId ${memberId}.`) };
  }
  return { member };
}

function optionalTrimmed(input: Record<string, unknown>, field: string): string | undefined {
  const value = input[field];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

// Resolves a member from any of three identifiers: memberId (authoritative,
// looked up alone), full name (firstName + lastName together), or dob.
// Callers may supply memberId, name, dob, or any combination — at least one
// complete identifier is required.
function resolveMember(tool: string, input: Record<string, unknown>): { member: Member } | { error: ToolError } {
  const memberId = optionalTrimmed(input, "memberId");
  const firstName = optionalTrimmed(input, "firstName");
  const lastName = optionalTrimmed(input, "lastName");
  const dob = optionalTrimmed(input, "dob");

  const hasName = firstName !== undefined && lastName !== undefined;
  if (!memberId && !hasName && !dob) {
    return {
      error: err(
        tool,
        "missing_required_parameter",
        "Provide a memberId, a full name (firstName and lastName), or a date of birth (dob) to look up this member."
      ),
    };
  }

  const matches = findMembersByIdentifiers({ memberId, firstName, lastName, dob });
  if (matches.length === 0) {
    return { error: err(tool, "member_not_found", "No synthetic member matched the supplied identifiers.") };
  }
  if (matches.length > 1) {
    return {
      error: err(
        tool,
        "ambiguous_member_match",
        `${matches.length} synthetic members matched the supplied identifiers. Provide an additional identifier (e.g. memberId) to narrow the match.`
      ),
    };
  }
  return { member: matches[0] };
}

// ---------------------------------------------------------------------------
// Member and eligibility tools
// ---------------------------------------------------------------------------
export function getDemoMember(input: Record<string, unknown>) {
  const tool = "get_demo_member";
  const resolved = resolveMember(tool, input);
  if ("error" in resolved) return resolved.error;
  return ok(tool, resolved.member);
}

export function getDemoEligibility(input: Record<string, unknown>) {
  const tool = "get_demo_eligibility";
  const resolved = resolveMember(tool, input);
  if ("error" in resolved) return resolved.error;
  const m = resolved.member;
  return ok(tool, {
    memberId: m.memberId,
    coverageStatus: m.coverageStatus,
    plan: m.plan,
    effectiveDate: m.plan.effectiveDate,
    terminationDate: m.plan.terminationDate,
    dataTimestamp: DATA_AS_OF,
  });
}

export function getDemoDependents(input: Record<string, unknown>) {
  const tool = "get_demo_dependents";
  const resolved = resolveMember(tool, input);
  if ("error" in resolved) return resolved.error;
  const memberId = resolved.member.memberId;
  return ok(tool, { memberId, dependents: findDependents(memberId) });
}

export function getDemoPcp(input: Record<string, unknown>) {
  const tool = "get_demo_pcp";
  const resolved = resolveMember(tool, input);
  if ("error" in resolved) return resolved.error;
  const m = resolved.member;
  if (!m.pcpProviderId) {
    return ok(tool, { memberId: m.memberId, pcpAssigned: false, pcp: null });
  }
  const provider = findProvider(m.pcpProviderId);
  return ok(tool, { memberId: m.memberId, pcpAssigned: true, pcp: provider ?? null });
}

export function searchDemoProviders(input: Record<string, unknown>) {
  const tool = "search_demo_providers";
  const specialty = requireString(tool, input, "specialty");
  if ("error" in specialty) return specialty.error;
  const location = requireString(tool, input, "location");
  if ("error" in location) return location.error;

  const memberId = input.memberId;
  if (typeof memberId === "string" && memberId.trim() !== "") {
    const member = requireMember(tool, memberId);
    if ("error" in member) return member.error;
  }

  const providerName = typeof input.providerName === "string" ? input.providerName.toLowerCase() : undefined;
  const loc = location.value.toLowerCase();
  const results = PROVIDERS.filter((p) => {
    const matchesSpecialty = p.specialty.toLowerCase().includes(specialty.value.toLowerCase());
    const matchesLocation =
      p.location.city.toLowerCase().includes(loc) ||
      p.location.state.toLowerCase() === loc ||
      p.location.zip === location.value;
    const matchesName = !providerName || p.name.toLowerCase().includes(providerName);
    return matchesSpecialty && matchesLocation && matchesName;
  });
  return ok(tool, { count: results.length, providers: results });
}

// ---------------------------------------------------------------------------
// Benefits tools
// ---------------------------------------------------------------------------
export function getDemoBenefits(input: Record<string, unknown>) {
  const tool = "get_demo_benefits";
  const resolved = resolveMember(tool, input);
  if ("error" in resolved) return resolved.error;
  const serviceType = requireString(tool, input, "serviceType");
  if ("error" in serviceType) return serviceType.error;

  const networkLevel = input.networkLevel === "out_of_network" ? "out_of_network" : "in_network";
  const entry = BENEFITS.find((b) => b.serviceType === serviceType.value && b.networkLevel === networkLevel);
  if (!entry) {
    return err(tool, "conflicting_demo_data", `No synthetic benefit entry for serviceType ${serviceType.value}.`);
  }
  return ok(tool, { memberId: resolved.member.memberId, ...entry });
}

export function getDemoAccumulators(input: Record<string, unknown>) {
  const tool = "get_demo_accumulators";
  const resolved = resolveMember(tool, input);
  if ("error" in resolved) return resolved.error;
  return ok(tool, findAccumulators(resolved.member.memberId));
}

export function estimateDemoCost(input: Record<string, unknown>) {
  const tool = "estimate_demo_cost";
  const resolved = resolveMember(tool, input);
  if ("error" in resolved) return resolved.error;
  const memberId = resolved.member.memberId;
  const serviceType = requireString(tool, input, "serviceType");
  if ("error" in serviceType) return serviceType.error;

  const networkLevel = input.networkLevel === "out_of_network" ? "out_of_network" : "in_network";
  const entry = BENEFITS.find((b) => b.serviceType === serviceType.value && b.networkLevel === networkLevel);
  if (!entry) {
    return err(tool, "conflicting_demo_data", `No synthetic benefit entry for serviceType ${serviceType.value}.`);
  }
  const seed = `${memberId}:${serviceType.value}:${input.providerName ?? ""}:${input.location ?? ""}:${networkLevel}`;
  const baseCost = 150 + Math.round(seededFraction(seed) * 2500);
  const low = Math.round(baseCost * 0.85);
  const high = Math.round(baseCost * 1.25);

  return ok(
    tool,
    {
      memberId,
      serviceType: serviceType.value,
      networkLevel,
      providerName: input.providerName ?? null,
      location: input.location ?? null,
      estimatedRange: { low, high, currency: "USD" },
      benefitAssumptions: entry,
      estimateOnly: true,
    },
    ["This is a simulated estimate based on synthetic data, not a real cost quote."]
  );
}

// ---------------------------------------------------------------------------
// Claims and EOB tools
// ---------------------------------------------------------------------------
export function searchDemoClaims(input: Record<string, unknown>) {
  const tool = "search_demo_claims";
  const resolved = resolveMember(tool, input);
  if ("error" in resolved) return resolved.error;
  const memberId = resolved.member.memberId;

  let results = findClaimsByMember(memberId);
  if (typeof input.serviceDate === "string" && input.serviceDate) {
    results = results.filter((c) => c.serviceDate === input.serviceDate);
  }
  if (typeof input.providerName === "string" && input.providerName) {
    const name = input.providerName.toLowerCase();
    results = results.filter((c) => c.providerName.toLowerCase().includes(name));
  }
  if (typeof input.status === "string" && input.status) {
    results = results.filter((c) => c.status === input.status);
  }
  return ok(tool, { memberId, count: results.length, claims: results });
}

export function getDemoClaimDetails(input: Record<string, unknown>) {
  const tool = "get_demo_claim_details";
  const claimId = requireString(tool, input, "claimId");
  if ("error" in claimId) return claimId.error;
  const claim = findClaim(claimId.value);
  if (!claim) return err(tool, "claim_not_found", `No synthetic claim matched claimId ${claimId.value}.`);
  if (typeof input.memberId === "string" && input.memberId && input.memberId !== claim.memberId) {
    return err(tool, "claim_member_mismatch", `Claim ${claimId.value} does not belong to memberId ${input.memberId}.`);
  }
  return ok(tool, claim);
}

export function getDemoEob(input: Record<string, unknown>) {
  const tool = "get_demo_eob";
  const claimId = requireString(tool, input, "claimId");
  if ("error" in claimId) return claimId.error;
  const claim = findClaim(claimId.value);
  if (!claim) return err(tool, "claim_not_found", `No synthetic claim matched claimId ${claimId.value}.`);
  const disallowed = Math.max(0, claim.billedAmount - claim.allowedAmount);
  return ok(tool, {
    claimId: claim.claimId,
    memberId: claim.memberId,
    billedAmount: claim.billedAmount,
    allowedAmount: claim.allowedAmount,
    planPaidAmount: claim.planPaidAmount,
    disallowedAmount: disallowed,
    memberResponsibility: claim.memberResponsibility,
  });
}

export function simulateDemoAppeal(input: Record<string, unknown>) {
  const tool = "simulate_demo_appeal";
  const resolved = resolveMember(tool, input);
  if ("error" in resolved) return resolved.error;
  const memberId = resolved.member.memberId;
  const claimId = requireString(tool, input, "claimId");
  if ("error" in claimId) return claimId.error;
  const reason = requireString(tool, input, "reason");
  if ("error" in reason) return reason.error;

  const claim = findClaim(claimId.value);
  if (!claim) return err(tool, "claim_not_found", `No synthetic claim matched claimId ${claimId.value}.`);
  if (claim.memberId !== memberId) {
    return err(tool, "claim_member_mismatch", `Claim ${claimId.value} does not belong to memberId ${memberId}.`);
  }
  if (input.confirmed !== true) {
    return err(tool, "confirmation_required", "Set confirmed=true to submit this simulated appeal.");
  }

  const confirmationNumber = `APL-${seededFraction(`${claimId.value}:${reason.value}`).toString().slice(2, 8)}`;
  return ok(tool, {
    memberId,
    claimId: claimId.value,
    reason: reason.value,
    status: "submitted",
    confirmationNumber,
  });
}

// ---------------------------------------------------------------------------
// Pharmacy and PBM tools
// ---------------------------------------------------------------------------
export function getDemoFormulary(input: Record<string, unknown>) {
  const tool = "get_demo_formulary";
  const resolved = resolveMember(tool, input);
  if ("error" in resolved) return resolved.error;
  const drugName = requireString(tool, input, "drugName");
  if ("error" in drugName) return drugName.error;

  const strength = typeof input.strength === "string" ? input.strength : undefined;
  const form = typeof input.form === "string" ? input.form : undefined;
  const entry = findFormularyEntry(drugName.value, strength, form);
  if (!entry) {
    return err(tool, "drug_not_found", `No synthetic formulary entry matched drugName ${drugName.value}.`);
  }
  return ok(tool, { memberId: resolved.member.memberId, ...entry });
}

export function priceDemoMedication(input: Record<string, unknown>) {
  const tool = "price_demo_medication";
  const resolved = resolveMember(tool, input);
  if ("error" in resolved) return resolved.error;
  const memberId = resolved.member.memberId;
  const drugName = requireString(tool, input, "drugName");
  if ("error" in drugName) return drugName.error;
  const daysSupplyStr = requireString(tool, input, "daysSupply");
  if ("error" in daysSupplyStr) return daysSupplyStr.error;
  const daysSupply = Number(daysSupplyStr.value);
  if (!Number.isFinite(daysSupply) || daysSupply <= 0) {
    return err(tool, "missing_required_parameter", "daysSupply must be a positive number.");
  }

  const entry = findFormularyEntry(drugName.value);
  if (!entry) {
    return err(tool, "drug_not_found", `No synthetic formulary entry matched drugName ${drugName.value}.`);
  }

  let pharmacyCategory: "preferred" | "standard" | "out_of_network" | "mail_order" = "standard";
  if (typeof input.pharmacyId === "string" && input.pharmacyId) {
    const pharmacy = PHARMACIES.find((p) => p.pharmacyId === input.pharmacyId);
    if (pharmacy) pharmacyCategory = pharmacy.type === "mail_order" ? "mail_order" : pharmacy.networkCategory;
  }

  const TIER_INGREDIENT_COST_PER_30_DAYS: Record<number, number> = { 1: 40, 2: 120, 3: 650, 4: 4200 };
  const TIER_PRICING: Record<number, { copay: number; coinsurance: number }> = {
    1: { copay: 10, coinsurance: 0 },
    2: { copay: 35, coinsurance: 0 },
    3: { copay: 0, coinsurance: 25 },
    4: { copay: 0, coinsurance: 30 },
  };
  const scale = daysSupply / 30;
  const ingredientCost = Math.round(TIER_INGREDIENT_COST_PER_30_DAYS[entry.tier] * scale);
  const { copay, coinsurance } = TIER_PRICING[entry.tier];
  let memberCost = coinsurance > 0 ? Math.round(ingredientCost * (coinsurance / 100)) : Math.round(copay * scale);
  if (pharmacyCategory === "out_of_network") memberCost = Math.round(memberCost * 1.5 + ingredientCost * 0.2);
  if (pharmacyCategory === "mail_order") memberCost = Math.round(memberCost * 0.85);

  return ok(
    tool,
    {
      memberId,
      drugName: drugName.value,
      tier: entry.tier,
      daysSupply,
      quantity: input.quantity ?? null,
      pharmacyId: input.pharmacyId ?? null,
      pharmacyCategory,
      priorAuthorizationRequired: entry.priorAuthorizationRequired,
      estimatedIngredientCost: ingredientCost,
      estimatedMemberCost: memberCost,
      currency: "USD",
      estimateOnly: true,
    },
    ["This is a simulated price based on synthetic data, not a real pharmacy quote."]
  );
}

export function searchDemoPharmacies(input: Record<string, unknown>) {
  const tool = "search_demo_pharmacies";
  const resolved = resolveMember(tool, input);
  if ("error" in resolved) return resolved.error;
  const location = requireString(tool, input, "location");
  if ("error" in location) return location.error;

  const pharmacyName = typeof input.pharmacyName === "string" ? input.pharmacyName.toLowerCase() : undefined;
  const pharmacyType = typeof input.pharmacyType === "string" ? input.pharmacyType : undefined;
  const loc = location.value.toLowerCase();

  const results = PHARMACIES.filter((p) => {
    const matchesLocation =
      p.location.city.toLowerCase().includes(loc) ||
      p.location.state.toLowerCase() === loc ||
      p.location.zip === location.value;
    const matchesName = !pharmacyName || p.name.toLowerCase().includes(pharmacyName);
    const matchesType = !pharmacyType || p.type === pharmacyType;
    return matchesLocation && matchesName && matchesType;
  }).map((p) => ({
    ...p,
    distanceMiles: Math.round(seededFraction(`${p.pharmacyId}:${location.value}`) * 20 * 10) / 10,
  }));

  return ok(tool, { count: results.length, pharmacies: results });
}

export function getDemoPrescriptionRejection(input: Record<string, unknown>) {
  const tool = "get_demo_prescription_rejection";
  const resolved = resolveMember(tool, input);
  if ("error" in resolved) return resolved.error;
  const prescriptionReference = requireString(tool, input, "prescriptionReference");
  if ("error" in prescriptionReference) return prescriptionReference.error;

  const rejection = PRESCRIPTION_REJECTIONS[prescriptionReference.value];
  if (!rejection) {
    return err(
      tool,
      "prescription_not_found",
      `No synthetic prescription rejection matched prescriptionReference ${prescriptionReference.value}.`
    );
  }
  return ok(tool, { memberId: resolved.member.memberId, prescriptionReference: prescriptionReference.value, ...rejection });
}

// ---------------------------------------------------------------------------
// Case and escalation tools
// ---------------------------------------------------------------------------
export function createDemoCase(input: Record<string, unknown>) {
  const tool = "create_demo_case";
  const resolved = resolveMember(tool, input);
  if ("error" in resolved) return resolved.error;
  const memberId = resolved.member.memberId;
  const category = requireString(tool, input, "category");
  if ("error" in category) return category.error;
  const summary = requireString(tool, input, "summary");
  if ("error" in summary) return summary.error;

  if (input.confirmed !== true) {
    return err(tool, "confirmation_required", "Set confirmed=true to create this simulated case.");
  }

  const caseNumber = `CASE-${seededFraction(`${memberId}:${category.value}:${summary.value}`).toString().slice(2, 8)}`;
  return ok(tool, {
    memberId,
    category: category.value,
    summary: summary.value,
    status: "open",
    caseNumber,
  });
}

export function escalateDemoConversation(input: Record<string, unknown>) {
  const tool = "escalate_demo_conversation";
  const reason = requireString(tool, input, "reason");
  if ("error" in reason) return reason.error;
  const urgency = requireString(tool, input, "urgency");
  if ("error" in urgency) return urgency.error;

  if (typeof input.memberId === "string" && input.memberId.trim() !== "") {
    const member = requireMember(tool, input.memberId);
    if ("error" in member) return member.error;
  }

  const destination = urgency.value === "high" ? "administrative_supervisor" : "administrative_queue";
  const escalationId = `ESC-${seededFraction(`${reason.value}:${urgency.value}:${input.memberId ?? ""}`).toString().slice(2, 8)}`;
  return ok(tool, {
    memberId: input.memberId ?? null,
    reason: reason.value,
    urgency: urgency.value,
    summary: input.summary ?? null,
    destination,
    escalationId,
  });
}

// ---------------------------------------------------------------------------
// Aggregate profile lookups (REST-only — not registered as MCP tools).
// Each bundles every synthetic record we have for a member in one domain, for
// callers (e.g. data-validation configs) that want the full picture in a
// single GET rather than issuing one MCP tool call per field.
// ---------------------------------------------------------------------------
export function getDemoClaimsBenefitsProfile(input: Record<string, unknown>): ToolResult<{
  memberId: string;
  claims: ReturnType<typeof findClaimsByMember>;
  accumulators: ReturnType<typeof findAccumulators> | null;
  benefitsCatalog: typeof BENEFITS;
}> {
  const tool = "get_demo_claims_benefits_profile";
  const memberId = requireString(tool, input, "memberId");
  if ("error" in memberId) return memberId.error;
  const member = requireMember(tool, memberId.value);
  if ("error" in member) return member.error;

  return ok(tool, {
    memberId: memberId.value,
    claims: findClaimsByMember(memberId.value),
    accumulators: findAccumulators(memberId.value) ?? null,
    benefitsCatalog: BENEFITS,
  });
}

export function getDemoPharmacyProfile(input: Record<string, unknown>): ToolResult<{
  memberId: string;
  formulary: typeof FORMULARY;
  pharmacies: typeof PHARMACIES;
  prescriptionRejections: typeof PRESCRIPTION_REJECTIONS;
}> {
  const tool = "get_demo_pharmacy_profile";
  const memberId = requireString(tool, input, "memberId");
  if ("error" in memberId) return memberId.error;
  const member = requireMember(tool, memberId.value);
  if ("error" in member) return member.error;

  return ok(tool, {
    memberId: memberId.value,
    formulary: FORMULARY,
    pharmacies: PHARMACIES,
    prescriptionRejections: PRESCRIPTION_REJECTIONS,
  });
}

export function getDemoProviderProfile(input: Record<string, unknown>): ToolResult<{
  memberId: string;
  pcpAssigned: boolean;
  pcp: Provider | null;
  providerDirectory: typeof PROVIDERS;
}> {
  const tool = "get_demo_provider_profile";
  const memberId = requireString(tool, input, "memberId");
  if ("error" in memberId) return memberId.error;
  const member = requireMember(tool, memberId.value);
  if ("error" in member) return member.error;

  const pcp = member.member.pcpProviderId ? findProvider(member.member.pcpProviderId) ?? null : null;

  return ok(tool, {
    memberId: memberId.value,
    pcpAssigned: pcp !== null,
    pcp,
    providerDirectory: PROVIDERS,
  });
}
