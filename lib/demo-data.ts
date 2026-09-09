// Synthetic reference and member data for the healthcare demo MCP server.
// Everything here is fabricated. No real member, provider, or claim data.

// ---------------------------------------------------------------------------
// Deterministic PRNG so the "20 synthetic members" dataset is stable across
// server restarts/deploys (mulberry32).
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260101);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const FIRST_NAMES = [
  "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn", "Peyton",
  "Rowan", "Skyler", "Dakota", "Reese", "Emerson", "Finley", "Hayden", "Kendall",
  "Sawyer", "Blake", "Cameron", "Drew",
];
const LAST_NAMES = [
  "Alvarez", "Bennett", "Chen", "Delgado", "Ellison", "Farrow", "Grant",
  "Huang", "Ibarra", "Jansen", "Kowalski", "Lindqvist", "Mercer", "Nakamura",
  "Okafor", "Petrov", "Quintero", "Rasmussen", "Salazar", "Thibault",
];
const CITIES = [
  { city: "Springvale", state: "OH", zip: "44001" },
  { city: "Rivermont", state: "TX", zip: "75201" },
  { city: "Fairbrook", state: "CA", zip: "94105" },
  { city: "Cedar Hollow", state: "NC", zip: "27601" },
  { city: "Lakeport", state: "MN", zip: "55401" },
  { city: "Elmshire", state: "GA", zip: "30301" },
];
const PLANS = [
  { name: "Synthetic PPO Gold", type: "PPO" },
  { name: "Synthetic HMO Silver", type: "HMO" },
  { name: "Synthetic EPO Bronze", type: "EPO" },
];
const SPECIALTIES = [
  "Family Medicine", "Internal Medicine", "Cardiology", "Dermatology",
  "Orthopedics", "Behavioral Health", "Endocrinology", "Physical Therapy",
];

export const DATA_AS_OF = "2026-09-09T00:00:00.000Z";

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------
export interface Provider {
  providerId: string;
  name: string;
  specialty: string;
  location: { city: string; state: string; zip: string };
  networkStatus: "in_network" | "out_of_network";
  acceptingNewPatients: boolean;
}

