import { CSE_TUTOR_SYSTEM } from "./tutor.server";
import { BASE_GROUNDED, LEVEL_GUIDANCE, MASTERY_SCALE } from "./student-tutor-core";
import type { ContextItem } from "./context-engine-core";

export interface StudentProfile {
  topics: any[];
  exams: any[];
  goals: any[];
  recentErrors: any[];
  dsaProgress: any[];
}

export interface WeakArea {
  type: string;
  concept: string;
  frequency: number;
  source: string;
}

export interface RevisionItem {
  id: string;
  source_type: string;
  source_id: string;
  source_title: string;
  next_review_date: string;
  priority_boost: number;
}

export function buildPriorityContext(profile: StudentProfile): string {
  const now = new Date();
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  
  const upcomingExams = profile.exams.filter((e) => 
    e.exam_date && new Date(e.exam_date).getTime() - now.getTime() < twoWeeksMs
  );
  
  if (upcomingExams.length > 0) {
    const examSubjects = upcomingExams.map((e) => e.subject).join(', ');
    return `CURRENT PHASE: EXAM PREPARATION (${examSubjects} exam${upcomingExams.length > 1 ? 's' : ''} within 2 weeks)
PRIORITY: Exam preparation > Everything else
INCREASE: Revision, syntax, programming questions, output prediction, dry runs, debugging, timed practice, exam-style questions
DECREASE: New DSA topics, large projects, HTML/CSS`;
  }
  
  const cPythonExamTopics = profile.topics.filter((t) => 
    ['C', 'Python'].includes(t.language) && t.exam_priority
  );
  if (cPythonExamTopics.length > 0) {
    return `CURRENT PHASE: C/PYTHON EXAM FOCUS
PRIORITY 1: C + Python (exam-oriented)
PRIORITY 2: C++ + DSA
PRIORITY 3: Projects
PRIORITY 4: HTML/CSS`;
  }
  
  return `CURRENT PHASE: NORMAL ROADMAP
PRIORITY 1: C + Python (fundamentals)
PRIORITY 2: C++ + DSA
PRIORITY 3: Projects
PRIORITY 4: HTML/CSS`;
}

export function buildStudentProfileContext(profile: StudentProfile): string {
  const parts: string[] = [];
  
  if (profile.topics.length > 0) {
    const inProgress = profile.topics.filter((t) => t.status === 'In Progress' || (t.progress ?? 0) > 0 && (t.progress ?? 0) < 100);
    const completed = profile.topics.filter((t) => t.status === 'Completed' || (t.progress ?? 0) >= 100);
    const weak = profile.topics.filter((t) => (t.mastery_level ?? 0) < 3 && (t.progress ?? 0) > 0);
    
    parts.push(`LEARNING TOPICS (${profile.topics.length} total):
  In Progress: ${inProgress.map((t) => `${t.topic} (${t.language ?? 'N/A'}, ${t.progress ?? 0}%, mastery ${t.mastery_level ?? 0}/5)`).join('; ') || 'None'}
  Completed: ${completed.map((t) => `${t.topic} (${t.language ?? 'N/A'})`).join('; ') || 'None'}
  Weak Areas (mastery < 3): ${weak.map((t) => `${t.topic} (${t.language ?? 'N/A'}, mastery ${t.mastery_level ?? 0}/5)`).join('; ') || 'None'}`);
  }
  
  if (profile.exams.length > 0) {
    parts.push(`UPCOMING EXAMS:
${profile.exams.map((e) => `  - ${e.name} (${e.subject ?? 'N/A'}) on ${e.exam_date ?? 'TBD'} - Prep: ${e.prep_status ?? 'Unknown'}`).join('\n')}`);
  }
  
  if (profile.goals.length > 0) {
    parts.push(`ACTIVE GOALS:
${profile.goals.filter((g) => !g.done).map((g) => `  - ${g.scope}: ${g.text} (Deadline: ${g.deadline ?? 'None'})`).join('\n')}`);
  }
  
  if (profile.recentErrors.length > 0) {
    parts.push(`RECURRING MISTAKES (top ${Math.min(5, profile.recentErrors.length)}):
${profile.recentErrors.slice(0, 5).map((e) => `  - [${e.error_type}] ${e.concept}: ${e.description} (freq: ${e.frequency})`).join('\n')}`);
  }
  
  if (profile.dsaProgress.length > 0) {
    const mastered = profile.dsaProgress.filter((d) => d.mastery_level >= 4).length;
    const inProgress = profile.dsaProgress.filter((d) => d.mastery_level > 0 && d.mastery_level < 4).length;
    const patterns = [...new Set(profile.dsaProgress.map((d) => d.pattern).filter(Boolean))];
    parts.push(`DSA PROGRESS: ${profile.dsaProgress.length} attempts, ${mastered} mastered, ${inProgress} in progress
  Patterns encountered: ${patterns.join(', ') || 'None'}`);
  }
  
  return parts.length > 0 ? parts.join('\n\n') : 'No prior learning data available.';
}

