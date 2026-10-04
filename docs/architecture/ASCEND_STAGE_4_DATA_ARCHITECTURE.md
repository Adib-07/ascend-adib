# ASCEND — STAGE 4 DATA ARCHITECTURE

| Field                | Value                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Project              | Ascend — AI Journey productivity app (B.Tech CSE student + freelancer → AI Engineer)       |
| Repo branch          | `ascend-data-integration` (synced with `origin/main` at `b25f74c`)                         |
| Date of document     | 2026-08-21                                                                                 |
| Status               | Architecture proposal — **NO migrations created, no tables created, nothing implemented**  |
| Authoritative source | Actual repository (no prior Stage 1–3 docs were present; findings reconstructed from code) |

> **Accuracy note:** Stage 1–3 report files were **not present** in the repository or git history. All findings below were reconstructed by direct inspection of the codebase (`src/`), `supabase/migrations/`, `package.json`, `AGENTS.md`, and `supabase/config.toml`. Items that cannot be verified from the repository are explicitly marked **UNVERIFIED**. No dataset was selected in any prior stage, so all dataset-specific sections are marked **UNVERIFIED**.

---

## 1. Architecture Summary

Ascend is a TanStack Start (React 19) full-stack app backed by **Supabase** (PostgreSQL + Auth). All user data lives in 18 Supabase tables, each scoped to `auth.users` via a `user_id` column and protected by per-user Row-Level Security (RLS). AI features (CSE Tutor, English Coach, Life Skills) are implemented as **server functions** (`createServerFn` from `@tanstack/react-start`) that call the **Lovable AI Gateway** (`https://ai.gateway.lovable.dev/v1`) using the model `google/gemini-3-flash-preview`. Two of the three tutors (CSE Tutor, Life Skills) also persist curated **seed content in `localStorage`** on the client; English Coach is purely conversational via server functions.

The Stage 4 goal is to introduce (a) structured, user-owned extensions to the existing schema for richer learning/work tracking, (b) a **document/PDF ingestion + RAG** capability (currently absent), (c) **work-automation** (lead discovery → research → outreach → client → project → income) with human approval for external actions, and (d) optional **static curated-knowledge datasets**. Nothing here is implemented yet.

---

## 2. Existing Database Assessment

**Engine:** PostgreSQL via Supabase. 18 tables, all `public` schema.

**Common pattern (all 18 tables):** `id UUID PK DEFAULT gen_random_uuid()`, `user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE`, `created_at TIMESTAMPTZ DEFAULT now()`. Most have `updated_at` + a `set_updated_at()` trigger.

**Tables (EXISTING — do not drop/alter columns):**

1. `daily_intentions` — one intention text per (user, day).
2. `tasks` — daily tasks, priority, due_date, type, done, mit_slot, reminder_time.
3. `learn_topics` — study topics: skill category, status, progress %, difficulty, source, deadline.
4. `notes` — markdown notes with tag.
5. `coding_problems` — LeetCode/HackerRank practice.
6. `quiz_items` — Q/A pairs by topic.
7. `flashcard_decks` — decks by subject.
8. `flashcards` — front/back/known, FK → flashcard_decks (CASCADE).
9. `exams` — exam tracker, `syllabus JSONB`, prep_status.
10. `academic_projects` — academic/personal projects.
11. `habits` — name, category, streak, last_done.
12. `habit_logs` — per (habit, day) done log, FK → habits (CASCADE).
13. `goals` — scope (north_star/90_day/1_year), text, deadline, done. Partial unique index `goals_user_northstar_unique`.
14. `clients` — freelance clients: platform, status, revenue, rating, niche.
15. `work_projects` — kanban projects, FK → clients (SET NULL).
16. `finance_entries` — income/expense ledger.
17. `services` — service/pricing list (starter/standard/premium prices).
18. `outreach` — outreach log: platform, lead_name, status, expected_value, niche, notes, message_type, outcome.

