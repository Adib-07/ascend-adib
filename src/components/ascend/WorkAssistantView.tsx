import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { mapAuthError } from "@/lib/auth-errors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Briefcase,
  Search,
  FlaskConical,
  Lightbulb,
  Mail,
  Reply,
  FileText,
  Globe,
  ListChecks,
  Loader2,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import {
  workAssistant,
  workNextActions,
  workSaveOutreach,
  workSaveProposal,
  workSaveResearch,
} from "@/lib/work-ai.functions";

type Action =
  | "qualify"
  | "research"
  | "audit"
  | "opportunities"
  | "outreach"
  | "reply"
  | "proposal"
  | "websiteSpec";

const ACTIONS: { id: Action; label: string; icon: typeof Search }[] = [
  { id: "qualify", label: "Qualify", icon: Search },
  { id: "research", label: "Research", icon: Search },
  { id: "audit", label: "Audit", icon: FlaskConical },
  { id: "opportunities", label: "Opportunities", icon: Lightbulb },
  { id: "outreach", label: "Draft Outreach", icon: Mail },
  { id: "reply", label: "Analyze Reply", icon: Reply },
  { id: "proposal", label: "Proposal", icon: FileText },
  { id: "websiteSpec", label: "Website Spec", icon: Globe },
];

const CHANNELS = [
  { id: "cold_email", label: "Cold email" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "follow_up", label: "Follow-up" },
  { id: "proposal_intro", label: "Proposal intro" },
];

