import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOut, Search, Focus, ChevronDown, Command as CmdIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import DailyTasks from "@/components/ascend/DailyTasks";
import LearningHub from "@/components/ascend/LearningHub";
import HabitsView from "@/components/ascend/HabitsView";
import GoalsView from "@/components/ascend/GoalsView";
import ClientsView from "@/components/ascend/ClientsView";
import WorkProjectsView from "@/components/ascend/WorkProjectsView";
import IncomeView from "@/components/ascend/IncomeView";
import PipelineView from "@/components/ascend/PipelineView";
import CSETutorView from "@/components/ascend/CSETutorView";
import WorkDashboard from "@/components/ascend/WorkDashboard";
import CommandPalette from "@/components/ascend/CommandPalette";
import FocusMode from "@/components/ascend/FocusMode";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Ascend" }] }),
  component: AppShell,
});

type Mode = "student" | "work";
const STUDENT_TABS = ["Daily Tasks", "Learning Hub", "Habits", "Goals", "CSE Tutor"] as const;
const WORK_TABS = ["Overview", "Clients", "Projects", "Income", "Pipeline"] as const;

function AppShell() {
  const [mode, setMode] = useState<Mode>("student");
  const [tab, setTab] = useState<string>(STUDENT_TABS[0]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [email, setEmail] = useState<string>("");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const tabs = mode === "student" ? STUDENT_TABS : WORK_TABS;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  useEffect(() => {
    document.title = `${tab} — Ascend`;
  }, [tab]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function switchTo(m: Mode, t: string) {
    setMode(m);
    setTab(t);
  }
  function switchMode(m: Mode) {
    switchTo(m, m === "student" ? STUDENT_TABS[0] : WORK_TABS[0]);
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initial = (email?.[0] ?? "A").toUpperCase();

  const quickActions = useMemo(() => [
    { label: "New Task", hint: "Add a task to today", run: () => switchTo("student", "Daily Tasks") },
    { label: "New Learning Topic", hint: "Track a topic in Learn", run: () => switchTo("student", "Learning Hub") },
    { label: "New Habit", hint: "Add a daily habit", run: () => switchTo("student", "Habits") },
    { label: "New Client", hint: "Add to your roster", run: () => switchTo("work", "Clients") },
    { label: "Start Focus Session", hint: "Open Pomodoro timer", run: () => setFocusOpen(true) },
  ], []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur-sm bg-[var(--card)]/95">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:flex md:justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-serif text-2xl md:text-3xl text-primary leading-none">Ascend</p>
            <p className="hidden md:block text-[11px] tracking-[0.2em] uppercase text-muted-foreground mt-1">
              Studio · Private
            </p>
          </div>

          <div className="hidden md:block"><ModeToggle mode={mode} onChange={switchMode} /></div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-primary hover:border-[var(--gold)]/50 transition-colors"
              aria-label="Search"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search</span>
              <kbd className="text-[10px] font-mono inline-flex items-center gap-0.5"><CmdIcon className="h-3 w-3" />K</kbd>
            </button>
            <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setPaletteOpen(true)} aria-label="Search">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setFocusOpen(true)} aria-label="Focus mode" title="Focus mode">
              <Focus className="h-4 w-4" />
            </Button>

            <div className="relative">
              <button
                onClick={() => setAvatarOpen((o) => !o)}
                onBlur={() => setTimeout(() => setAvatarOpen(false), 150)}
                className="flex items-center gap-1 h-9 pl-1.5 pr-2 rounded-full hover:bg-secondary transition-colors"
                aria-label="Account menu"
              >
                <span className="h-7 w-7 rounded-full bg-[var(--forest)] text-[var(--gold)] font-serif text-sm inline-flex items-center justify-center">{initial}</span>
                <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", avatarOpen && "rotate-180")} />
              </button>
              {avatarOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg bg-[var(--card)] ring-1 ring-border shadow-[var(--shadow-lg)] py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-[10px] tracking-widest uppercase text-muted-foreground">Signed in as</p>
                    <p className="text-sm text-primary truncate">{email || "—"}</p>
                  </div>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); signOut().catch(() => toast.error("Sign out failed")); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary text-left"
                  >
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="md:hidden mx-auto max-w-7xl px-4 pb-3">
          <ModeToggle mode={mode} onChange={switchMode} />
        </div>

        <div className="mx-auto max-w-7xl px-2 md:px-8 overflow-x-auto border-t border-border/40">
          <nav className="flex gap-1 md:gap-4">
            {tabs.map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "px-3 py-3 text-sm whitespace-nowrap transition-colors relative font-medium min-h-[44px]",
                    active ? "text-primary" : "text-muted-foreground hover:text-primary",
                  )}
                >
                  {t}
                  <span className={cn(
                    "absolute left-2 right-2 -bottom-px h-0.5 rounded-full transition-all",
                    active ? "bg-[var(--gold)] opacity-100" : "opacity-0"
                  )} />
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main role="main" className="mx-auto max-w-7xl px-4 md:px-8 py-6 md:py-10">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" key={`${mode}-${tab}`}>
          {mode === "student" && tab === "Daily Tasks" && <DailyTasks />}
          {mode === "student" && tab === "Learning Hub" && <LearningHub />}
          {mode === "student" && tab === "Habits" && <HabitsView />}
          {mode === "student" && tab === "Goals" && <GoalsView />}
          {mode === "student" && tab === "CSE Tutor" && <CSETutorView />}
          {mode === "work" && tab === "Overview" && <WorkDashboard />}
          {mode === "work" && tab === "Clients" && <ClientsView />}
          {mode === "work" && tab === "Projects" && <WorkProjectsView />}
          {mode === "work" && tab === "Income" && <IncomeView />}
          {mode === "work" && tab === "Pipeline" && <PipelineView />}
        </div>
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={switchTo}
        quickActions={quickActions}
      />
      <FocusMode open={focusOpen} onClose={() => setFocusOpen(false)} />
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="inline-flex rounded-full border border-border bg-secondary p-1">
      {(["student", "work"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            "px-4 py-1.5 text-xs md:text-sm rounded-full transition-all font-medium min-w-[76px]",
            mode === m
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-primary"
          )}
        >
          {m === "student" ? "Student" : "Work"}
        </button>
      ))}
    </div>
  );
}
