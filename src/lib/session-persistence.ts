import { supabase } from "@/integrations/supabase/client";

const LOCAL_SESSION_KEY = "cse_tutor_session";

export interface LocalSession {
  sessionId: string;
  messages: LocalMessage[];
  lastSynced: number;
}

export interface LocalMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  sources?: any[];
  datasets?: any[];
  grounded?: boolean;
  syllabusMatch?: boolean | null;
  mode?: string;
}

export function saveSessionLocal(session: LocalSession): void {
  try {
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn("Failed to save session to localStorage:", e);
  }
}

export function loadSessionLocal(): LocalSession | null {
  try {
    const stored = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as LocalSession;
  } catch (e) {
    console.warn("Failed to load session from localStorage:", e);
    return null;
  }
}

export function clearSessionLocal(): void {
  try {
    localStorage.removeItem(LOCAL_SESSION_KEY);
  } catch (e) {
    console.warn("Failed to clear session from localStorage:", e);
  }
}

export function addMessageLocal(message: LocalMessage): void {
  const session = loadSessionLocal() || {
    sessionId: crypto.randomUUID(),
    messages: [],
    lastSynced: 0,
  };
  session.messages.push(message);
  saveSessionLocal(session);
}

export function getMessagesLocal(): LocalMessage[] {
  const session = loadSessionLocal();
  return session?.messages ?? [];
}

export function setSessionIdLocal(sessionId: string): void {
  const session = loadSessionLocal() || { sessionId, messages: [], lastSynced: 0 };
  session.sessionId = sessionId;
  saveSessionLocal(session);
}

// Type-safe access to new tables not yet in generated types
function getTutorSessionsTable() {
  return supabase.from("tutor_sessions") as ReturnType<typeof supabase.from> & {
    select: (cols?: string) => any;
    insert: (rows: any) => any;
    update: (rows: any) => any;
    delete: () => any;
    eq: (col: string, val: any) => any;
    maybeSingle: () => any;
    single: () => any;
    order: (col: string, opts?: any) => any;
    lte: (col: string, val: any) => any;
    gt: (col: string, val: any) => any;
    lt: (col: string, val: any) => any;
  };
}

function getTutorMessagesTable() {
  return supabase.from("tutor_messages") as ReturnType<typeof supabase.from> & {
    select: (cols?: string) => any;
    insert: (rows: any) => any;
    update: (rows: any) => any;
    delete: () => any;
    eq: (col: string, val: any) => any;
    maybeSingle: () => any;
    single: () => any;
    order: (col: string, opts?: any) => any;
    lte: (col: string, val: any) => any;
    gt: (col: string, val: any) => any;
    lt: (col: string, val: any) => any;
  };
}