export const PROVIDERS: Provider[] = Array.from({ length: 16 }, (_, i) => {
  const loc = pick(CITIES);
  return {
    providerId: `PRV${2000 + i}`,
    name: `Dr. ${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    specialty: pick(SPECIALTIES),
    location: loc,
    networkStatus: rand() < 0.8 ? "in_network" : "out_of_network",
    acceptingNewPatients: rand() < 0.6,
  };
});

// ---------------------------------------------------------------------------
// Members, dependents, accumulators
// ---------------------------------------------------------------------------
export interface Member {
  memberId: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: "F" | "M" | "X";
  location: { city: string; state: string; zip: string };
  plan: {
    name: string;
    type: string;
    effectiveDate: string;
    terminationDate: string | null;
  };
  coverageStatus: "active" | "inactive";
  pcpProviderId: string | null;
}

export interface Dependent {
  dependentId: string;
  memberId: string;
  name: string;
  relationship: "spouse" | "child";
  dob: string;
  coverageStatus: "active" | "inactive";
}

export const MEMBERS: Member[] = Array.from({ length: 20 }, (_, i) => {
  const inactive = i === 19; // one deliberately inactive member for demos
  const plan = pick(PLANS);
  return {
    memberId: `M${1000 + i}`,
    firstName: FIRST_NAMES[i],
    lastName: LAST_NAMES[i],
    dob: `19${int(55, 99)}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`,
    gender: pick(["F", "M", "X"] as const),
    location: pick(CITIES),
    plan: {
      name: plan.name,
      type: plan.type,
      effectiveDate: "2026-01-01",
      terminationDate: inactive ? "2026-06-30" : null,
    },
    coverageStatus: inactive ? "inactive" : "active",
    pcpProviderId: i % 4 === 0 ? null : pick(PROVIDERS).providerId,
  };
});

export const DEPENDENTS: Dependent[] = MEMBERS.flatMap((m, i) => {
  const count = i % 5 === 0 ? 2 : i % 3 === 0 ? 1 : 0;
  return Array.from({ length: count }, (_, d) => ({
    dependentId: `${m.memberId}-D${d + 1}`,
    memberId: m.memberId,
    name: `${pick(FIRST_NAMES)} ${m.lastName}`,
    relationship: d === 0 && count === 2 ? "spouse" : "child",
    dob: `20${int(2, 20)}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`,
    coverageStatus: m.coverageStatus,
  }));
});

export interface Accumulators {
  memberId: string;
  individual: { deductible: MoneyProgress; outOfPocket: MoneyProgress };
  family: { deductible: MoneyProgress; outOfPocket: MoneyProgress } | null;
}
interface MoneyProgress {
  limit: number;
  met: number;
  remaining: number;
}
function progress(limit: number): MoneyProgress {
  const met = int(0, limit);
  return { limit, met, remaining: limit - met };
}
export const ACCUMULATORS: Record<string, Accumulators> = Object.fromEntries(
  MEMBERS.map((m) => {
    const hasFamily = DEPENDENTS.some((d) => d.memberId === m.memberId);
    return [
      m.memberId,
      {
        memberId: m.memberId,
        individual: { deductible: progress(1500), outOfPocket: progress(6000) },
        family: hasFamily
          ? { deductible: progress(3000), outOfPocket: progress(12000) }
          : null,
      } satisfies Accumulators,
    ];
  })
);

// ---------------------------------------------------------------------------
// Benefits (by service type / network level)
// ---------------------------------------------------------------------------
export interface BenefitEntry {
  serviceType: string;
  networkLevel: "in_network" | "out_of_network";
  copay: number | null;
  coinsurance: number | null;
  deductibleApplies: boolean;
  limits: string | null;
  exclusions: string[];
  priorAuthorizationRequired: boolean;
}
const SERVICE_TYPES = [
  "primary_care_visit", "specialist_visit", "urgent_care", "emergency_room",
  "imaging", "lab", "physical_therapy", "mental_health", "durable_medical_equipment",
];
export const BENEFITS: BenefitEntry[] = SERVICE_TYPES.flatMap((serviceType) => [
  {
    serviceType,
    networkLevel: "in_network",
    copay: serviceType === "emergency_room" ? null : int(20, 50),
    coinsurance: serviceType === "emergency_room" ? 20 : null,
    deductibleApplies: ["imaging", "emergency_room", "durable_medical_equipment"].includes(serviceType),
    limits: serviceType === "physical_therapy" ? "20 visits per plan year" : null,
    exclusions: [],
    priorAuthorizationRequired: ["imaging", "durable_medical_equipment"].includes(serviceType),
  },
  {
    serviceType,
    networkLevel: "out_of_network",
    copay: null,
    coinsurance: 40,
    deductibleApplies: true,
    limits: serviceType === "physical_therapy" ? "20 visits per plan year (combined)" : null,
    exclusions: serviceType === "mental_health" ? [] : ["Balance billing may apply"],
    priorAuthorizationRequired: true,
  },
]);

// ---------------------------------------------------------------------------
// Claims / EOB
// ---------------------------------------------------------------------------
export interface Claim {
  claimId: string;
  memberId: string;
  serviceDate: string;
  providerName: string;
  status: "submitted" | "processing" | "paid" | "denied";
  codes: { cpt: string; diagnosis: string };
  billedAmount: number;
  allowedAmount: number;
  planPaidAmount: number;
  memberResponsibility: number;
  processingHistory: { date: string; status: string; note: string }[];
}
const CPT_CODES = ["99213", "99214", "70553", "80053", "97110", "90837"];
const DX_CODES = ["I10", "E11.9", "M54.5", "F41.1", "J06.9", "K21.9"];
const CLAIM_STATUSES: Claim["status"][] = ["submitted", "processing", "paid", "denied"];

export const CLAIMS: Claim[] = MEMBERS.slice(0, 15).flatMap((m, mi) =>
  Array.from({ length: int(1, 3) }, (_, ci) => {
    const billed = int(120, 4000);
    const allowed = Math.round(billed * (0.5 + rand() * 0.3));
    const status = CLAIM_STATUSES[(mi + ci) % CLAIM_STATUSES.length];
    const planPaid = status === "denied" ? 0 : Math.round(allowed * 0.8);
    return {
      claimId: `CLM${5000 + mi * 10 + ci}`,
      memberId: m.memberId,
      serviceDate: `2026-0${int(1, 8)}-${String(int(1, 28)).padStart(2, "0")}`,
      providerName: pick(PROVIDERS).name,
      status,
      codes: { cpt: pick(CPT_CODES), diagnosis: pick(DX_CODES) },
      billedAmount: billed,
      allowedAmount: allowed,
      planPaidAmount: planPaid,
      memberResponsibility: Math.max(0, allowed - planPaid),
      processingHistory: [
        { date: "2026-08-01", status: "received", note: "Claim received from provider." },
        { date: "2026-08-05", status: "processing", note: "Under adjudication review." },
        ...(status === "paid" || status === "denied"
          ? [{ date: "2026-08-12", status, note: status === "paid" ? "Claim paid to provider." : "Claim denied: see EOB for reason." }]
          : []),
      ],
    };
  })
);

// ---------------------------------------------------------------------------
// Pharmacy / PBM
// ---------------------------------------------------------------------------
export interface FormularyEntry {
  drugName: string;
  strength: string;
  form: string;
  tier: 1 | 2 | 3 | 4;
  priorAuthorizationRequired: boolean;
  stepTherapyRequired: boolean;
  quantityLimit: string | null;
  specialtyRequired: boolean;
  covered: boolean;
}
export const FORMULARY: FormularyEntry[] = [
  { drugName: "metformin", strength: "500mg", form: "tablet", tier: 1, priorAuthorizationRequired: false, stepTherapyRequired: false, quantityLimit: null, specialtyRequired: false, covered: true },
  { drugName: "lisinopril", strength: "10mg", form: "tablet", tier: 1, priorAuthorizationRequired: false, stepTherapyRequired: false, quantityLimit: null, specialtyRequired: false, covered: true },
  { drugName: "atorvastatin", strength: "20mg", form: "tablet", tier: 1, priorAuthorizationRequired: false, stepTherapyRequired: false, quantityLimit: null, specialtyRequired: false, covered: true },
  { drugName: "sertraline", strength: "50mg", form: "tablet", tier: 2, priorAuthorizationRequired: false, stepTherapyRequired: false, quantityLimit: "30 tablets / 30 days", specialtyRequired: false, covered: true },
  { drugName: "albuterol", strength: "90mcg", form: "inhaler", tier: 2, priorAuthorizationRequired: false, stepTherapyRequired: false, quantityLimit: "1 inhaler / 30 days", specialtyRequired: false, covered: true },
  { drugName: "semaglutide", strength: "1mg", form: "injection", tier: 3, priorAuthorizationRequired: true, stepTherapyRequired: true, quantityLimit: "4 pens / 28 days", specialtyRequired: false, covered: true },
  { drugName: "adalimumab", strength: "40mg", form: "injection", tier: 4, priorAuthorizationRequired: true, stepTherapyRequired: true, quantityLimit: "2 syringes / 28 days", specialtyRequired: true, covered: true },
  { drugName: "insulin glargine", strength: "100u/mL", form: "injection", tier: 3, priorAuthorizationRequired: false, stepTherapyRequired: false, quantityLimit: "1 vial / 30 days", specialtyRequired: false, covered: true },
  { drugName: "hydrocodone-acetaminophen", strength: "5-325mg", form: "tablet", tier: 2, priorAuthorizationRequired: true, stepTherapyRequired: false, quantityLimit: "12 tablets / 30 days", specialtyRequired: false, covered: true },
  { drugName: "experimental-compound-x", strength: "100mg", form: "capsule", tier: 4, priorAuthorizationRequired: true, stepTherapyRequired: true, quantityLimit: null, specialtyRequired: true, covered: false },
];

export interface Pharmacy {
  pharmacyId: string;
  name: string;
  location: { city: string; state: string; zip: string };
  type: "retail" | "mail_order" | "specialty";
  networkCategory: "preferred" | "standard" | "out_of_network";
  mailOrderAvailable: boolean;
}
export const PHARMACIES: Pharmacy[] = [
  { pharmacyId: "PHM01", name: "Corner Health Pharmacy", location: CITIES[0], type: "retail", networkCategory: "preferred", mailOrderAvailable: false },
  { pharmacyId: "PHM02", name: "MainStreet Drugs", location: CITIES[1], type: "retail", networkCategory: "standard", mailOrderAvailable: false },
  { pharmacyId: "PHM03", name: "Synthetic Mail Rx", location: CITIES[2], type: "mail_order", networkCategory: "preferred", mailOrderAvailable: true },
  { pharmacyId: "PHM04", name: "Cedar Specialty Pharmacy", location: CITIES[3], type: "specialty", networkCategory: "preferred", mailOrderAvailable: true },
  { pharmacyId: "PHM05", name: "Lakeport Discount Pharmacy", location: CITIES[4], type: "retail", networkCategory: "out_of_network", mailOrderAvailable: false },
];

export const PRESCRIPTION_REJECTIONS: Record<
  string,
  { code: string; explanation: string; nextAction: string }
> = {
  "RX-DEMO-0001": {
    code: "PA_REQUIRED",
    explanation: "This medication requires prior authorization before it can be filled.",
    nextAction: "Ask the prescriber to submit a prior authorization request.",
  },
  "RX-DEMO-0002": {
    code: "REFILL_TOO_SOON",
    explanation: "The previous fill has not reached the refill-eligible date.",
    nextAction: "Retry after the refill-eligible date shown on the last fill receipt.",
  },
  "RX-DEMO-0003": {
    code: "NOT_COVERED",
    explanation: "This medication is not on the plan's covered formulary.",
    nextAction: "Ask the prescriber about a covered therapeutic alternative.",
  },
  "RX-DEMO-0004": {
    code: "QUANTITY_LIMIT_EXCEEDED",
    explanation: "The requested quantity exceeds the plan's quantity limit for this drug.",
    nextAction: "Request a quantity within the plan limit, or a quantity-limit exception.",
  },
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------
export const findMember = (memberId: string) => MEMBERS.find((m) => m.memberId === memberId);
export const findDependents = (memberId: string) => DEPENDENTS.filter((d) => d.memberId === memberId);
export const findAccumulators = (memberId: string) => ACCUMULATORS[memberId];
export const findClaim = (claimId: string) => CLAIMS.find((c) => c.claimId === claimId);
export const findClaimsByMember = (memberId: string) => CLAIMS.filter((c) => c.memberId === memberId);
export const findProvider = (providerId: string) => PROVIDERS.find((p) => p.providerId === providerId);
export const findFormularyEntry = (drugName: string, strength?: string, form?: string) =>
  FORMULARY.find(
    (f) =>
      f.drugName.toLowerCase() === drugName.toLowerCase() &&
      (!strength || f.strength.toLowerCase() === strength.toLowerCase()) &&
      (!form || f.form.toLowerCase() === form.toLowerCase())
  );
