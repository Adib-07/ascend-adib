// Ascend Work AI — pure prompt builders (no DB / no AI imports).
// Kept dependency-free so lead/research/audit/opportunity/outreach/proposal
// prompt logic can be unit-tested without network access.

export type Potential = "HIGH POTENTIAL" | "MEDIUM POTENTIAL" | "LOW POTENTIAL";

export interface LeadInput {
  name?: string;
  website?: string;
  niche?: string;
  source_platform?: string;
  raw_notes?: string;
  contact?: string;
}

export interface ResearchInput {
  name: string;
  website?: string;
  publicInfo?: string;
}

export type AuditCategory =
  | "DESIGN"
  | "UX"
  | "MOBILE"
  | "PERFORMANCE"
  | "SEO"
  | "ACCESSIBILITY"
  | "CONTENT"
  | "CONVERSION"
  | "TRUST"
  | "TECHNICAL";

export type OutreachChannel = "cold_email" | "linkedin" | "follow_up" | "proposal_intro";

export type ReplyCategory =
  | "INTERESTED"
  | "QUESTION"
  | "PRICE_OBJECTION"
  | "NOT_NOW"
  | "NOT_INTERESTED"
  | "REQUEST_FOR_CALL"
  | "REQUEST_FOR_DETAILS"
  | "UNKNOWN";

export const WORK_AI_BASE = `You are the Ascend Freelance Operating System assistant for a B.Tech CSE student building a freelancing career.

SAFETY RULES:
- You help the user research, analyze, draft, and recommend. You NEVER send messages or emails.
- A human must explicitly approve any external message before it is sent.
- Distinguish clearly between OBSERVED (verified from provided info), INFERRED (reasonable assumption), and UNKNOWN (not available).
- Never invent facts, metrics, prices, names, or claims. If you cannot verify something, mark it UNKNOWN.
- Do not present AI estimates (value, fit) as guaranteed facts.
- Reference only real, observed opportunities in outreach. No fake compliments, no false urgency, no misleading statements.
- Respect privacy and public-information boundaries; do not request sensitive personal data.`;

function workSystem(extra: string): string {
  return `${WORK_AI_BASE}\n\n${extra}`;
}

function field(label: string, value: unknown): string {
  return value ? `${label}: ${value}` : "";
}

