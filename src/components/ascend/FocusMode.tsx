import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, SkipForward, X } from "lucide-react";
import { todayISO, useTasks } from "@/lib/ascend-data";

type SessionType = "Deep Work" | "Short Break" | "Long Break";
type Session = { type: SessionType; date: string; duration: number };

const DURATIONS: Record<SessionType, number> = {
  "Deep Work": 25 * 60,
  "Short Break": 5 * 60,
  "Long Break": 15 * 60,
};

const SESSIONS_KEY = "ascend_focus_sessions";

export function getFocusSessions(): Session[] {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? "[]") as Session[];
  } catch { return []; }
}
function pushSession(s: Session) {
  try {
    const all = getFocusSessions();
    all.push(s);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
  } catch { /* noop */ }
}

function beep() {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine"; osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 1.4);
  } catch { /* noop */ }
}

export default function FocusMode({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<SessionType>("Deep Work");
  const [remaining, setRemaining] = useState(DURATIONS["Deep Work"]);
  const [running, setRunning] = useState(false);
  const [sessionNo, setSessionNo] = useState(1);
  const [customTask, setCustomTask] = useState("");
  const startedAtRef = useRef<number | null>(null);

  const tasksQ = useTasks();
  const firstMit = (tasksQ.data ?? []).find((t) => t.mit_slot && !t.done);
  const activeTaskLabel = customTask || firstMit?.title || "Deep work session";

  // Reset timer when session type changes
  useEffect(() => { setRemaining(DURATIONS[type]); setRunning(false); }, [type]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(id);
          onSessionEnd();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === " ") { e.preventDefault(); setRunning((r) => !r); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function onSessionEnd() {
    setRunning(false);
    beep();
    pushSession({ type, date: todayISO(), duration: DURATIONS[type] });
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("Ascend — Session complete", { body: `${type} finished. Take a breath.` });
    }
    // Rotate: after Deep Work, do a break
    if (type === "Deep Work") {
      const next: SessionType = sessionNo % 4 === 0 ? "Long Break" : "Short Break";
      setType(next);
    } else {
      setType("Deep Work");
      setSessionNo((n) => n + 1);
    }
  }

  function toggle() {
    if (!running && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    if (!running) startedAtRef.current = Date.now();
    setRunning((r) => !r);
  }

  function reset() { setRemaining(DURATIONS[type]); setRunning(false); }
  function skip() { setRemaining(0); onSessionEnd(); }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const pct = 1 - remaining / DURATIONS[type];
  const circ = 2 * Math.PI * 130;
  const dashOffset = circ * (1 - pct);

  const sessionCountToday = useMemo(
    () => getFocusSessions().filter((s) => s.date === todayISO() && s.type === "Deep Work").length,
    // Re-read after each end
    [running, remaining, sessionNo],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-[var(--ivory)] animate-in fade-in duration-200 overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-10">
        <button onClick={onClose} className="absolute top-6 right-6 text-muted-foreground hover:text-primary transition-colors" aria-label="Exit focus mode">
          <X className="h-6 w-6" />
        </button>

        <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)]">{type}</p>
        <p className="mt-1 text-xs text-muted-foreground">Session {sessionNo} of 4</p>

        <div className="relative mt-8">
          <svg width="300" height="300" viewBox="0 0 300 300" className="-rotate-90">
            <circle cx="150" cy="150" r="130" stroke="var(--linen)" strokeWidth="8" fill="none" />
            <circle
              cx="150" cy="150" r="130"
              stroke="var(--gold)" strokeWidth="8" fill="none"
              strokeDasharray={circ}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-serif text-6xl md:text-7xl text-primary tabular-nums">{mm}:{ss}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-2">remaining</p>
          </div>
        </div>

        <div className="mt-6 max-w-md text-center">
          <p className="text-[10px] tracking-widest uppercase text-muted-foreground">Now focusing on</p>
          <input
            value={customTask}
            onChange={(e) => setCustomTask(e.target.value)}
            placeholder={activeTaskLabel}
            className="mt-1 w-full text-center bg-transparent border-0 outline-none font-serif text-xl text-primary placeholder:text-primary/70"
          />
        </div>

        <div className="mt-8 flex items-center gap-3">
          <Button onClick={toggle} size="lg" className="min-w-[120px]">
            {running ? <><Pause className="h-4 w-4 mr-1" />Pause</> : <><Play className="h-4 w-4 mr-1" />Start</>}
          </Button>
          <Button variant="outline" onClick={reset} size="lg"><RotateCcw className="h-4 w-4 mr-1" />Reset</Button>
          <Button variant="ghost" onClick={skip} size="lg"><SkipForward className="h-4 w-4 mr-1" />Skip</Button>
        </div>

        <div className="mt-8 flex items-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={cn("h-2 w-2 rounded-full transition-colors", n <= sessionCountToday ? "bg-[var(--gold)]" : "bg-linen")} />
          ))}
          <span className="ml-3 text-xs text-muted-foreground">{sessionCountToday} deep sessions today</span>
        </div>

        <button onClick={onClose} className="mt-12 text-xs text-muted-foreground hover:text-primary underline underline-offset-4">
          Exit focus mode
        </button>
      </div>
    </div>
  );
}