**No:** storage buckets, views, enums, composite types, or DB functions beyond `set_updated_at()`. No pgvector/embeddings. `supabase/config.toml` contains only `project_id = "owjmmisthtfbcxloxasc"`.

---

## 3. Keep / Extend / Refactor / Replace Decisions

| Object                                       | Decision                                                                                                            | Rationale                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| All 18 existing tables                       | **KEEP** (additive only)                                                                                            | Working, RLS-protected, referenced by 30+ components. Never `DROP`/`ALTER TYPE`/rename columns.                                |
| `types.ts` (auto-generated)                  | **REGENERATE** after any migration                                                                                  | Hand-editing breaks the generated contract.                                                                                    |
| CSE Tutor / Life Skills `localStorage` seeds | **EXTEND → migrate to Supabase** (optional, phased)                                                                 | Client-only persistence is single-device; moving to DB enables cross-device sync. Low priority; keep localStorage as fallback. |
| AI server functions pattern                  | **KEEP**                                                                                                            | `createServerFn` + Lovable AI Gateway + `zod` validator is sound and consistent.                                               |
| Document/PDF handling                        | **REPLACE (absent → NEW)**                                                                                          | No PDF functionality exists today (grep hits were `localStorage`/`storage` config false positives).                            |
| Work automation pipeline                     | **EXTEND** existing `outreach`/`clients`/`work_projects`; add NEW tables for leads/research/website-audit/proposals | Existing tables cover clients/projects/outreach; lead-discovery and research are net-new.                                      |

---

## 4. Student Data Architecture

**User-owned, per-user (RLS).** Existing tables cover the Student Mode fully:

- Daily planning: `daily_intentions`, `tasks`.
- Learning Hub: `learn_topics`, `notes`, `coding_problems`, `quiz_items`, `flashcard_decks`, `flashcards`, `exams`, `academic_projects`.
- Progress analytics: derived from above (no separate table).
- Habits: `habits`, `habit_logs`. Goals: `goals`.

**Proposed extensions (EXTEND EXISTING — additive columns only, all `IF NOT EXISTS`):**

- `learn_topics`: add `source_url TEXT`, `estimated_hours NUMERIC` — optional enrichment. **NEW columns, no column renames.**
- `exams`: `syllabus` already JSONB; no change needed, but a companion `exam_syllabus_items` table could be added (**NEW**) if row-level tracking is desired. Currently **UNVERIFIED** whether needed.

All Student data remains **user-owned** and isolated by `user_id`.

---

## 5. Academic / Syllabus Architecture

- The only syllabus construct today is `exams.syllabus` (JSONB array of topic strings/objects). There is **no dedicated syllabus table** and **no academic-curriculum dataset** loaded.
- **EXTEND EXISTING:** `exams` (no schema change required for current features).
- **NEW (proposal, optional):** `syllabus_topics` — (user_id, exam_id FK, topic, covered BOOLEAN, linked_learn_topic_id FK→learn_topics). Marked **UNVERIFIED** (priority pending).
- No static academic syllabus dataset has been selected (see §20).

---

## 6. Learning Progress Architecture

- Progress is **derived**, not stored in a dedicated table: `learn_topics.progress` (0–100), `habits.streak`, `habit_logs`, `goals.done`, quiz/flashcard `known` flags.
- `ProgressTab.tsx` computes per-skill-category completion from `learn_topics`.
- **KEEP** current derivation. **NEW (optional):** `study_streaks` materialized/aggregated table — **UNVERIFIED**.
- All progress data is **user-owned**.

---

## 7. CSE Tutor Architecture

