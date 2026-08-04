import { useEffect, useState } from "react";
import { useOutreach, type Outreach } from "@/lib/ascend-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { SectionHeader, EmptyState, Card, formatMoney, formatDate } from "./ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STAGES = ["Lead", "Proposal Sent", "Active", "Won", "Lost"] as const;
type Stage = (typeof STAGES)[number];

const LOG_STATUSES = ["Sent", "Replied", "Meeting", "Won", "Lost"] as const;
const MESSAGE_TYPES = ["Cold DM", "Proposal", "Follow-up", "Email", "Call"] as const;
const PLATFORMS = ["LinkedIn", "Email", "X/Twitter", "Instagram", "Referral", "Upwork", "Other"] as const;

const today = () => new Date().toISOString().slice(0, 10);

type Service = { id: string; name: string; starter: number; standard: number; premium: number; delivery: string };
const DEFAULT_SERVICES: Service[] = [
  { id: "1", name: "Notion OS Setup", starter: 3000, standard: 5000, premium: 8000, delivery: "2–3 days" },
  { id: "2", name: "AI Automation Setup", starter: 5000, standard: 10000, premium: 15000, delivery: "3–5 days" },
  { id: "3", name: "Python Script", starter: 2000, standard: 5000, premium: 10000, delivery: "1–3 days" },
  { id: "4", name: "AI Chatbot", starter: 8000, standard: 15000, premium: 25000, delivery: "5–7 days" },
  { id: "5", name: "Prompt Engineering", starter: 1500, standard: 3000, premium: 5000, delivery: "1 day" },
];

function platformChip(p?: string | null) {
  if (!p) return "bg-secondary text-muted-foreground";
  const map: Record<string, string> = {
    LinkedIn: "bg-blue-500/15 text-blue-700",
    Email: "bg-[var(--forest)]/15 text-[var(--forest)]",
    "X/Twitter": "bg-secondary text-primary",
    Instagram: "bg-pink-500/15 text-pink-700",
    Referral: "bg-[var(--gold)]/15 text-[var(--gold)]",
    Upwork: "bg-emerald-500/15 text-emerald-700",
  };
  return map[p] ?? "bg-secondary text-muted-foreground";
}
function logStatusChip(s?: string | null) {
  const map: Record<string, string> = {
    Sent: "bg-blue-500/15 text-blue-700",
    Replied: "bg-[var(--gold)]/15 text-[var(--gold)]",
    Meeting: "bg-[var(--forest)]/15 text-[var(--forest)]",
    Won: "bg-emerald-500/15 text-emerald-700",
    Lost: "bg-[var(--destructive)]/10 text-[var(--destructive)]",
  };
  return map[s ?? ""] ?? "bg-secondary text-muted-foreground";
}