export default function WorkAssistantView() {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [niche, setNiche] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [channel, setChannel] = useState("cold_email");
  const [replyText, setReplyText] = useState("");
  const [proposalTitle, setProposalTitle] = useState("");
  const [leadId, setLeadId] = useState("");
  const [requirements, setRequirements] = useState("");

  const [output, setOutput] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [approved, setApproved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [next, setNext] = useState<{
    recommendations: { action: string; reason: string }[];
    incomeTotal: number;
    activeClients: number;
    activeProjects: number;
  } | null>(null);

  const assistant = useServerFn(workAssistant);
  const saveOutreach = useServerFn(workSaveOutreach);
  const saveProposal = useServerFn(workSaveProposal);
  const saveResearch = useServerFn(workSaveResearch);
  const nextActions = useServerFn(workNextActions);

  const run = async (action: Action) => {
    setPending(true);
    setOutput(null);
    setApproved(false);
    setSavedId(null);
    setSaved(null);
    try {
      const res = await assistant({
        data: {
          action,
          lead: { name, website, niche, source_platform: source, raw_notes: notes },
          research: { name, website, publicInfo: notes },
          channel: channel as never,
          replyText,
          requirements,
          researchSummary: output ?? undefined,
        },
      });
      setOutput(res);
    } catch (err) {
      setOutput(`⚠️ ${mapAuthError(err)}`);
    } finally {
      setPending(false);
    }
  };

  const loadNext = async () => {
    try {
      const res = await nextActions({ data: {} });
      setNext(res as never);
    } catch (err) {
      setNext(null);
    }
  };

  const saveResearchDraft = async () => {
    if (!leadId.trim()) {
      toast.error("Add a Lead ID first to save research.");
      return;
    }
    try {
      await saveResearch({ data: { leadId: leadId.trim(), summary: output ?? undefined } });
      toast.success("Research saved for this lead.");
    } catch (err) {
      toast.error(mapAuthError(err));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-forest">Work AI Assistant</h2>
        <p className="text-sm text-muted-foreground">
          Research, qualify, audit, and draft — all drafts need your approval before any send. No
          messages are sent automatically.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-forest text-lg flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-gold" /> Lead context
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-forest">Business / lead name</Label>
            <Input
              className="border-border"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-forest">Website</Label>
            <Input
              className="border-border"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-forest">Niche / industry</Label>
            <Input
              className="border-border"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-forest">Source platform</Label>
            <Input
              className="border-border"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-forest">Notes / public info</Label>
            <Textarea
              className="border-border"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-forest">Lead ID (optional — needed to save research)</Label>
            <Input
              className="border-border"
              placeholder="Lead UUID from your leads table"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Button
              key={a.id}
              variant="outline"
              className="border-gold text-forest"
              disabled={pending}
              onClick={() => run(a.id)}
            >
              <Icon className="mr-2 h-4 w-4" /> {a.label}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-forest">Outreach channel</Label>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="border-border w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {output && (
        <Card className="border-border">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-muted text-forest">
                Draft
              </Badge>
              {approved && (
                <Badge variant="outline" className="text-forest border-forest/40">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Approved (not sent)
                </Badge>
              )}
              {!approved && (
                <Badge variant="outline" className="text-gold border-gold/40">
                  <ShieldAlert className="mr-1 h-3 w-3" /> Needs approval
                </Badge>
              )}
            </div>
            <div className="text-sm whitespace-pre-wrap">{output}</div>

            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-forest">Proposal title</Label>
                <Input
                  className="border-border"
                  placeholder="e.g. Growth plan for Acme"
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-forest text-ivory hover:bg-forest/90"
                  disabled={approved || !output}
                  onClick={async () => {
                    try {
                      let id = savedId;
                      if (!id) {
                        const res = await saveOutreach({
                          data: {
                            leadName: name || "Lead",
                            message: output,
                            channel: channel as never,
                            niche: niche || undefined,
                          },
                        });
                        id = res.id;
                        setSavedId(id);
                      }
                      const { error } = await supabase
                        .from("outreach")
                        .update({ approved: true } as never)
                        .eq("id", id);
                      if (error) throw error;
                      setApproved(true);
                      toast.success("Draft approved — not sent.");
                    } catch (err) {
                      toast.error(mapAuthError(err));
                    }
                  }}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                </Button>
                <Button
                  variant="outline"
                  className="border-gold text-forest"
                  disabled={pending}
                  onClick={async () => {
                    try {
                      const res = await saveOutreach({
                        data: {
                          leadName: name || "Lead",
                          message: output,
                          channel: channel as never,
                          niche: niche || undefined,
                        },
                      });
                      setSavedId(res.id);
                      setSaved("Outreach draft saved (awaiting approval).");
                    } catch (err) {
                      setSaved(`⚠️ ${mapAuthError(err)}`);
                    }
                  }}
                >
                  Save draft
                </Button>
                <Button
                  variant="outline"
                  className="border-gold text-forest"
                  disabled={pending}
                  onClick={async () => {
                    try {
                      await saveProposal({
                        data: {
                          title: proposalTitle || name || "Proposal",
                          body: output,
                        },
                      });
                      setSaved("Proposal saved as Draft.");
                    } catch (err) {
                      setSaved(`⚠️ ${mapAuthError(err)}`);
                    }
                  }}
                >
                  Save as proposal
                </Button>
                <Button
                  variant="outline"
                  className="border-gold text-forest"
                  disabled={pending || !output || !leadId.trim()}
                  onClick={saveResearchDraft}
                  title={!leadId.trim() ? "Add a Lead ID first to save research" : undefined}
                >
                  Save research
                </Button>
              </div>
              {!leadId.trim() && (
                <p className="text-[11px] text-[var(--gold)]">
                  Add a Lead ID above to enable "Save research".
                </p>
              )}
            </div>
            {saved && <p className="text-xs text-muted-foreground">{saved}</p>}
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-forest text-lg flex items-center gap-2">
            <Reply className="h-4 w-4 text-gold" /> Analyze a reply
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            className="border-border"
            placeholder="Paste a prospect's reply to classify it and draft a response…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <Button
            className="bg-gold text-ivory hover:bg-gold/90"
            disabled={pending || !replyText.trim()}
            onClick={() => run("reply")}
          >
            Analyze reply
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-forest text-lg flex items-center gap-2">
            <Globe className="h-4 w-4 text-gold" /> Website specification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            className="border-border"
            placeholder="Client requirements for an AI-generated website specification…"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
          />
          <Button
            className="bg-forest text-ivory hover:bg-forest/90"
            disabled={pending || !requirements.trim()}
            onClick={() => run("websiteSpec")}
          >
            Generate specification
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-forest text-lg flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-gold" /> Next actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="border-gold text-forest" onClick={loadNext}>
            Load recommendations
          </Button>
          {next && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Active clients: {next.activeClients} · Active projects: {next.activeProjects} ·
                Income: {next.incomeTotal}
              </p>
              {next.recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No urgent actions. Nice.</p>
              ) : (
                next.recommendations.map((r, i) => (
                  <div key={i} className="rounded-md border border-border bg-muted/40 p-2 text-sm">
                    <Badge variant="secondary" className="bg-forest/10 text-forest mr-2">
                      {r.action}
                    </Badge>
                    {r.reason}
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