- **Server:** `src/lib/tutor.server.ts` (system prompts) + `src/lib/tutor.functions.ts` (`teachTopic`, `practiceQuestions`, `generateQuiz`, `chatTutor`, `askTutor` as `createServerFn`). Calls Lovable AI Gateway, model `google/gemini-3-flash-preview`, `temperature 0.7`, `maxOutputTokens 3000`.
- **Client:** `CSETutorView.tsx` stores curated seed notes in `localStorage` (keys e.g. `NOTES_SEEDED`). Chat history is in-component state.
- **RAG:** **NONE today.** Tutor is prompt-only; it does not read `learn_topics`, notes, or any corpus.
- **Proposed (NEW, optional):** personalization by injecting the user's `learn_topics`/`notes` context into the prompt (structured SQL retrieval — see §12). No vector store required for this.
- Data classification: tutor responses = **AI-generated content**; seed content = **curated knowledge** (currently client-side).

---

## 8. English Architecture

- **Server:** `src/lib/english-coach.server.ts` + `english-coach.functions.ts` (`coachChat`, `coachReply`). Same gateway/model. Supports `general`/`speaking`/`interview` modes. Session state passed in request (`sessionDay`, `mode`).
- **Client:** `EnglishCoach.tsx` (stateful conversation UI); includes a reset flow.
- **RAG:** **NONE.** Conversational only.
- No stored user corpus; chat is ephemeral per session (not persisted to DB). **UNVERIFIED** whether chat history should be persisted (would be **NEW** `english_sessions` table if so).

---

## 9. Life Skills Architecture

- **Server:** `src/lib/life-skills.server.ts` + `life-skills.functions.ts` (`askProfessor`, `chatMentor`). Supports kinds: `learn`/`book`/`business`/`resources`/`memory`/`answerCheck`/`flashcards`.
- **Client:** `LifeSkillsProfessor.tsx` persists check-states and seeds in `localStorage`.
- **RAG:** **NONE.** Book/business/resource answers are generated from the model's training; `resources` mode instructs the model to recommend _real existing_ resources and "Never invent URLs."
- Data: **AI-generated content** + **curated knowledge** (localStorage).

---

## 10. Document / PDF Architecture

**Current state: NO document/PDF functionality exists.** (Confirmed: no `pdfjs`, no upload UI, no storage bucket, no `File` handling in `src/`.)

**Proposed NEW architecture (not implemented):**

- **Storage bucket:** `documents` (NEW) — private, user-scoped path `user_id/<uuid>/<filename>`. Must have RLS/Storage policies restricting to owner.
- **Tables (NEW):**
  - `user_documents` (user_id, filename, storage_path, mime_type, size_bytes, status, created_at).
  - `document_chunks` (user_id, document_id FK, chunk_index, content_text, token_count).
  - `document_embeddings` (user_id, chunk_id FK, embedding `vector`) — requires **pgvector** (see §12).
- **Processing pipeline (NEW, server-side):** upload → store in `documents` bucket → parse (PDF/text) → chunk → embed → store chunks+embeddings. Parser/embedding libs = **UNVERIFIED** (no package chosen; do not install yet).
- **Classification:** uploaded files = **user-uploaded documents**; generated chunks/embeddings = derived **user-owned data**.

---

## 11. Knowledge Architecture

Three knowledge classes:

1. **User-owned data** — all 18 tables; the user's tasks, notes, topics, habits, clients, etc.
2. **Curated knowledge** — tutor/life-skills seed content + system prompts (today in `localStorage`/server `.ts` files). Can be promoted to a `knowledge_items` table (**NEW**, optional) for cross-device sync and versioning.
3. **AI-generated content** — tutor/coach responses (ephemeral today; persist optionally).
4. **Static datasets / shared knowledge** — **UNVERIFIED** (none selected; see §20).
5. **Live web research** — **UNVERIFIED** (proposed for Work lead research; see §15). Not currently implemented.

---

## 12. Vector / RAG Architecture

**Current state: NO RAG, NO vector store, NO embeddings.** `config.toml` does not enable `pgvector`; whether the hosted Supabase project has the `vector` extension available is **UNVERIFIED**.

**Retrieval classification:**