export default function PipelineView() {
  const outreach = useOutreach();
  const all = outreach.list.data ?? [];

  // Kanban leads = outreach where status is one of pipeline STAGES
  const leads = all.filter((o) => (STAGES as readonly string[]).includes(o.status ?? ""));
  // Log = outreach where status is one of LOG_STATUSES
  const logs = all.filter((o) => (LOG_STATUSES as readonly string[]).includes(o.status ?? ""));

  // Lead dialog
  const [leadOpen, setLeadOpen] = useState(false);
  const [editLead, setEditLead] = useState<Outreach | null>(null);
  const [leadDraft, setLeadDraft] = useState({ lead_name: "", platform: "LinkedIn", status: "Lead" as string, outreach_date: today(), niche: "", expected_value: "", notes: "" });

  function openNewLead(stage: Stage = "Lead") {
    setEditLead(null);
    setLeadDraft({ lead_name: "", platform: "LinkedIn", status: stage, outreach_date: today(), niche: "", expected_value: "", notes: "" });
    setLeadOpen(true);
  }
  function openEditLead(o: Outreach) {
    setEditLead(o);
    setLeadDraft({
      lead_name: o.lead_name,
      platform: o.platform ?? "LinkedIn",
      status: o.status ?? "Lead",
      outreach_date: o.outreach_date,
      niche: o.niche ?? "",
      expected_value: o.expected_value != null ? String(o.expected_value) : "",
      notes: o.notes ?? "",
    });
    setLeadOpen(true);
  }
  async function saveLead() {
    if (!leadDraft.lead_name.trim()) { toast.error("Name required"); return; }
    const payload = {
      lead_name: leadDraft.lead_name,
      platform: leadDraft.platform,
      status: leadDraft.status,
      outreach_date: leadDraft.outreach_date,
      niche: leadDraft.niche || null,
      expected_value: leadDraft.expected_value ? Number(leadDraft.expected_value) : 0,
      notes: leadDraft.notes || null,
    };
    try {
      if (editLead) await outreach.update.mutateAsync({ id: editLead.id, ...payload });
      else await outreach.create.mutateAsync(payload);
      setLeadOpen(false);
      toast.success(editLead ? "Lead updated" : "Lead added");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  function moveTo(id: string, status: string) {
    outreach.update.mutate({ id, status });
  }

  // Outreach log dialog
  const [logOpen, setLogOpen] = useState(false);
  const [editLog, setEditLog] = useState<Outreach | null>(null);
  const [logDraft, setLogDraft] = useState({ lead_name: "", platform: "LinkedIn", status: "Sent" as string, outreach_date: today() });
  // Extra client-only fields (not persisted — placeholder UI only)
  const [logExtras, setLogExtras] = useState({ message_type: "Cold DM", outcome: "" });

  function openNewLog() {
    setEditLog(null);
    setLogDraft({ lead_name: "", platform: "LinkedIn", status: "Sent", outreach_date: today() });
    setLogExtras({ message_type: "Cold DM", outcome: "" });
    setLogOpen(true);
  }
  function openEditLog(o: Outreach) {
    setEditLog(o);
    setLogDraft({ lead_name: o.lead_name, platform: o.platform ?? "LinkedIn", status: o.status ?? "Sent", outreach_date: o.outreach_date });
    setLogExtras({ message_type: "Cold DM", outcome: "" });
    setLogOpen(true);
  }
  async function saveLog() {
    if (!logDraft.lead_name.trim()) { toast.error("Lead name required"); return; }
    try {
      if (editLog) await outreach.update.mutateAsync({ id: editLog.id, ...logDraft });
      else await outreach.create.mutateAsync(logDraft);
      setLogOpen(false);
      toast.success(editLog ? "Outreach updated" : "Outreach logged");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  // Services (localStorage)
  const [services, setServices] = useState<Service[]>(() => {
    if (typeof window === "undefined") return DEFAULT_SERVICES;
    const stored = localStorage.getItem("ascend_services_v1");
    return stored ? (JSON.parse(stored) as Service[]) : DEFAULT_SERVICES;
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("ascend_services_v1", JSON.stringify(services));
  }, [services]);

  const [srvOpen, setSrvOpen] = useState(false);
  const [editSrv, setEditSrv] = useState<Service | null>(null);
  const [srvDraft, setSrvDraft] = useState<Service>({ id: "", name: "", starter: 0, standard: 0, premium: 0, delivery: "" });

  function openNewSrv() {
    setEditSrv(null);
    setSrvDraft({ id: crypto.randomUUID(), name: "", starter: 0, standard: 0, premium: 0, delivery: "" });
    setSrvOpen(true);
  }
  function openEditSrv(s: Service) { setEditSrv(s); setSrvDraft(s); setSrvOpen(true); }
  function saveSrv() {
    if (!srvDraft.name.trim()) { toast.error("Name required"); return; }
    setServices((prev) => (editSrv ? prev.map((p) => (p.id === srvDraft.id ? srvDraft : p)) : [...prev, srvDraft]));
    setSrvOpen(false);
    toast.success(editSrv ? "Service updated" : "Service added");
  }
  function delSrv(id: string) {
    setServices((prev) => prev.filter((p) => p.id !== id));
    toast.success("Service deleted");
  }

  return (
    <div className="space-y-10">
      {/* SECTION 1: Sales Pipeline */}
      <div className="space-y-4">
        <SectionHeader
          kicker="Pipeline"
          title="Sales Pipeline"
          subtitle="Conversations that may become contracts."
          right={<Button size="sm" onClick={() => openNewLead("Lead")}><Plus className="h-4 w-4 mr-1" />Add Lead</Button>}
        />

        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-2 px-2">
          {STAGES.map((stage) => {
            const items = leads.filter((l) => (l.status ?? "Lead") === stage);
            return (
              <div key={stage} className="min-w-[220px] snap-start flex-shrink-0 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">{stage}</p>
                    <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 rounded-full">{items.length}</span>
                  </div>
                  <button
                    onClick={() => openNewLead(stage)}
                    className="text-muted-foreground hover:text-primary active:scale-95 transition-all"
                    aria-label={`Add ${stage}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-2 min-h-[80px] bg-secondary/20 rounded-xl p-2">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic text-center py-3">—</p>
                  ) : (
                    items.map((l) => (
                      <div key={l.id} className="bg-[var(--card)] rounded-lg p-3 ring-1 ring-border/50 space-y-1.5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-serif text-sm font-medium text-primary min-w-0 truncate">{l.lead_name}</p>
                          <div className="flex opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openEditLead(l)}><Pencil className="h-2.5 w-2.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => outreach.remove.mutate(l.id)}><Trash2 className="h-2.5 w-2.5" /></Button>
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {l.platform && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", platformChip(l.platform))}>{l.platform}</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{formatDate(l.outreach_date)}</p>
                        <Select value={l.status ?? "Lead"} onValueChange={(v) => moveTo(l.id, v)}>
                          <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: Services & Pricing */}
      <div className="space-y-4">
        <SectionHeader
          kicker="Offerings"
          title="Services & Pricing"
          subtitle="Three tiers. Clear promises."
          right={<Button size="sm" variant="outline" onClick={openNewSrv}><Plus className="h-4 w-4 mr-1" />Add Service</Button>}
        />

        {services.length === 0 ? (
          <EmptyState
            title="No services defined yet"
            hint="Codify what you sell."
            action={<Button size="sm" onClick={openNewSrv}><Plus className="h-4 w-4 mr-1" />Add Service</Button>}
          />
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-normal">Service</th>
                    <th className="text-right px-3 py-2 font-normal">Starter</th>
                    <th className="text-right px-3 py-2 font-normal">Standard</th>
                    <th className="text-right px-3 py-2 font-normal">Premium</th>
                    <th className="text-left px-3 py-2 font-normal">Delivery</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {services.map((s, i) => (
                    <tr key={s.id} className={cn("group border-t border-border/40 transition-colors", i % 2 === 1 && "bg-secondary/20")}>
                      <td className="px-3 py-2 font-medium text-primary">{s.name}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(s.starter)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap text-[var(--forest)]">{formatMoney(s.standard)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap text-[var(--gold)] font-medium">{formatMoney(s.premium)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.delivery}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSrv(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => delSrv(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* SECTION 3: Outreach Log */}
      <div className="space-y-4">
        <SectionHeader
          kicker="Correspondence"
          title="Outreach Log"
          subtitle="Every cold message. Patterns emerge."
          right={<Button size="sm" variant="outline" onClick={openNewLog}><Plus className="h-4 w-4 mr-1" />Log Outreach</Button>}
        />

        {logs.length === 0 ? (
          <EmptyState
            title="No outreach logged yet"
            hint="Start tracking your leads here."
            action={<Button size="sm" onClick={openNewLog}><Plus className="h-4 w-4 mr-1" />Log Outreach</Button>}
          />
        ) : (
          <>
            {/* Desktop table */}
            <Card className="p-0 overflow-hidden hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-normal">Date</th>
                      <th className="text-left px-3 py-2 font-normal">Platform</th>
                      <th className="text-left px-3 py-2 font-normal">Lead</th>
                      <th className="text-left px-3 py-2 font-normal">Status</th>
                      <th className="w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((o) => (
                      <tr key={o.id} className="group border-t border-border/40 hover:bg-secondary/30 transition-colors">
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(o.outreach_date)}</td>
                        <td className="px-3 py-2">
                          {o.platform && <span className={cn("text-[10px] px-2 py-0.5 rounded-full", platformChip(o.platform))}>{o.platform}</span>}
                        </td>
                        <td className="px-3 py-2">{o.lead_name}</td>
                        <td className="px-3 py-2">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", logStatusChip(o.status))}>{o.status}</span>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLog(o)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => outreach.remove.mutate(o.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {logs.map((o) => (
                <Card key={o.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-primary truncate">{o.lead_name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {o.platform && <span className={cn("text-[10px] px-2 py-0.5 rounded-full", platformChip(o.platform))}>{o.platform}</span>}
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", logStatusChip(o.status))}>{o.status}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(o.outreach_date)}</span>
                      </div>
                    </div>
                    <div className="flex">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditLog(o)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => outreach.remove.mutate(o.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Lead dialog */}
      <Dialog open={leadOpen} onOpenChange={setLeadOpen}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">{editLead ? "Edit lead" : "New lead"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={leadDraft.lead_name} onChange={(e) => setLeadDraft({ ...leadDraft, lead_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Platform</Label>
                <Select value={leadDraft.platform} onValueChange={(v) => setLeadDraft({ ...leadDraft, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stage</Label>
                <Select value={leadDraft.status} onValueChange={(v) => setLeadDraft({ ...leadDraft, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Niche</Label><Input value={leadDraft.niche} onChange={(e) => setLeadDraft({ ...leadDraft, niche: e.target.value })} placeholder="SaaS, agency…" /></div>
              <div><Label>Expected Value ₹</Label><Input type="number" min="0" value={leadDraft.expected_value} onChange={(e) => setLeadDraft({ ...leadDraft, expected_value: e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label><Textarea rows={3} value={leadDraft.notes} onChange={(e) => setLeadDraft({ ...leadDraft, notes: e.target.value })} /></div>
            <div><Label>Date</Label><Input type="date" value={leadDraft.outreach_date} onChange={(e) => setLeadDraft({ ...leadDraft, outreach_date: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={saveLead}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outreach log dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">{editLog ? "Edit outreach" : "Log outreach"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={logDraft.outreach_date} onChange={(e) => setLogDraft({ ...logDraft, outreach_date: e.target.value })} /></div>
              <div>
                <Label>Platform</Label>
                <Select value={logDraft.platform} onValueChange={(v) => setLogDraft({ ...logDraft, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Lead name</Label><Input value={logDraft.lead_name} onChange={(e) => setLogDraft({ ...logDraft, lead_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Message type</Label>
                <Select value={logExtras.message_type} onValueChange={(v) => setLogExtras({ ...logExtras, message_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MESSAGE_TYPES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={logDraft.status} onValueChange={(v) => setLogDraft({ ...logDraft, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LOG_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Outcome</Label><Textarea value={logExtras.outcome} onChange={(e) => setLogExtras({ ...logExtras, outcome: e.target.value })} rows={3} placeholder="Notes on how it went…" /></div>
          </div>
          <DialogFooter><Button onClick={saveLog}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service dialog */}
      <Dialog open={srvOpen} onOpenChange={setSrvOpen}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">{editSrv ? "Edit service" : "New service"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Service name</Label><Input value={srvDraft.name} onChange={(e) => setSrvDraft({ ...srvDraft, name: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Starter ₹</Label><Input type="number" min={0} value={srvDraft.starter} onChange={(e) => setSrvDraft({ ...srvDraft, starter: Number(e.target.value) })} /></div>
              <div><Label>Standard ₹</Label><Input type="number" min={0} value={srvDraft.standard} onChange={(e) => setSrvDraft({ ...srvDraft, standard: Number(e.target.value) })} /></div>
              <div><Label>Premium ₹</Label><Input type="number" min={0} value={srvDraft.premium} onChange={(e) => setSrvDraft({ ...srvDraft, premium: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Delivery time</Label><Input value={srvDraft.delivery} onChange={(e) => setSrvDraft({ ...srvDraft, delivery: e.target.value })} placeholder="2–3 days" /></div>
          </div>
          <DialogFooter><Button onClick={saveSrv}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
