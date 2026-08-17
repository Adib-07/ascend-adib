# Ascend: Your AI Journey

Create a full-stack productivity web app called "Ascend" for a B.Tech CSE student who is also a freelancer building toward becoming an AI Engineer.

DESIGN SYSTEM (use these exact colors as CSS variables):
- Warm Ivory: #F5F2EB (main background)
- Linen Beige: #EAE4D8 (card/section background)
- Deep Forest Green: #2F4F3E (primary accent, headers, active states)
- Muted Gold: #B08D57 (secondary accent, highlights, icons)
- Charcoal: #2B2B2B (primary text)
- Slate Gray: #6B6A67 (secondary text)

Aesthetic: "old money" / dark academia — elegant, warm, minimal, generous whitespace, serif font for headings (e.g. "Playfair Display" or "DM Serif Display" from Google Fonts), clean sans-serif for body (e.g. "Inter"). Soft rounded corners (8-12px), subtle borders instead of heavy shadows, no bright/neon colors anywhere.

AUTH: Use Supabase email/password authentication (signup, login, logout, persistent session). Single user app — after login, show their personal dashboard. Use Supabase for all data storage so it syncs across devices (laptop + phone).

APP STRUCTURE:
A top header with the "Ascend" logo/wordmark on the left, and a mode toggle in the center/right: "Student Mode" and "Work Mode" (pill-style toggle, switching changes the entire content area below). Show a logout button on the far right.

=== STUDENT MODE — 4 tabs in a secondary nav bar ===

1. DAILY TASKS
   - Today's date + a short "intention" text field (editable, saves to DB)
   - Top 3 Most Important Tasks (simple checklist, 3 slots)
   - Full task list: add/edit/delete tasks with fields: title, priority (High/Medium/Low - color coded using our palette), due date, type (Study/Personal/Habit), done checkbox
   - Filter tabs: Today / All / Overdue

2. LEARNING HUB (this is the most important section — merge in 7 sub-tabs as an inner nav)
   - Sub-tab "Learn": list of topics/subjects to study with fields: topic name, skill category (Python/AI/ML/DBMS/DSA/OS/Data Analytics), status (Not Started/In Progress/Completed), progress % (visual progress bar), difficulty, source, deadline. Add/edit/delete topics.
   - Sub-tab "Notes": simple note-taking area, list of notes with title + content (markdown-style text), tagged by topic, add/edit/delete
   - Sub-tab "Coding": list of coding problems/practice with fields: problem title, platform (LeetCode/HackerRank), difficulty, status (solved/unsolved), link, notes
   - Sub-tab "Quiz": simple quiz/question bank - add question + answer pairs by topic, with a "practice mode" that shows question then reveals answer on click
   - Sub-tab "Flashcards": flashcard decks grouped by subject, each card has front/back, with a flip animation on click, and a simple "known/unknown" tracker
   - Sub-tab "Exam Prep": exam/test tracker with fields: exam name, subject, date, syllabus topics checklist, prep status
   - Sub-tab "Projects": academic/personal project tracker with fields: project name, status, deadline, tech stack, notes
   - Sub-tab "Progress": a simple analytics view showing overall completion % per skill category as progress bars/cards, plus total topics completed and study streak

3. HABITS
   - List of daily habits with fields: name, category, current streak (number), done today (checkbox that increments streak)
   - Weekly grid view: habit rows x 7 day columns, checkbox per day
   - Show this week's completion score

4. GOALS
   - North star goal (single text field, editable)
   - 90-day goals list (checklist with deadline per item)
   - 1-year goals list (checklist with deadline per item)

=== WORK MODE — 4 tabs in a secondary nav bar ===

1. CLIENTS
   - Client list/cards: name, platform (Upwork/Fiverr/LinkedIn/Direct), status (Lead/Active/Completed/Lost - color coded), total revenue, contact info, rating
   - Add/edit/delete clients
   - Filter by status

2. PROJECTS
   - Project board with columns by status: Planning / Active / Done / Paused (kanban-style or simple grouped list)
   - Each project: name, type (Freelance/Personal/Startup), client (link to client), deadline, revenue, progress %

3. INCOME TRACKER
   - Add income/expense entries: description, amount, type (Income/Expense), category, date, account
   - Monthly summary at top: total income, total expenses, net
   - Table of all entries, sortable by date, filterable by type

4. FREELANCE PIPELINE
   - Simple CRM-style pipeline view: Lead → Proposal Sent → Active → Won/Lost (visual pipeline/kanban)
   - Services & pricing list: service name, price range, delivery time (editable list)
   - Outreach log: date, platform, lead name, status

GENERAL REQUIREMENTS:
- Fully responsive — must work great on both desktop and mobile (this is critical, the user switches between laptop and phone)
- All data must persist in Supabase tied to the logged-in user
- Use clean card-based layouts, soft borders, the serif/sans-serif font pairing throughout
- Empty states should be encouraging and minimal (not blank/broken looking)
- Keep navigation simple — no more than 2 levels deep (Mode → Tab → Sub-tab only in Learning Hub)
- Add subtle micro-interactions (hover states, smooth transitions) but nothing flashy or neon

Start by setting up Supabase auth (signup/login page with the Ascend branding) and the main app shell with the Student/Work mode toggle and navigation working, then build out the Daily Tasks and Learning Hub (Learn + Flashcards sub-tabs) sections first as the foundation.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ascend-adib.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bd20b1ef-de11-406c-adf8-c45534ef33e2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
