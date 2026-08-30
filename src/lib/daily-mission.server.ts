import type { SupabaseClient } from "@supabase/supabase-js";
import { getStudentProfile, getDueRevisions, getWeakAreas, type StudentProfile, type RevisionItem, type WeakArea } from "./context-engine.server";
import { getResourceRecommendations } from "./unified-tutor-prompts";

export interface DailyMission {
  date: string;
  availableMinutes: number;
  blocks: MissionBlock[];
}

export interface MissionBlock {
  type: "revision" | "concept" | "coding" | "dsa" | "project" | "review";
  durationMin: number;
  topic: string;
  details: string;
  priority: number;
  resources?: { title: string; url: string; type: string }[];
}

function getTimeAllocation(totalMinutes: number): { revision: number; concept: number; coding: number; dsa: number; project: number; review: number } {
  if (totalMinutes <= 60) {
    return { revision: 5, concept: 20, coding: 25, dsa: 0, project: 0, review: 10 };
  }
  if (totalMinutes <= 90) {
    return { revision: 10, concept: 25, coding: 35, dsa: 0, project: 0, review: 15 };
  }
  // 120+
  return { revision: 10, concept: 30, coding: 40, dsa: 30, project: 0, review: 10 };
}

function isExamMode(profile: StudentProfile): { active: boolean; subjects: string[] } {
  const now = new Date();
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  const upcomingExams = profile.exams.filter((e) =>
    e.exam_date && new Date(e.exam_date).getTime() - now.getTime() < twoWeeksMs
  );
  return {
    active: upcomingExams.length > 0,
    subjects: upcomingExams.map((e) => e.subject).filter(Boolean) as string[],
  };
}

export async function generateDailyMission(
  supabase: SupabaseClient,
  userId: string,
  availableMinutes: number = 90
): Promise<DailyMission> {
  const profile = await getStudentProfile(supabase, userId);
  const dueRevisions = await getDueRevisions(supabase, userId);
  const weakAreas = await getWeakAreas(supabase, userId);
  const examMode = isExamMode(profile);

  const allocation = getTimeAllocation(availableMinutes);
  const blocks: MissionBlock[] = [];
  let priority = 1;

  // 1. Revision block (always first)
  if (dueRevisions.length > 0 && allocation.revision > 0) {
    const revisionTopics = dueRevisions.slice(0, 3).map((r) => r.source_title).join(", ");
    blocks.push({
      type: "revision",
      durationMin: allocation.revision,
      topic: "Revision",
      details: `Review: ${revisionTopics}. Use spaced repetition - recall before re-reading.`,
      priority: priority++,
    });
  }

  // 2. Weak areas from errors (high priority)
  const topWeakAreas = weakAreas.slice(0, 2);
  for (const weak of topWeakAreas) {
    const lang = weak.source.includes("C++") ? "C++" : weak.source.includes("Python") ? "Python" : weak.source.includes("C") ? "C" : "C";
    const resources = getResourceRecommendations(lang);
    if (allocation.concept > 0) {
      blocks.push({
        type: "concept",
        durationMin: Math.min(allocation.concept, 25),
        topic: weak.concept,
        details: `Weak area: ${weak.type} - ${weak.concept} (frequency: ${weak.frequency}). Focus on understanding the root cause, then practice 2-3 exercises.`,
        priority: priority++,
        resources: resources.primary ? [{ title: resources.primary.title, url: resources.primary.url, type: resources.primary.format }] : undefined,
      });
      allocation.concept = Math.max(0, allocation.concept - 25);
    }
  }

  // 3. Exam preparation (overrides normal priority)
  if (examMode.active && allocation.concept > 0) {
    for (const subject of examMode.subjects) {
      const lang = subject.toLowerCase().includes("c++") ? "C++" : subject.toLowerCase().includes("python") ? "Python" : "C";
      const resources = getResourceRecommendations(lang);
      blocks.push({
        type: "concept",
        durationMin: Math.min(allocation.concept, 30),
        topic: `${subject} Exam Prep`,
        details: `Exam-focused: Output prediction, dry runs, debugging, syntax, timed practice. Priority over new topics.`,
        priority: priority++,
        resources: resources.primary ? [{ title: resources.primary.title, url: resources.primary.url, type: resources.primary.format }] : undefined,
      });
      allocation.concept = Math.max(0, allocation.concept - 30);
    }
  }

  // 4. Current learning topic (from learn_topics in progress)
  const inProgressTopic = profile.topics.find((t) => t.status === "In Progress" || (t.progress ?? 0) > 0 && (t.progress ?? 0) < 100);
  if (inProgressTopic && allocation.concept > 0) {
    const resources = getResourceRecommendations(inProgressTopic.language ?? "C");
    blocks.push({
      type: "concept",
      durationMin: Math.min(allocation.concept, 25),
      topic: inProgressTopic.topic,
      details: `Continue: ${inProgressTopic.topic} (${inProgressTopic.language ?? 'N/A'}, ${inProgressTopic.progress ?? 0}% complete). Next: ${getNextSubtopic(inProgressTopic)}.`,
      priority: priority++,
      resources: resources.primary ? [{ title: resources.primary.title, url: resources.primary.url, type: resources.primary.format }] : undefined,
    });
    allocation.concept = Math.max(0, allocation.concept - 25);
  }

  // 5. Coding practice (C/Python priority)
  const codingLangs = ["C", "Python", "C++"];
  for (const lang of codingLangs) {
    if (allocation.coding > 0) {
      const resources = getResourceRecommendations(lang);
      blocks.push({
        type: "coding",
        durationMin: Math.min(allocation.coding, 30),
        topic: `${lang} Practice`,
        details: `Solve 2-3 exercises from ${resources.primary?.title ?? 'practice resource'}. Focus: write, run, debug independently.`,
        priority: priority++,
        resources: resources.primary ? [{ title: resources.primary.title, url: resources.primary.url, type: resources.primary.format }] : undefined,
      });
      allocation.coding = Math.max(0, allocation.coding - 30);
      if (lang === "C++" && allocation.coding <= 0) break; // Only C++ if time permits
    }
  }

  // 6. DSA (if time permits and foundation ready)
  const hasProgrammingFoundation = profile.topics.some((t) =>
    ["C", "Python", "C++"].includes(t.language) && (t.mastery_level ?? 0) >= 3
  );
  if (hasProgrammingFoundation && allocation.dsa > 0) {
    const resources = getResourceRecommendations("DSA");
    blocks.push({
      type: "dsa",
      durationMin: Math.min(allocation.dsa, 30),
      topic: "DSA Problem",
      details: `Next pattern: ${getNextDSAPattern(profile.dsaProgress)}. Follow 11-step workflow. Don't look at solution immediately.`,
      priority: priority++,
      resources: resources.primary ? [{ title: resources.primary.title, url: resources.primary.url, type: resources.primary.format }] : undefined,
    });
  }

  // 7. Project (if time permits and DSA foundation ready)
  const hasDSAFoundation = profile.dsaProgress.some((d) => (d.mastery_level ?? 0) >= 3);
  if (hasDSAFoundation && allocation.project > 0) {
    blocks.push({
      type: "project",
      durationMin: Math.min(allocation.project, 30),
      topic: "Project Work",
      details: `Continue current project or plan Memory Profiler (C/C++) / Algorithm Visualizer (JS/Python).`,
      priority: priority++,
    });
  }

  // 8. Review block (always last)
  if (allocation.review > 0) {
    blocks.push({
      type: "review",
      durationMin: allocation.review,
      topic: "Session Review",
      details: "Log what you learned, note mistakes, update progress. Plan tomorrow's mission.",
      priority: priority++,
    });
  }

  // Filter out blocks with 0 duration
  const finalBlocks = blocks.filter((b) => b.durationMin > 0);

  return {
    date: new Date().toISOString().split("T")[0],
    availableMinutes,
    blocks: finalBlocks,
  };
}

