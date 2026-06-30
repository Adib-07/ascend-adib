import { useState } from "react";
import { useClients, useServices, useOutreach, type Client, type Service, type Outreach } from "@/lib/ascend-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { SectionHeader, EmptyState, Card } from "./ui-bits";
import { toast } from "sonner";

const STAGES = ["Lead", "Proposal Sent", "Active", "Won", "Lost"] as const;
const today = () => new Date().toISOString().slice(0, 10);

export default function PipelineView() {
  const clients = useClients();
  const services = useServices();
  const outreach = useOutreach();

  const [openLead, setOpenLead] = useState(false);
  const [editLead, setEditLead] = useState<Client | null>(null);
  const [leadDraft, setLeadDraft] = useState({ name: "", platform: "", status: "Lead", contact: "" });

  const [openSrv, setOpenSrv] = useState(false);
  const [editSrv, setEditSrv] = useState<Service | null>(null);
  const [srvDraft, setSrvDraft] = useState({ name: "", price_range: "", delivery_time: "" });

  const [openOut, setOpenOut] = useState(false);
  const [editOut, setEditOut] = useState<Outreach | null>(null);
  const [outDraft, setOutDraft] = useState({ lead_name: "", platform: "", status: "Sent", outreach_date: today() });

  const leads = clients.list.data ?? [];
  function openNewLead() { setEditLead(null); setLeadDraft({ name: "", platform: "", status: "Lead", contact: "" }); setOpenLead(true); }
  function openEditLead(c: Client) { setEditLead(c); setLeadDraft({ name: c.name, platform: c.platform ?? "", status: c.status ?? "Lead", contact: c.contact ?? "" }); setOpenLead(true); }
  async function saveLead() {
    if (!leadDraft.name.trim()) { toast.error("Name required"); return; }
    try {
      if (editLead) await clients.update.mutateAsync({ id: editLead.id, ...leadDraft });
      else await clients.create.mutateAsync(leadDraft);
      setOpenLead(false); toast.success("Saved");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  function openNewSrv() { setEditSrv(null); setSrvDraft({ name: "", price_range: "", delivery_time: "" }); setOpenSrv(true); }
  function openEditSrv(s: Service) { setEditSrv(s); setSrvDraft({ name: s.name, price_range: s.price_range ?? "", delivery_time: s.delivery_time ?? "" }); setOpenSrv(true); }
  async function saveSrv() {
    if (!srvDraft.name.trim()) { toast.error("Name required"); return; }
    try {
      if (editSrv) await services.update.mutateAsync({ id: editSrv.id, ...srvDraft });
      else await services.create.mutateAsync(srvDraft);
      setOpenSrv(false); toast.success("Saved");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  function openNewOut() { setEditOut(null); setOutDraft({ lead_name: "", platform: "", status: "Sent", outreach_date: today() }); setOpenOut(true); }
  function openEditOut(o: Outreach) { setEditOut(o); setOutDraft({ lead_name: o.lead_name, platform: o.platform ?? "", status: o.status ?? "Sent", outreach_date: o.outreach_date }); setOpenOut(true); }
  async function saveOut() {
    if (!outDraft.lead_name.trim()) { toast.error("Lead name required"); return; }
    try {
      if (editOut) await outreach.update.mutateAsync({ id: editOut.id, ...outDraft });
      else await outreach.create.mutateAsync(outDraft);
      setOpenOut(false); toast.success("Saved");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="space-y-8">
      <SectionHeader kicker="Pipeline" title="The Antechamber of Work"
        subtitle="Conversations that may become contracts."
        right={<Button size="sm" onClick={openNewLead}><Plus className="h-4 w-4 mr-1" />Add lead</Button>} />

      <div className="grid lg:grid-cols-5 md:grid-cols-2 gap-3">
        {STAGES.map(stage => {
          const items = leads.filter(c => (c.status ?? "Lead") === stage);
          return (
            <div key={stage} className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">{stage}</p>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {items.length === 0 ? <p className="text-xs text-muted-foreground italic">—</p> : items.map(l => (
                  <Card key={l.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-primary text-sm truncate">{l.name}</p>
                        <p className="text-[10px] text-muted-foreground">{l.platform || "—"}</p>
                      </div>
                    </div>
                    {l.contact && <p className="text-[10px] text-muted-foreground mt-1 truncate">{l.contact}</p>}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                      <Select value={l.status ?? "Lead"} onValueChange={v => clients.update.mutate({ id: l.id, status: v })}>
                        <SelectTrigger className="h-6 text-[10px] w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openEditLead(l)}><Pencil className="h-2.5 w-2.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => clients.remove.mutate(l.id)}><Trash2 className="h-2.5 w-2.5" /></Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Services & Pricing */}
      <div>
        <div className="flex justify-between items-end mb-3">
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">Offerings</p>
            <h3 className="font-serif text-2xl text-primary mt-1">Services & Pricing</h3>
          </div>
          <Button size="sm" variant="outline" onClick={openNewSrv}><Plus className="h-4 w-4 mr-1" />Add service</Button>
        </div>
        {(services.list.data ?? []).length === 0 ? <EmptyState title="No services defined." hint="Codify what you sell." /> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {services.list.data!.map(s => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-serif text-lg text-primary">{s.name}</p>
                    <p className="text-sm text-[var(--gold)] mt-1">{s.price_range || "—"}</p>
                    {s.delivery_time && <p className="text-xs text-muted-foreground mt-1">Delivery: {s.delivery_time}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSrv(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => services.remove.mutate(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Outreach log */}
      <div>
        <div className="flex justify-between items-end mb-3">
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">Correspondence</p>
            <h3 className="font-serif text-2xl text-primary mt-1">Outreach Log</h3>
          </div>
          <Button size="sm" variant="outline" onClick={openNewOut}><Plus className="h-4 w-4 mr-1" />Log outreach</Button>
        </div>
        {(outreach.list.data ?? []).length === 0 ? <EmptyState title="No outreach logged." hint="Track every cold message — patterns will emerge." /> : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-normal">Date</th>
                    <th className="text-left px-3 py-2 font-normal">Lead</th>
                    <th className="text-left px-3 py-2 font-normal">Platform</th>
                    <th className="text-left px-3 py-2 font-normal">Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {outreach.list.data!.map(o => (
                    <tr key={o.id} className="border-t border-border/40">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(o.outreach_date).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{o.lead_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{o.platform || "—"}</td>
                      <td className="px-3 py-2"><span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-border bg-secondary text-muted-foreground">{o.status}</span></td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditOut(o)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => outreach.remove.mutate(o.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Lead dialog */}
      <Dialog open={openLead} onOpenChange={setOpenLead}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">{editLead ? "Edit lead" : "New lead"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={leadDraft.name} onChange={e => setLeadDraft({ ...leadDraft, name: e.target.value })} /></div>
            <div><Label>Platform</Label><Input value={leadDraft.platform} onChange={e => setLeadDraft({ ...leadDraft, platform: e.target.value })} /></div>
            <div><Label>Stage</Label>
              <Select value={leadDraft.status} onValueChange={v => setLeadDraft({ ...leadDraft, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Contact</Label><Input value={leadDraft.contact} onChange={e => setLeadDraft({ ...leadDraft, contact: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={saveLead}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openSrv} onOpenChange={setOpenSrv}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">{editSrv ? "Edit service" : "New service"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={srvDraft.name} onChange={e => setSrvDraft({ ...srvDraft, name: e.target.value })} /></div>
            <div><Label>Price range</Label><Input value={srvDraft.price_range} onChange={e => setSrvDraft({ ...srvDraft, price_range: e.target.value })} placeholder="₹5k–₹15k" /></div>
            <div><Label>Delivery time</Label><Input value={srvDraft.delivery_time} onChange={e => setSrvDraft({ ...srvDraft, delivery_time: e.target.value })} placeholder="2 weeks" /></div>
          </div>
          <DialogFooter><Button onClick={saveSrv}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openOut} onOpenChange={setOpenOut}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">{editOut ? "Edit outreach" : "Log outreach"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Lead name</Label><Input value={outDraft.lead_name} onChange={e => setOutDraft({ ...outDraft, lead_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Platform</Label><Input value={outDraft.platform} onChange={e => setOutDraft({ ...outDraft, platform: e.target.value })} placeholder="LinkedIn, Email" /></div>
              <div><Label>Status</Label>
                <Select value={outDraft.status} onValueChange={v => setOutDraft({ ...outDraft, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["Sent", "Replied", "Booked", "No Reply"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Date</Label><Input type="date" value={outDraft.outreach_date} onChange={e => setOutDraft({ ...outDraft, outreach_date: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={saveOut}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