- **Structured SQL/database retrieval (no vectors):** personalization for tutors using the user's own `learn_topics`/`notes`/`exams` — simple `SELECT WHERE user_id=auth.uid()`. Recommended first step; no new infra.
- **Document retrieval (vector/semantic):** user-uploaded PDFs/notes → `document_embeddings` (requires pgvector). Needed only if semantic search over docs is required.
- **What does NOT require RAG:** all three existing tutors (prompt-only), progress analytics, all CRUD features.
- **User-data isolation:** any `document_embeddings`/`document_chunks` rows MUST carry `user_id` and RLS `USING (auth.uid()=user_id)`. Embeddings are derived from **user-uploaded documents** only — never from other users' data.

**Embedding model: UNVERIFIED** (would route through Lovable AI Gateway or a dedicated embeddings endpoint; not chosen).

---

## 13. Work / Freelance Architecture

Existing tables cover the core CRM/finance:

- `clients`, `work_projects`, `finance_entries`, `services`, `outreach`.
- `PipelineView.tsx` currently stores some pipeline/services data in `localStorage` (`ascend_services_v1`) — **inconsistent with Supabase-first design**; candidate for **EXTEND** (move to `services` table, which already exists with `starter/standard/premium_price`).

**Proposed NEW tables for richer automation (see §29):** `leads`, `lead_research`, `website_audits`, `proposals`. All user-scoped.

---

## 14. Lead Architecture

**Not present today** (leads are entered directly as `clients` with status `Lead`, or as `outreach` rows).

**Proposed NEW:** `leads` (user_id, name, source_platform, contact, niche, status [New/Researching/Qualified/Disqualified], discovered_at, raw_notes). Distinct from `clients` (a qualified lead becomes a `client`).

**Proposed data source for discovery:** live web research / platform scraping — **UNVERIFIED** (manual entry first; automation later with human approval).

---

## 15. Prospect Research Architecture

**Not present.** Proposed NEW: `lead_research` (user_id, lead_id FK, summary, pain_points, tech_stack_detected, social_urls JSONB, researched_at, research_method ['manual'|'ai-web']).

- **AI web research:** would use an LLM with web/search tooling. **UNVERIFIED** — no search tool is wired today; the Lovable AI Gateway `generateText` call has no web tool configured. Treat as net-new, gated behind human approval.

---

## 16. Outreach Architecture

**EXISTING:** `outreach` table (platform, lead_name, status, expected_value, niche, notes, message_type, outcome, outreach_date). This is the canonical outreach log.

**Extension:** add FK `lead_id UUID REFERENCES leads(id) ON DELETE SET NULL` (**EXTEND EXISTING** column, `IF NOT EXISTS`) to link outreach to a discovered lead. Add `ai_drafted BOOLEAN`, `approved BOOLEAN` to support human-approved AI generation.

- **External consequential actions (sending messages/emails):** MUST require explicit human approval before dispatch. No auto-send. Draft generated → user reviews → user sends via their own channel. Implementation detail, not yet built.

---

## 17. Client / Project Architecture

**EXISTING & sufficient:** `clients`, `work_projects` (FK→clients SET NULL), `finance_entries` (income tied to user). **KEEP.**

**Optional EXTEND:** `work_projects` add `client_lead_source` or link back to `leads` — **UNVERIFIED**.

---

## 18. AI Website-Building Architecture

**Not present.** Ascend itself is not a website builder. The phrase "AI Website-Building" in the Stage 5A checklist most plausibly refers to an _optional_ Work-mode feature where the AI helps a freelancer **draft a prospect's website / audit a prospect's existing site** as a lead-magnet service.

**Proposed (NEW, optional, UNVERIFIED):** `website_audits` (user_id, lead_id FK, url, audit_markdown, opportunities JSONB, generated_at). AI generates an audit/mock site from a URL or prompt; output is **AI-generated content** owned by the user, used as an outreach asset. No autonomous publishing. Human approval before sending to prospect.

