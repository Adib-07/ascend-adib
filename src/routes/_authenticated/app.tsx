import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import DailyTasks from "@/components/ascend/DailyTasks";
import LearningHub from "@/components/ascend/LearningHub";
import HabitsView from "@/components/ascend/HabitsView";
import GoalsView from "@/components/ascend/GoalsView";
import ClientsView from "@/components/ascend/ClientsView";
import WorkProjectsView from "@/components/ascend/WorkProjectsView";
import IncomeView from "@/components/ascend/IncomeView";
import PipelineView from "@/components/ascend/PipelineView";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Ascend" }] }),
  component: AppShell,
});

type Mode = "student" | "work";
const STUDENT_TABS = ["Daily Tasks", "Learning Hub", "Habits", "Goals"] as const;
const WORK_TABS = ["Clients", "Projects", "Income", "Pipeline"] as const;

function AppShell() {
  const [mode, setMode] = useState<Mode>("student");
  const [tab, setTab] = useState<string>(STUDENT_TABS[0]);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const tabs = mode === "student" ? STUDENT_TABS : WORK_TABS;

  function switchMode(m: Mode) {
    setMode(m);
    setTab(m === "student" ? STUDENT_TABS[0] : WORK_TABS[0]);
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-[var(--card)]">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-serif text-2xl md:text-3xl text-primary leading-none">Ascend</p>
            <p className="hidden md:block text-[11px] tracking-[0.2em] uppercase text-muted-foreground mt-1">
              Studio · Private
            </p>
          </div>

          <ModeToggle mode={mode} onChange={switchMode} />

          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-primary">
            <LogOut className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Sign out</span>
          </Button>
        </div>

        {/* Secondary tabs */}
        <div className="mx-auto max-w-7xl px-2 md:px-8 overflow-x-auto">
          <nav className="flex gap-1 md:gap-2 py-2">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm whitespace-nowrap transition-colors font-medium",
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-primary hover:bg-secondary"
                )}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 md:px-8 py-6 md:py-10">
        <div className="animate-in fade-in duration-300" key={`${mode}-${tab}`}>
          {mode === "student" && tab === "Daily Tasks" && <DailyTasks />}
          {mode === "student" && tab === "Learning Hub" && <LearningHub />}
          {mode === "student" && tab === "Habits" && <HabitsView />}
          {mode === "student" && tab === "Goals" && <GoalsView />}
          {mode === "work" && tab === "Clients" && <ClientsView />}
          {mode === "work" && tab === "Projects" && <WorkProjectsView />}
          {mode === "work" && tab === "Income" && <IncomeView />}
          {mode === "work" && tab === "Pipeline" && <PipelineView />}
        </div>
      </main>
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
            "px-3 md:px-5 py-1.5 text-xs md:text-sm rounded-full transition-all font-medium",
            mode === m
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-primary"
          )}
        >
          {m === "student" ? "Student" : "Work"}<span className="hidden md:inline"> Mode</span>
        </button>
      ))}
    </div>
  );
}
