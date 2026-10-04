import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiRateLimit } from "./rate-limit";
import type { OutreachChannel } from "./work-ai-core";

const leadSchema = z.object({
  name: z.string().max(300).optional(),
  website: z.string().max(500).optional(),
  niche: z.string().max(300).optional(),
  source_platform: z.string().max(200).optional(),
  raw_notes: z.string().max(8000).optional(),
  contact: z.string().max(2000).optional(),
});

const researchSchema = z.object({
  name: z.string().min(1).max(300),
  website: z.string().max(500).optional(),
  publicInfo: z.string().max(8000).optional(),
});

export const workAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, aiRateLimit])
  .inputValidator(
    z.object({
      action: z.enum([
        "qualify",
        "research",
        "audit",
        "opportunities",
        "outreach",
        "reply",
        "proposal",
        "websiteSpec",
      ]),
      lead: leadSchema.optional(),
      researchSummary: z.string().max(8000).optional(),
      auditFindings: z.string().max(8000).optional(),
      opportunity: z.string().max(8000).optional(),
      research: researchSchema.optional(),
      channel: z.enum(["cold_email", "linkedin", "follow_up", "proposal_intro"]).optional(),
      previousMessage: z.string().max(8000).optional(),
      replyText: z.string().max(8000).optional(),
      services: z.string().max(4000).optional(),
      requirements: z.string().max(8000).optional(),
      brand: z.string().max(1000).optional(),
      audience: z.string().max(1000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    return workAssistantImpl({
      supabase: context.supabase,
      userId: context.userId,
      action: data.action,
      lead: data.lead,
      researchSummary: data.researchSummary,
      auditFindings: data.auditFindings,
      opportunity: data.opportunity,
      research: data.research,
      channel: data.channel as OutreachChannel | undefined,
      previousMessage: data.previousMessage,
      replyText: data.replyText,
      services: data.services,
      requirements: data.requirements,
      brand: data.brand,
      audience: data.audience,
    });
  });

// The generation dispatcher shares the same impl set; keep a thin wrapper.
async function workAssistantImpl(args: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
  action: string;
  lead?: z.infer<typeof leadSchema>;
  researchSummary?: string;
  auditFindings?: string;
  opportunity?: string;
  research?: z.infer<typeof researchSchema>;
  channel?: OutreachChannel;
  previousMessage?: string;
  replyText?: string;
  services?: string;
  requirements?: string;
  brand?: string;
  audience?: string;
}): Promise<string> {
  const s = await import("./work-ai.server");
  switch (args.action) {
    case "qualify":
      return s.qualifyLeadImpl({ lead: args.lead ?? {}, researchSummary: args.researchSummary });
    case "research":
      return s.researchBusinessImpl({ input: args.research! });
    case "audit":
      return s.auditWebsiteImpl({ input: args.research! });
    case "opportunities":
      return s.detectOpportunitiesImpl({
        researchSummary: args.researchSummary ?? "",
        auditFindings: args.auditFindings,
      });
    case "outreach":
      return s.draftOutreachImpl({
        lead: args.lead ?? {},
        researchSummary: args.researchSummary,
        opportunity: args.opportunity,
        channel: args.channel ?? "cold_email",
        previousMessage: args.previousMessage,
      });
    case "reply":
      return s.classifyReplyImpl({
        replyText: args.replyText ?? "",
        context: args.researchSummary,
      });
    case "proposal":
      return s.generateProposalImpl({
        lead: args.lead ?? {},
        researchSummary: args.researchSummary,
        opportunity: args.opportunity,
        services: args.services,
      });
    case "websiteSpec":
      return s.generateWebsiteSpecImpl({
        requirements: args.requirements ?? "",
        researchSummary: args.researchSummary,
        brand: args.brand,
        services: args.services,
        audience: args.audience,
      });
    default:
      throw new Error("Unknown work action");
  }
}

export const workSaveResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      leadId: z.string().uuid(),
      summary: z.string().max(8000).optional(),
      painPoints: z.string().max(8000).optional(),
      techStackDetected: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { saveLeadResearchImpl } = await import("./work-ai.server");
    return saveLeadResearchImpl({
      supabase: context.supabase,
      userId: context.userId,
      leadId: data.leadId,
      summary: data.summary,
      painPoints: data.painPoints,
      techStackDetected: data.techStackDetected,
    });
  });

export const workSaveOutreach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      leadId: z.string().uuid().optional(),
      leadName: z.string().min(1).max(300),
      message: z.string().min(1).max(8000),
      channel: z.enum(["cold_email", "linkedin", "follow_up", "proposal_intro"]),
      niche: z.string().max(300).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { saveOutreachImpl } = await import("./work-ai.server");
    return saveOutreachImpl({
      supabase: context.supabase,
      userId: context.userId,
      leadId: data.leadId,
      leadName: data.leadName,
      message: data.message,
      channel: data.channel,
      niche: data.niche,
    });
  });

export const workSaveProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      leadId: z.string().uuid().optional(),
      clientId: z.string().uuid().optional(),
      title: z.string().min(1).max(300),
      body: z.string().min(1).max(12000),
    }),
  )
  .handler(async ({ context, data }) => {
    const { saveProposalImpl } = await import("./work-ai.server");
    return saveProposalImpl({
      supabase: context.supabase,
      userId: context.userId,
      leadId: data.leadId,
      clientId: data.clientId,
      title: data.title,
      body: data.body,
    });
  });

export const workConvertLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      leadId: z.string().uuid(),
      name: z.string().min(1).max(300),
      niche: z.string().max(300).optional(),
      platform: z.string().max(200).optional(),
      contact: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { convertLeadToClientImpl } = await import("./work-ai.server");
    return convertLeadToClientImpl({
      supabase: context.supabase,
      userId: context.userId,
      leadId: data.leadId,
      name: data.name,
      niche: data.niche,
      platform: data.platform,
      contact: data.contact,
    });
  });

export const workCreateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      clientId: z.string().uuid(),
      name: z.string().min(1).max(300),
    }),
  )
  .handler(async ({ context, data }) => {
    const { createProjectFromLeadImpl } = await import("./work-ai.server");
    return createProjectFromLeadImpl({
      supabase: context.supabase,
      userId: context.userId,
      clientId: data.clientId,
      name: data.name,
    });
  });

export const workNextActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({}))
  .handler(async ({ context }) => {
    const { workNextActionsImpl } = await import("./work-ai.server");
    return workNextActionsImpl({ supabase: context.supabase, userId: context.userId });
  });