export async function syncSessionToDB(userId: string): Promise<boolean> {
  const local = loadSessionLocal();
  if (!local || local.messages.length === 0) return false;

  try {
    // Check if session exists in DB
    const { data: existing } = await getTutorSessionsTable()
      .select("id")
      .eq("id", local.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      // Session exists - get DB messages and merge
      const { data: dbMessages } = await getTutorMessagesTable()
        .select("role, content, created_at")
        .eq("session_id", local.sessionId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      const dbMsgSet = new Set(
        (dbMessages ?? []).map((m: any) => `${m.role}:${m.content}:${m.created_at}`),
      );

      // Find local messages not in DB
      const newMessages = local.messages.filter(
        (lm) => !dbMsgSet.has(`${lm.role}:${lm.content}:${lm.timestamp}`),
      );

      if (newMessages.length > 0) {
        const inserts = newMessages.map((m) => ({
          session_id: local.sessionId,
          user_id: userId,
          role: m.role,
          content: m.content,
          sources: m.sources ?? null,
          datasets: m.datasets ?? null,
          grounded: m.grounded ?? null,
          syllabus_match: m.syllabusMatch ?? null,
          mode: m.mode ?? null,
        }));

        const { error } = await getTutorMessagesTable().insert(inserts);
        if (error) throw error;
      }

      // Update session timestamp
      await getTutorSessionsTable()
        .update({ updated_at: new Date().toISOString() })
        .eq("id", local.sessionId);
    } else {
      // New session - create it and all messages
      const { error: sessionError } = await getTutorSessionsTable().insert({
        id: local.sessionId,
        user_id: userId,
        mode: local.messages[0]?.mode ?? "CHAT",
        context_snapshot: { syncedFromLocal: true },
      });

      if (sessionError) throw sessionError;

      const inserts = local.messages.map((m) => ({
        session_id: local.sessionId,
        user_id: userId,
        role: m.role,
        content: m.content,
        sources: m.sources ?? null,
        datasets: m.datasets ?? null,
        grounded: m.grounded ?? null,
        syllabus_match: m.syllabusMatch ?? null,
        mode: m.mode ?? null,
      }));

      const { error } = await getTutorMessagesTable().insert(inserts);
      if (error) throw error;
    }

    // Update last synced timestamp
    local.lastSynced = Date.now();
    saveSessionLocal(local);
    return true;
  } catch (e) {
    console.error("Failed to sync session to DB:", e);
    return false;
  }
}

export async function loadSessionFromDB(
  userId: string,
  sessionId: string,
): Promise<LocalMessage[]> {
  try {
    const { data } = await getTutorMessagesTable()
      .select("role, content, sources, datasets, grounded, syllabus_match, mode, created_at")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (!data || data.length === 0) return [];

    return data.map((m: any) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      timestamp: new Date(m.created_at).getTime(),
      sources: m.sources ?? undefined,
      datasets: m.datasets ?? undefined,
      grounded: m.grounded ?? undefined,
      syllabusMatch: m.syllabus_match ?? undefined,
      mode: m.mode ?? undefined,
    }));
  } catch (e) {
    console.error("Failed to load session from DB:", e);
    return [];
  }
}

export async function initializeSession(
  userId: string,
): Promise<{ sessionId: string; messages: LocalMessage[] }> {
  const local = loadSessionLocal();

  if (local?.sessionId) {
    // Try to load from DB first (source of truth)
    const dbMessages = await loadSessionFromDB(userId, local.sessionId);

    if (dbMessages.length > 0) {
      // Merge: DB is source of truth, but local may have newer
      const merged = mergeMessages(dbMessages, local.messages);
      local.messages = merged;
      local.lastSynced = Date.now();
      saveSessionLocal(local);
      return { sessionId: local.sessionId, messages: merged };
    }

    // DB has no messages, but local does - will sync on first send
    return { sessionId: local.sessionId, messages: local.messages };
  }

  // No local session - create new
  const newSessionId = crypto.randomUUID();
  const newSession: LocalSession = {
    sessionId: newSessionId,
    messages: [],
    lastSynced: 0,
  };
  saveSessionLocal(newSession);
  return { sessionId: newSessionId, messages: [] };
}

function mergeMessages(dbMessages: LocalMessage[], localMessages: LocalMessage[]): LocalMessage[] {
  // DB is source of truth
  const dbSet = new Set(dbMessages.map((m) => `${m.role}:${m.content}:${m.timestamp}`));
  const merged = [...dbMessages];

  // Add local messages not in DB
  for (const lm of localMessages) {
    const key = `${lm.role}:${lm.content}:${lm.timestamp}`;
    if (!dbSet.has(key)) {
      merged.push(lm);
    }
  }

  // Sort by timestamp
  merged.sort((a, b) => a.timestamp - b.timestamp);
  return merged;
}

// Auto-sync on online
export function setupAutoSync(userId: string): () => void {
  const handleOnline = () => {
    if (navigator.onLine) {
      syncSessionToDB(userId);
    }
  };

  window.addEventListener("online", handleOnline);
  // Also sync periodically when online
  const interval = setInterval(() => {
    if (navigator.onLine) {
      syncSessionToDB(userId);
    }
  }, 30000); // Every 30 seconds

  return () => {
    window.removeEventListener("online", handleOnline);
    clearInterval(interval);
  };
}