export function getResourceRecommendations(language: string): { primary: any; backup: any; visualizer?: any } {
  const resourceMap: Record<string, { primary: any; backup: any; visualizer?: any }> = {
    'C': {
      primary: { title: 'Exercism C Track', url: 'https://exercism.org/tracks/c', format: 'interactive', description: 'Interactive C exercises with mentored feedback' },
      backup: { title: 'The C Programming Language (K&R)', url: 'https://www.amazon.com/C-Programming-Language-2nd/dp/0131103628', format: 'text', description: 'Classic authoritative reference' },
    },
    'Python': {
      primary: { title: 'Exercism Python Track', url: 'https://exercism.org/tracks/python', format: 'interactive', description: 'Interactive Python exercises with mentored feedback' },
      backup: { title: 'Python Official Tutorial', url: 'https://docs.python.org/3/tutorial/', format: 'documentation', description: 'Official tutorial from Python Software Foundation' },
    },
    'C++': {
      primary: { title: 'Exercism C++ Track', url: 'https://exercism.org/tracks/cpp', format: 'interactive', description: 'Interactive C++ exercises covering basics, references, OOP, STL' },
      backup: { title: 'cppreference.com', url: 'https://en.cppreference.com/', format: 'reference', description: 'Authoritative C++ reference' },
    },
    'DSA': {
      primary: { title: 'Striver A2Z DSA Sheet', url: 'https://takeuforward.org/strivers-a2z-dsa-course/', format: 'structured', description: 'Structured progression through all DSA patterns' },
      backup: { title: 'NeetCode 150', url: 'https://neetcode.io/roadmap', format: 'structured', description: '150 curated problems by pattern with video explanations' },
      visualizer: { title: 'W3Schools DSA Visualizer', url: 'https://www.w3schools.com/dsa/', format: 'visualizer', description: 'Interactive visualizations for sorting, trees, graphs' },
    },
    'HTML': {
      primary: { title: 'W3Docs HTML Exercises', url: 'https://www.w3docs.com/learn-html/html-exercises.html', format: 'exercises', description: 'Hands-on HTML exercises: semantic HTML, forms, tables, accessibility' },
      backup: { title: 'MDN HTML Reference', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML', format: 'reference', description: 'Authoritative HTML reference' },
    },
    'CSS': {
      primary: { title: 'W3Docs CSS Exercises', url: 'https://www.w3docs.com/learn-css/css-exercises.html', format: 'exercises', description: 'Hands-on CSS exercises: selectors, box model, flexbox, grid, responsive' },
      backup: { title: 'MDN CSS Reference', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS', format: 'reference', description: 'Authoritative CSS reference' },
    },
  };
  
  return resourceMap[language] || { primary: null, backup: null };
}

export function buildUnifiedSystemPrompt(
  mode: string,
  profile: StudentProfile,
  opts: { level?: string; subject?: string; language?: string; questionType?: string } = {}
): string {
  const priorityContext = buildPriorityContext(profile);
  const profileContext = buildStudentProfileContext(profile);
  const resources = opts.language ? getResourceRecommendations(opts.language) : { primary: null, backup: null };
  
  const resourceSection = resources.primary ? `
RECOMMENDED RESOURCES FOR ${opts.language}:
Primary: ${resources.primary.title} - ${resources.primary.url} (${resources.primary.format})
${resources.primary.description}
Backup: ${resources.backup?.title} - ${resources.backup?.url} (${resources.backup?.format})
${resources.backup?.description}
${resources.visualizer ? `Visualizer: ${resources.visualizer.title} - ${resources.visualizer.url}` : ''}` : '';
  
  const modeInstructions = getModeInstructions(mode, opts);
  
  return `${CSE_TUTOR_SYSTEM}

${BASE_GROUNDED}

${priorityContext}

STUDENT PROFILE:
${profileContext}

${resourceSection}

${modeInstructions}

TEACHING METHOD REMINDER (follow for every concept):
1. What is it? 2. Why is it needed? 3. Simple real-world analogy 4. Small example 5. Step-by-step explanation 6. Dry run 7. Student coding task 8. Common mistakes 9. Practice exercises 10. Short understanding check

ACTIVE LEARNING RULES:
- Never give solutions immediately. Use hint progression: Hint 1 → Hint 2 → Strong Hint → Approach → Pseudocode → Solution
- Make the student think and code independently
- Encourage productive struggle within their time limit

DSA PROBLEM WORKFLOW (when applicable):
1. Understand the problem 2. Identify input/output 3. Test examples manually 4. Think of brute force 5. Analyze complexity 6. Identify pattern 7. Write pseudocode 8. Code 9. Test edge cases 10. Analyze time/space 11. Record main lesson + "What clue would tell you to use this technique?"

${opts.level ? LEVEL_GUIDANCE[opts.level as keyof typeof LEVEL_GUIDANCE] || '' : 'Default to LEVEL 2 (normal university explanation).'}

GROUNDING RULES:
- Use student's documents, learn_topics, exams, goals as primary evidence
- Cite sources inline with title + URL
- If evidence doesn't contain answer, say so explicitly, then answer from general knowledge
- Never fabricate citations or page numbers
- Mark AI-generated sections clearly`;
}

function getModeInstructions(mode: string, opts: any): string {
  const base = `MODE: ${mode}.`;
  
  switch (mode) {
    case 'TEACH':
      return `${base}
Teach the concept using this structure:
## Concept
## Why It Matters
## Intuition (real-world analogy)
## Step-by-Step Explanation
## Code Example (with line-by-line explanation)
## Dry Run
## Common Mistakes
## Practice Exercise (one question, do NOT provide answer)
## Quick Understanding Check
End by asking if they want a practice question.`;
    
    case 'PRACTICE':
      return `${base}
Generate exactly ONE practice question grounded in the student's syllabus, notes, or topic.
Question type preference: ${opts.questionType ?? 'conceptual'}.
Do NOT provide the answer. Ask the question and wait for their response.
If no grounded material exists, base it on the topic and note it is general.`;
    
    case 'EVALUATE':
      return `${base}
The student's answer is provided. Evaluate using this format:
## Result
(Mastery level 0-5: ${MASTERY_SCALE})
## Explanation
## Correction
## Ideal Answer
## Next Step
Be lenient: don't penalize wording differences when concept is correct. Use evidence to ground corrections.`;
    
    case 'EXAM':
      return `${base}
Produce exam preparation guide:
## Syllabus Coverage
## Topic Prioritization (weak areas first)
## Revision Plan (daily breakdown)
## Practice Suggestion (include dataset if relevant)
## Predicted Questions (exam-style)
Do NOT invent the user's university syllabus. If no syllabus exists, say so and give general study path.`;
    
    case 'CODING':
      return `${base}
Solve the coding problem with these sections:
## Problem Statement
## Intuition
## Approach
## Step-by-Step Solution
## Code (with language-appropriate syntax, explain important lines)
## Time & Space Complexity (with reasoning)
## Common Mistakes
## Follow-up Challenge (do not answer)`;
    
    case 'DEBUG':
      return `${base}
Analyze the provided code and description:
## What's Wrong
## Root Cause (explain mechanism, not just symptom)
## Fixed Code
## Why The Fix Works
## How To Avoid This Class Of Bug
## Key Takeaway`;
    
    case 'PROJECT':
      return `${base}
Guide the project with:
## Architecture Overview
## Tech Stack (with justification)
## Step-by-Step Implementation Plan
## Key APIs & Libraries
## What Will Break First (and how to handle it)
## Resume Bullet Points
## Key Takeaway`;
    
    case 'DAILY_PLAN':
      return `${base}
Output ONLY a valid JSON object with this exact structure:
{
  "date": "YYYY-MM-DD",
  "availableMinutes": number,
  "blocks": [
    {"type": "revision|concept|coding|dsa|project|review", "durationMin": number, "topic": "string", "details": "string", "priority": number, "resources": [{"title": "string", "url": "string", "type": "string"}]}
  ]
}
No prose. No markdown. Valid JSON only.`;
    
    case 'CHAT':
    default:
      return `${base}
Act as a helpful, encouraging personal tutor. Teach, explain, and guide using grounded evidence when available. Reference conversation history. Adapt to student's responses.`;
  }
}

export function buildUnifiedUserPrompt(
  message: string,
  items: ContextItem[],
  opts: { userAnswer?: string; history?: { role: string; content: string }[] } = {}
): string {
  let body = '';
  
  if (items.length > 0) {
    const blocks = items.map((it) => {
      const loc = [it.title, it.page ? `page ${it.page}` : null, it.heading ? `section: ${it.heading}` : null].filter(Boolean).join(' | ');
      const link = it.url ? `\nURL: ${it.url}` : '';
      return `[${it.source.toUpperCase()}: ${loc}]${link}\n${it.text}`;
    }).join('\n\n');
    body = `GROUNDED EVIDENCE:\n${blocks}\n\n`;
  } else {
    body = 'NO GROUNDED EVIDENCE available. Answer from general knowledge but state this clearly.\n\n';
  }
  
  body += `QUESTION: ${message}`;
  
  if (opts.userAnswer && opts.userAnswer.trim()) {
    body += `\n\nSTUDENT ANSWER:\n${opts.userAnswer.trim()}\n\nEvaluate using the evaluation structure.`;
  }
  
  if (opts.history && opts.history.length > 0) {
    const conv = opts.history.map((h) => `${h.role === 'user' ? 'STUDENT' : 'TUTOR'}: ${h.content}`).join('\n');
    body = `CONVERSATION HISTORY:\n${conv}\n\n${body}`;
  }
  
  return body;
}