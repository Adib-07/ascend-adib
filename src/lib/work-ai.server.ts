// Ascend Work AI — server-side orchestration.
// Generation reuses the existing Lovable AI Gateway (MODEL/TEMPERATURE/MAX_TOKENS).
// Persistence uses the RLS-enforced Supabase client from requireSupabaseAuth.
// No static datasets, no lead purchases, no auto-send, no external scrapers.

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { MAX_TOKENS, MODEL, TEMPERATURE } from "./tutor.server";
import {
  buildAudit,
  buildOpportunities,
  buildOutreach,
  buildProposal,
  buildQualify,
  buildReplyClassifier,
  buildResearch,
  buildWebsiteSpec,
  type AuditCategory,
  type LeadInput,
  type OutreachChannel,
  type ReplyCategory,
  type ResearchInput,
} from "./work-ai-core";

async function generate(system: string, prompt: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");
  const gateway = createLovableAiGatewayProvider(key);
  const { text } = await generateText({
    model: gateway(MODEL),
    temperature: TEMPERATURE,
    maxOutputTokens: Math.min(4000, MAX_TOKENS + 1000),
    system,
    prompt,
  });
  if (!text?.trim()) throw new Error("Empty response from AI");
  return text;
}

// ---------------------------------------------------------------------------
// Generation (no DB writes)
// ---------------------------------------------------------------------------

export async function qualifyLeadImpl(opts: {
  lead: LeadInput;
  researchSummary?: string;
}): Promise<string> {
  const { system, user } = buildQualify(opts.lead, opts.researchSummary);
  return generate(system, user);
}

export async function researchBusinessImpl(opts: { input: ResearchInput }): Promise<string> {
  const { system, user } = buildResearch(opts.input);
  return generate(system, user);
}

export async function auditWebsiteImpl(opts: { input: ResearchInput }): Promise<string> {
  const { system, user } = buildAudit(opts.input);
  return generate(system, user);
}

export async function detectOpportunitiesImpl(opts: {
  researchSummary: string;
  auditFindings?: string;
}): Promise<string> {
  const { system, user } = buildOpportunities(opts.researchSummary, opts.auditFindings);
  return generate(system, user);
}

export async function draftOutreachImpl(opts: {
  lead: LeadInput;
  researchSummary?: string;
  opportunity?: string;
  channel: OutreachChannel;
  previousMessage?: string;
}): Promise<string> {
  const { system, user } = buildOutreach(opts);
  return generate(system, user);
}

export async function classifyReplyImpl(opts: {
  replyText: string;
  context?: string;
}): Promise<string> {
  const { system, user } = buildReplyClassifier(opts.replyText, opts.context);
  return generate(system, user);
}

export async function generateProposalImpl(opts: {
  lead: LeadInput;
  researchSummary?: string;
  opportunity?: string;
  services?: string;
}): Promise<string> {
  const { system, user } = buildProposal(opts);
  return generate(system, user);
}

export async function generateWebsiteSpecImpl(opts: {
  requirements: string;
  researchSummary?: string;
  brand?: string;
  services?: string;
  audience?: string;
}): Promise<string> {
  const { system, user } = buildWebsiteSpec(opts);
  return generate(system, user);
}

// ---------------------------------------------------------------------------
// Persistence (RLS-scoped to the authenticated user)
// ---------------------------------------------------------------------------