---

## 19. Dataset Ingestion Architecture

**No datasets are ingested today, and none were selected in a prior stage (UNVERIFIED).**

Proposed ingestion pattern (when a dataset IS selected):

1. Source fetched (static file / API) → validated (§22).
2. Normalized into `shared_knowledge` or `knowledge_items` (**NEW**) with `source_id`, `license`, `fetched_at`, `hash`.
3. Optionally chunked + embedded into a **shared** (non-user-scoped) vector table `corpus_embeddings` with RLS disabled for read but write-restricted to `service_role` only.
4. Served to the user's AI features as **shared knowledge** (distinct from user-owned data).

No ingestion runs now. Do not download/import datasets in Stage 5B until §20 provenance is filled.

---

## 20. Dataset Provenance Architecture

**No dataset has been selected.** Every entry below is **UNVERIFIED** and MUST be populated before any ingestion:

| Field                          | Status         |
| ------------------------------ | -------------- |
| Selected source name           | **UNVERIFIED** |
| URL                            | **UNVERIFIED** |
| License                        | **UNVERIFIED** |
| Provenance / publisher         | **UNVERIFIED** |
| Intended purpose               | **UNVERIFIED** |
| Static / live / user-generated | **UNVERIFIED** |
| Integration recommendation     | **UNVERIFIED** |

Template to fill per dataset when chosen:

```
- source: <name>        [UNVERIFIED]
- url: <canonical url>  [UNVERIFIED]
- license: <SPDX id>    [UNVERIFIED]
- provenance: <publisher + retrieval method>
- purpose: <which feature consumes it>
- nature: static | live-api | user-generated
- integration: <embed at ingest | query live | RAG corpus>
```

---

## 21. Data Versioning

- **User data:** no versioning needed; `updated_at` timestamps exist on most tables. RLS + `ON DELETE CASCADE` protect referential integrity.
- **Curated knowledge / datasets:** if promoted to `knowledge_items`/`shared_knowledge`, add `version INT`, `superseded_by UUID`, `fetched_at`. **UNVERIFIED**.
- **Migrations:** versioned by Supabase migration filenames (timestamp + UUID). Keep additive; never amend pushed migrations (AGENTS.md / Lovable constraint).

---

## 22. Data Validation

- **Client/Server input:** `zod` validators on every `createServerFn` (see `tutor.functions.ts` etc.). Reuse this pattern for all new server functions.
- **DB constraints:** NOT NULL, FK `REFERENCES auth.users ON DELETE CASCADE`, `UNIQUE(user_id, day)` on intentions/habit_logs, partial unique on `goals` north-star.
- **Dataset validation (NEW):** schema check + license check + hash before ingest. **UNVERIFIED** exact rules.
- **Types:** `supabase/integrations/supabase/types.ts` is the generated source of truth; regenerate after schema change and let `tsc` catch mismatches.

---

## 23. Security / RLS Architecture

- **All 18 tables:** RLS enabled, single policy `FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id)`. `authenticated` → CRUD; `service_role` → ALL. No anon access.
- **MANDATORY for every NEW table:** replicate exactly the same per-user RLS policy + `user_id` NOT NULL FK to `auth.users`. Failure = data leak or write failure.
- **Storage:** NEW `documents` bucket must use **private** visibility + Storage policies scoping paths to `auth.uid()`.
- **Shared corpus tables:** if any non-user-scoped table is added (`corpus_embeddings`), it must be read-only to `authenticated` and writable only by `service_role` — explicitly NOT user-scoped.
- **Never** drop existing policies or the `user_id` column on existing tables.

---

## 24. AI Security

- AI key: `process.env.LOVABLE_API_KEY` (server-only, never exposed to client). `.env` already holds Supabase keys; do not add secrets to client bundle.
- All AI calls happen in **server functions** (`createServerFn`) — good isolation.
- **Prompt-injection / data leakage:** when injecting user `learn_topics`/`notes` into tutor prompts (§7), treat that content as untrusted text, not instructions.
- **External actions (outreach/email/DM):** require human approval; never auto-execute.
- **Web research:** if added, constrain tool use and log provenance; mark outputs as AI-generated.