function getNextSubtopic(topic: any): string {
  const subtopics: Record<string, string[]> = {
    C: ["Variables & Types", "Operators", "Conditions", "Loops", "Functions", "Arrays", "Strings", "Pointers", "Memory", "Structures", "File I/O"],
    Python: ["Syntax & Variables", "Data Types", "Operators", "Conditions", "Loops", "Functions", "Strings", "Lists/Tuples/Dicts/Sets", "File I/O", "Exceptions", "OOP"],
    "C++": ["Basics", "References", "OOP", "STL Containers", "STL Algorithms"],
  };
  const list = subtopics[topic.language] || [];
  const currentIdx = list.findIndex((s) => topic.topic.toLowerCase().includes(s.toLowerCase()));
  return list[currentIdx + 1] || list[0] || "Next concept";
}

function getNextDSAPattern(dsaProgress: any[]): string {
  const roadmap = [
    "Time & Space Complexity",
    "Arrays",
    "Strings",
    "Searching",
    "Sorting",
    "Two Pointers",
    "Sliding Window",
    "Prefix Sum",
    "Hashing",
    "Recursion",
    "Backtracking",
    "Linked Lists",
    "Stack",
    "Queue",
    "Monotonic Stack/Queue",
    "Binary Trees",
    "BST",
    "Heap/Priority Queue",
    "Graphs",
    "Greedy",
    "Dynamic Programming",
  ];
  const masteredPatterns = dsaProgress
    .filter((d) => (d.mastery_level ?? 0) >= 4)
    .map((d) => d.pattern)
    .filter(Boolean);
  for (const pattern of roadmap) {
    if (!masteredPatterns.some((m) => m.toLowerCase().includes(pattern.toLowerCase()))) {
      return pattern;
    }
  }
  return "Dynamic Programming";
}