export async function saveLeadResearchImpl({
  supabase,
  userId,
  leadId,
  summary,
  painPoints,
  techStackDetected,
}: {
  supabase: SupabaseClient;
  userId: string;
  leadId: string;
  summary?: string;
  painPoints?: string;
  techStackDetected?: string;
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("lead_research")
    .insert({
      user_id: userId,
      lead_id: leadId,
      summary: summary ?? null,
      pain_points: painPoints ?? null,
      tech_stack_detected: techStackDetected ?? null,
      research_method: "ai_assisted",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: (data as { id: string }).id };
}

export async function saveOutreachImpl({
  supabase,
  userId,
  leadId,
  leadName,
  message,
  channel,
  niche,
}: {
  supabase: SupabaseClient;
  userId: string;
  leadId?: string;
  leadName: string;
  message: string;
  channel: OutreachChannel;
  niche?: string;
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("outreach")
    .insert({
      user_id: userId,
      lead_id: leadId ?? null,
      lead_name: leadName,
      message_type: channel,
      niche: niche ?? null,
      notes: message,
      ai_drafted: true,
      approved: false,
      status: "DRAFT",
      outreach_date: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: (data as { id: string }).id };
}

export async function saveProposalImpl({
  supabase,
  userId,
  leadId,
  clientId,
  title,
  body,
}: {
  supabase: SupabaseClient;
  userId: string;
  leadId?: string;
  clientId?: string;
  title: string;
  body: string;
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("proposals")
    .insert({
      user_id: userId,
      lead_id: leadId ?? null,
      client_id: clientId ?? null,
      title,
      body_markdown: body,
      status: "Draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: (data as { id: string }).id };
}

export async function convertLeadToClientImpl({
  supabase,
  userId,
  leadId,
  name,
  niche,
  platform,
  contact,
}: {
  supabase: SupabaseClient;
  userId: string;
  leadId: string;
  name: string;
  niche?: string;
  platform?: string;
  contact?: string;
}): Promise<{ clientId: string }> {
  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: userId,
      name,
      niche: niche ?? null,
      platform: platform ?? null,
      contact: contact ?? null,
      status: "Active",
      revenue: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const clientId = (data as { id: string }).id;

  await supabase.from("leads").update({ status: "Won" }).eq("id", leadId).eq("user_id", userId);

  return { clientId };
}

export async function createProjectFromLeadImpl({
  supabase,
  userId,
  clientId,
  name,
}: {
  supabase: SupabaseClient;
  userId: string;
  clientId: string;
  name: string;
}): Promise<{ projectId: string }> {
  const { data, error } = await supabase
    .from("work_projects")
    .insert({
      user_id: userId,
      name,
      client_id: clientId,
      status: "Active",
      progress: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { projectId: (data as { id: string }).id };
}

// ---------------------------------------------------------------------------
// Next-Action engine (dashboard intelligence)
// ---------------------------------------------------------------------------

export interface WorkNextActions {
  leadsNeedingResearch: number;
  highPotential: number;
  outreachAwaitingApproval: number;
  followUpsDue: number;
  repliesRequiringAttention: number;
  activeProposals: number;
  activeClients: number;
  activeProjects: number;
  incomeTotal: number;
  recommendations: { action: string; reason: string }[];
}

export async function workNextActionsImpl({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<WorkNextActions> {
  const count = async (table: string, extra: { col: string; val: string }[]) => {
    let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
    for (const e of extra) q = q.eq(e.col, e.val);
    const { count: n } = await q;
    return n ?? 0;
  };

  const leadsNeedingResearch = await count("leads", [{ col: "status", val: "New" }]);
  const highPotential = await count("leads", [{ col: "status", val: "Qualified" }]);
  const outreachAwaitingApproval = await count("outreach", [
    { col: "ai_drafted", val: "true" },
    { col: "approved", val: "false" },
  ]);
  const followUpsDue = await count("outreach", [{ col: "status", val: "Sent" }]);
  const repliesRequiringAttention = await count("outreach", [{ col: "outcome", val: "Replied" }]);
  const activeProposals = await count("proposals", [{ col: "status", val: "Draft" }]);
  const activeClients = await count("clients", [{ col: "status", val: "Active" }]);
  const activeProjects = await count("work_projects", [{ col: "status", val: "Active" }]);

  const { data: income } = await supabase
    .from("finance_entries")
    .select("amount")
    .eq("user_id", userId);
  const incomeTotal = (income ?? []).reduce(
    (sum: number, r: { amount: number }) => sum + (Number(r.amount) || 0),
    0,
  );

  const recommendations: { action: string; reason: string }[] = [];
  if (leadsNeedingResearch > 0)
    recommendations.push({
      action: "RESEARCH",
      reason: `${leadsNeedingResearch} new lead(s) have no research yet.`,
    });
  if (highPotential > 0)
    recommendations.push({
      action: "AUDIT / WRITE OUTREACH",
      reason: `${highPotential} qualified lead(s) are ready for outreach.`,
    });
  if (outreachAwaitingApproval > 0)
    recommendations.push({
      action: "REVIEW OUTREACH",
      reason: `${outreachAwaitingApproval} AI draft(s) await human approval.`,
    });
  if (followUpsDue > 0)
    recommendations.push({
      action: "FOLLOW UP",
      reason: `${followUpsDue} sent outreach item(s) may need a follow-up.`,
    });
  if (repliesRequiringAttention > 0)
    recommendations.push({
      action: "RESPOND",
      reason: `${repliesRequiringAttention} reply/reply-received item(s) need a response.`,
    });
  if (activeProposals > 0)
    recommendations.push({
      action: "PREPARE PROPOSAL",
      reason: `${activeProposals} proposal(s) are in Draft.`,
    });

  return {
    leadsNeedingResearch,
    highPotential,
    outreachAwaitingApproval,
    followUpsDue,
    repliesRequiringAttention,
    activeProposals,
    activeClients,
    activeProjects,
    incomeTotal,
    recommendations,
  };
}

// silence unused-type lint while keeping the public surface documented
export type { AuditCategory, ReplyCategory };