---

## 25. API Architecture

- **Data API:** Supabase PostgREST (auto from tables) — used directly via `@supabase/supabase-js` client in components (`src/integrations/supabase/client.ts`).
- **AI API:** TanStack Start server functions (`createServerFn`, POST) → Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1`, header `Lovable-API-Key`). Model `google/gemini-3-flash-preview`.
- **New server functions** should follow the existing `*.functions.ts` + `*.server.ts` split (prompts in `.server.ts`, wired functions in `.functions.ts`).
- No custom REST/GraphQL layer; Supabase + server functions suffice.

---

## 26. Frontend Integration Architecture

- Routing: TanStack Router (`src/router.tsx`, `src/routeTree.gen.ts`); authenticated shell `src/routes/_authenticated/app.tsx` with Student/Work tabs.
- Data access: React Query + `src/lib/ascend-data.ts`, `src/lib/ascend-hooks.ts`. New tables → add typed hooks there; regenerate `types.ts`.
- UI: Radix + Tailwind v4, design tokens in `src/styles.css` (Warm Ivory / Forest Green / Muted Gold palette). New features must match this design system.
- AI panels: `CSETutorView`, `EnglishCoach`, `LifeSkillsProfessor` — extend, don't rewrite.

---

## 27. Performance Architecture

- Client-side: React Query caching; `localStorage` for tutor seeds (cheap).
- DB: only index today is `goals_user_northstar_unique`. **Proposed NEW indexes (optional):** `learn_topics(user_id, skill)`, `document_chunks(document_id)`, `document_embeddings` ivfflat/hnsw on `embedding`. **UNVERIFIED** which are needed.
- RAG query: `SELECT ... FROM document_embeddings ORDER BY embedding <=> $1 LIMIT k` with `WHERE user_id=auth.uid()`. Requires pgvector + index.
- Keep payloads small; `maxOutputTokens 3000` already caps tutor responses.

---

## 28. Cost / Infrastructure Considerations

- **Supabase Free/Pro tier:** 18 tables fit easily; storage bucket + pgvector may need Pro depending on usage. **UNVERIFIED** which plan is active.
- **AI cost:** every tutor call hits Lovable AI Gateway (metered). Adding RAG + web research increases token volume. Recommend caching AI outputs (optional `ai_responses` table) to avoid re-generation. **UNVERIFIED** budget.
- **Embeddings:** one-time per document; cheap but requires extension + storage.
- **Datasets:** static ingestion is one-time cost; live APIs may have rate/cost limits. **UNVERIFIED.**

---

## 29. Proposed Database Blueprint

Legend: **EXISTING** | **EXTEND EXISTING** (additive column) | **NEW**

### EXISTING (18 — keep, never alter destructively)

daily_intentions, tasks, learn_topics, notes, coding_problems, quiz_items, flashcard_decks, flashcards, exams, academic_projects, habits, habit_logs, goals, clients, work_projects, finance_entries, services, outreach

### EXTEND EXISTING (additive columns only, `IF NOT EXISTS`)

- `learn_topics` + `source_url TEXT`, + `estimated_hours NUMERIC`
- `outreach` + `lead_id UUID REFERENCES leads(id) ON DELETE SET NULL`, + `ai_drafted BOOLEAN DEFAULT false`, + `approved BOOLEAN DEFAULT false`
- `work_projects` + `lead_id UUID REFERENCES leads(id) ON DELETE SET NULL` _(UNVERIFIED)_

### NEW (proposed — not created)

- `leads` (user_id, name, source_platform, contact, niche, status, discovered_at, raw_notes)
- `lead_research` (user_id, lead_id FK, summary, pain_points, tech_stack_detected, social_urls JSONB, research_method, researched_at)
- `website_audits` (user*id, lead_id FK, url, audit_markdown, opportunities JSONB, generated_at) *(UNVERIFIED)\_
- `proposals` (user*id, lead_id/client_id FK, title, body_markdown, status, created_at) *(UNVERIFIED)\_
- `user_documents` (user_id, filename, storage_path, mime_type, size_bytes, status, created_at)
- `document_chunks` (user_id, document_id FK, chunk_index, content_text, token_count)
- `document_embeddings` (user*id, chunk_id FK, embedding `vector`) \_requires pgvector — UNVERIFIED availability*
- `knowledge_items` (user*id NULLable for shared, title, body, source_id, license, version, fetched_at, hash) *(UNVERIFIED; for curated/shared knowledge)\_
- `ai_responses` (user*id, feature, prompt_hash, response_text, model, created_at) \_optional cache — UNVERIFIED*

Every NEW/EXTEND table gets: `user_id` FK→auth.users (except shared `knowledge_items` which is service-role-managed), RLS per-user policy, `created_at`.

---

## 30. Relationship Diagram

```
auth.users ──< (all 18 EXISTING tables via user_id ON DELETE CASCADE)