export function buildQualify(
  lead: LeadInput,
  researchSummary?: string,
): { system: string; user: string } {
  const info = [
    field("Business / lead name", lead.name),
    field("Website", lead.website),
    field("Niche / industry", lead.niche),
    field("Source platform", lead.source_platform),
    field("Contact", lead.contact),
    field("Raw notes", lead.raw_notes),
    researchSummary ? `Research summary:\n${researchSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system = workSystem(`MODE: LEAD QUALIFICATION.
Return a qualification with:
- POTENTIAL: one of HIGH POTENTIAL / MEDIUM POTENTIAL / LOW POTENTIAL
- REASONS: bullet list citing OBSERVED vs INFERRED vs UNKNOWN signals
- FACTORS: business fit, website quality, visible problems, likely need, service fit, urgency signals, estimated value (clearly labeled INFERRED), personalization opportunity.
Do not present estimates as facts.`);

  return { system, user: `Qualify this lead:\n${info}` };
}

export function buildResearch(input: ResearchInput): { system: string; user: string } {
  const info = [
    field("Business name", input.name),
    field("Website", input.website),
    input.publicInfo ? `Available public information:\n${input.publicInfo}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system = workSystem(`MODE: BUSINESS RESEARCH.
Produce: business summary, services/products, target audience, apparent strengths, apparent weaknesses, website UX observations, mobile observations, performance observations (mark UNKNOWN if not measurable), conversion observations, SEO observations (UNKNOWN if not measurable), accessibility observations (UNKNOWN if not measurable), potential improvement opportunities.
Mark every claim OBSERVED or UNKNOWN. Do not invent observations.`);

  return { system, user: `Research this business:\n${info}` };
}

export function buildAudit(input: ResearchInput): { system: string; user: string } {
  const info = [
    field("Business name", input.name),
    field("Website", input.website),
    input.publicInfo ? `Available public information:\n${input.publicInfo}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system = workSystem(`MODE: WEBSITE AUDIT.
For each relevant category (DESIGN, UX, MOBILE, PERFORMANCE, SEO, ACCESSIBILITY, CONTENT, CONVERSION, TRUST, TECHNICAL) output findings. Each finding must contain:
- category
- observation (OBSERVED or UNKNOWN)
- evidence/source
- impact
- confidence (High/Medium/Low)
- recommended improvement (actionable, not generic like "Improve SEO")
Mark UNKNOWN when evidence is unavailable.`);

  return { system, user: `Audit this website:\n${info}` };
}

export function buildOpportunities(
  researchSummary: string,
  auditFindings?: string,
): { system: string; user: string } {
  const system = workSystem(`MODE: OPPORTUNITY DETECTION.
Convert research/audit into potential services. For each opportunity provide:
- OPPORTUNITY
- WHY IT MATTERS
- POSSIBLE SERVICE
- VALUE PROPOSITION
- CONFIDENCE (High/Medium/Low, labeled INFERRED)
Do not claim the business will definitely buy. Reference only observed problems.`);

  const user = [
    `Research summary:\n${researchSummary}`,
    auditFindings ? `Audit findings:\n${auditFindings}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}

export function buildOutreach(opts: {
  lead: LeadInput;
  researchSummary?: string;
  opportunity?: string;
  channel: OutreachChannel;
  previousMessage?: string;
}): { system: string; user: string } {
  const channelNote: Record<OutreachChannel, string> = {
    cold_email: "Write a personalized cold email.",
    linkedin: "Write a LinkedIn-style connection/message draft.",
    follow_up: "Write a polite follow-up referencing the previous message.",
    proposal_intro: "Write a short proposal introduction.",
  };

  const system = workSystem(`MODE: OUTREACH DRAFT (${opts.channel}).
${channelNote[opts.channel]}
Use only verified research and a real observed opportunity. No generic spam, fake compliments, fabricated claims, or false urgency. End with a clear, low-pressure call to action. This draft requires human approval before any send.`);

  const user = [
    field("Lead", opts.lead.name),
    field("Website", opts.lead.website),
    field("Niche", opts.lead.niche),
    opts.researchSummary ? `Research:\n${opts.researchSummary}` : "",
    opts.opportunity ? `Opportunity:\n${opts.opportunity}` : "",
    opts.previousMessage ? `Previous message:\n${opts.previousMessage}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

export function buildReplyClassifier(
  replyText: string,
  context?: string,
): {
  system: string;
  user: string;
} {
  const system = workSystem(`MODE: REPLY ANALYSIS.
Classify the prospect reply into one of: INTERESTED, QUESTION, PRICE_OBJECTION, NOT_NOW, NOT_INTERESTED, REQUEST_FOR_CALL, REQUEST_FOR_DETAILS, UNKNOWN.
Return:
- CATEGORY
- INTENT (one line)
- SUGGESTED NEXT ACTION
- DRAFT RESPONSE (user-controlled; do not send)
Be helpful and honest.`);

  const user = [context ? `Context:\n${context}` : "", `Prospect reply:\n${replyText}`]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}

export function buildProposal(opts: {
  lead: LeadInput;
  researchSummary?: string;
  opportunity?: string;
  services?: string;
}): { system: string; user: string } {
  const system = workSystem(`MODE: PROPOSAL DRAFT.
Using the lead/research/opportunity context, generate:
- project summary
- client problem
- proposed solution
- scope
- deliverables
- timeline draft
- pricing placeholder (clearly labeled PLACEHOLDER / INFERRED; do not invent as fact)
- assumptions
- next steps
Use placeholders where information is missing.`);

  const user = [
    field("Lead", opts.lead.name),
    field("Niche", opts.lead.niche),
    opts.researchSummary ? `Research:\n${opts.researchSummary}` : "",
    opts.opportunity ? `Opportunity:\n${opts.opportunity}` : "",
    opts.services ? `Your services:\n${opts.services}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

export function buildWebsiteSpec(opts: {
  requirements: string;
  researchSummary?: string;
  brand?: string;
  services?: string;
  audience?: string;
}): { system: string; user: string } {
  const system = workSystem(`MODE: WEBSITE SPECIFICATION GENERATOR.
Transform client requirements + research into a detailed development specification for an AI coding agent. Include:
- project objective
- target users
- pages
- features
- user flows
- design requirements (reference brand if provided)
- technical requirements (do not hard-code a single framework unless required)
- database requirements
- APIs / integrations
- security
- testing
- deployment
- acceptance criteria
Do NOT deploy anything. This is a specification only.`);

  const user = [
    `Requirements:\n${opts.requirements}`,
    opts.researchSummary ? `Research:\n${opts.researchSummary}` : "",
    opts.brand ? `Brand: ${opts.brand}` : "",
    opts.services ? `Services: ${opts.services}` : "",
    opts.audience ? `Target audience: ${opts.audience}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}