flashcard_decks ──< flashcards            (CASCADE)
habits            ──< habit_logs          (CASCADE)
clients           ─< work_projects        (SET NULL on client delete)
clients           ─< outreach             (today, by name; proposed lead_id FK)
exams.syllabus    ── JSONB (no FK)

PROPOSED additions:
leads             ──< lead_research, outreach(lead_id), website_audits(lead_id),
                      proposals(lead_id), work_projects(lead_id)
user_documents    ──< document_chunks     (CASCADE)
document_chunks   ──< document_embeddings (CASCADE)
knowledge_items   (shared; no user_id FK when shared)
```

All user-scoped edges enforce `auth.uid()=user_id` at RLS level.

---

## 31. Complete Data Flow

1. **Auth:** Supabase email/password → `auth.users` → session in `localStorage` (client) / cookie (server). Every query filtered by `auth.uid()`.
2. **CRUD (existing):** Component → React Query hook (`ascend-data.ts`) → Supabase client → Postgres (RLS enforces ownership).
3. **AI tutor (existing):** Component → `createServerFn` → Lovable AI Gateway → response → UI. No DB read. (Optional future: prepend user's `learn_topics`/`notes` via SQL SELECT.)
4. **Document RAG (proposed):** Upload → Storage `documents` bucket → parse → `document_chunks` → embed → `document_embeddings`. Query → embed question → `<=>` search (user-scoped) → top-k chunks → prompt → answer.
5. **Work automation (proposed):** Manual/AI lead discovery → `leads` → `lead_research` (AI web, human-approved) → `website_audits` (AI, human-approved) → qualify → `outreach` (AI draft, **human approves & sends**) → convert `leads`→`clients` → `work_projects` → `finance_entries` (income).
6. **Datasets (proposed, UNVERIFIED):** Ingest → validate → `knowledge_items`/`corpus_embeddings` (shared) → consumed as shared knowledge by AI features.

---

## 32. Implementation Phases

- **Phase 0 — Artifact gate:** This document present; §20 provenance filled before any dataset ingest. _(done by this file)_
- **Phase 1 — Schema (additive):** NEW tables with full RLS + EXTEND columns. Migrations additive only. Regenerate `types.ts`.
- **Phase 2 — Data layer:** Hooks in `ascend-data.ts`/`ascend-hooks.ts` for new tables.
- **Phase 3 — Work automation:** leads/research/outreach linking; AI draft + human approval UI.
- **Phase 4 — Document/PDF + RAG:** Storage bucket, parser, embeddings, pgvector (if available), retrieval UI. _(highest infra risk)_
- **Phase 5 — Knowledge/datasets:** Only after §20 filled; shared corpus + RAG.
- **Phase 6 — AI personalization:** Inject user `learn_topics`/`notes` into tutors (SQL retrieval, no vectors).
- **Phase 7 — Regression:** Full manual checklist (§12 of Stage 5A report).

---

## 33. Migration Safety Plan

- **Additive only:** `CREATE TABLE`, `ADD COLUMN IF NOT EXISTS`, new policies. No `DROP`/`ALTER TYPE`/rename on existing objects.
- **Reversible pairs:** every `CREATE TABLE` → documented `DROP TABLE` inverse; every `ADD COLUMN` → `DROP COLUMN` inverse. Never run destructive ops on the 18 existing tables.
- **Backup first:** `pg_dump` of `public` schema + data (or Supabase snapshot) before applying any migration to the hosted project.
- **types.ts:** regenerate, never hand-edit; verify `npm run build` + `npm run lint` pass.
- **Lovable constraint (AGENTS.md):** do not force-push/squash/rebase already-pushed commits; new work in new commits on `ascend-data-integration`; keep branch working.
- **Rollback:** apply inverse migration; if already on hosted DB, restore from backup.

---

## 34. Risks

| Risk                                           | Likelihood | Impact              | Mitigation                                                 |
| ---------------------------------------------- | ---------- | ------------------- | ---------------------------------------------------------- |
| New table missing RLS                          | Med        | High (leak)         | Enforce per-user policy template on every NEW table        |
| pgvector unavailable on plan                   | Med        | Med                 | Verify extension before Phase 4; fallback to SQL retrieval |
| Altering existing column breaks 30+ components | Low        | High                | Additive migrations only                                   |
| AI auto-sends outreach                         | Low        | High (reputational) | Human approval gate, no auto-dispatch                      |
| Dataset license violation                      | Med        | High                | §20 provenance + license check before ingest               |
| types.ts drift                                 | Med        | Med                 | Regenerate + build/lint gate                               |
| Lovable history rewrite                        | Low        | High                | Never squash/force-push pushed commits                     |

---

## 35. Final Recommendations

1. **Never** modify/drop the 18 existing tables or their RLS.
2. Build new capabilities as **NEW, user-scoped tables + RLS**, never by overloading existing tables.
3. Start with **Phase 1–3 (schema + work automation)** — highest user value, lowest infra risk.
4. Defer **RAG/PDF (Phase 4)** until pgvector availability is confirmed.
5. Treat **datasets (Phase 5)** as blocked until §20 provenance is completed.
6. Keep all **external actions human-approved**.
7. Regenerate `types.ts` and run `build`+`lint` after every migration.

---

## 36. Stage 5 Implementation Plan

> Sequenced, safe, reversible. Mirrors §32 phases. No item below is executed in Stage 4.

1. **Pre-flight:** snapshot DB; confirm branch clean (it is); confirm `LOVABLE_API_KEY` present server-side.
2. **Schema migration (additive):** `leads`, `lead_research`, `proposals`, `website_audits` (UNVERIFIED), EXTEND `outreach`/`work_projects` with `lead_id`, EXTEND `learn_topics`. All with RLS.
3. **Regenerate** `types.ts`; run `npm run build` + `npm run lint`.
4. **Hooks:** add `useLeads`, `useLeadResearch`, `useProposals` to data layer.
5. **UI:** Lead discovery + research panels in Work Mode; outreach "AI draft → approve → send" flow.
6. **Phase 4 (conditional):** Storage bucket + parse/embed pipeline + `user_documents`/`document_chunks`/`document_embeddings`; verify pgvector first.
7. **Phase 5 (conditional):** dataset ingest only after §20 filled.
8. **Phase 6:** tutor personalization via SQL retrieval.
9. **Verify:** run Stage 5A regression checklist after each phase; keep branch working for Lovable sync.

---

_End of Stage 4 Data Architecture. No code, migrations, tables, datasets, or configuration were created or modified by producing this document._
