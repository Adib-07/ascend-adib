import { useState, useMemo, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import {
  Sun,
  Calendar,
  Clock,
  Target,
  CheckSquare,
  BookOpen,
  Zap,
  FileText,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Bookmark,
  Flame,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTasks, todayISO } from "@/lib/ascend-data";
import { useExams } from "@/lib/ascend-hooks";
import { useHabits, useHabitLogs } from "@/lib/ascend-hooks";
import { useGoals } from "@/lib/ascend-hooks";
import { useProjects } from "@/lib/ascend-hooks";
import { getExamIntelligence } from "@/lib/exam.intelligence";
import { getWeakAreas } from "@/lib/weak.area";
import { getDailyBriefing } from "@/lib/briefing.functions";
import { getStudentProfile } from "@/lib/student.profile.functions";
import { format, differenceInDays, addDays } from "date-fns";

interface Task {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  done: boolean;
  type: string;
}

interface Habit {
  id: string;
  name: string;
  streak: number;
  category: string | null;
}

interface Goal {
  id: string;
  text: string;
  scope: string;
  deadline: string | null;
  done: boolean;
}

interface Project {
  id: string;
  name: string;
  status: string;
  progress: number;
  deadline: string | null;
  project_type: "academic" | "work";
}

interface Exam {
  id: string;
  name: string;
  subject: string | null;
  exam_date: string | null;
  prep_status: string;
}

interface WeakArea {
  topicId: string;
  topic: string;
  subject: string | null;
  progress: number;
  signals: string[];
  severity: "LOW" | "MEDIUM" | "HIGH";
  suggestedAction: string;
}

interface DailyBriefingData {
  overdue_tasks: any[];
  today_tasks: any[];
  today_events: any[];
  today_habits: any[];
  upcoming_deadlines: any[];
  active_projects: any[];
  daily_intention: string | null;
}

interface ExamIntelligence {
  examId: string;
  name: string;
  subject: string | null;
  examDate: string | null;
  daysRemaining: number | null;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  totalTopics: number;
  completedTopics: number;
  incompleteTopics: string[];
  studyWorkloadMinutes: number;
  revisionStatus: "NOT_STARTED" | "IN_PROGRESS" | "READY";
}

interface WeakArea {
  topicId: string;
  topic: string;
  subject: string | null;
  progress: number;
  signals: string[];
  severity: "LOW" | "MEDIUM" | "HIGH";
  suggestedAction: string;
}

export default function TodayView() {
  const [date, setDate] = useState(new Date());

  // Data fetching
  const tasksQ = useTasks();
  const examsQ = useExams();
  const habitsQ = useHabits();
  const habitsLogsQ = useHabitLogs(
    new Date().toISOString().split("T")[0],
    new Date(Date.now() + 6 * 86400000).toISOString().split("T")[0],
  );
  const goalsQ = useGoals();
  const projectsQ = useProjects();
  const examsIntelligenceQ = useServerFn(getExamIntelligence);
  const weakAreasQ = useServerFn(getWeakAreas);
  const dailyBriefingQ = useServerFn(getDailyBriefing);
  const studentProfileQ = useServerFn(getStudentProfile);

  const today = todayISO();
  const todayDate = new Date();

  // Computed values
  const tasks = tasksQ.data ?? [];
  const habits = habitsQ.list.data ?? [];
  const habitLogs = habitsLogsQ.data ?? [];
  const goals = goalsQ.list.data ?? [];
  const projects = projectsQ.list.data ?? [];
  const exams = examsQ.list.data ?? [];
  const dailyBriefing = dailyBriefingQ.data;

  const todayStr = todayISO();
  const todayDate = new Date();

  // Today's tasks
  const todayTasks = tasks.filter((t) => !t.done && t.due_date === todayStr);
  const overdueTasks = tasks.filter((t) => !t.done && t.due_date && t.due_date < todayStr);
  const upcomingTasks = tasks
    .filter((t) => !t.done && t.due_date && t.due_date > todayStr)
    .slice(0, 5);

  // Today's habits
  const todayHabitLogs = habitLogs.filter((l) => l.day === todayStr);
  const completedHabitsToday = todayHabitLogs.filter((l) => l.done).length;
  const totalHabits = habits.length;

  // Upcoming exams with intelligence
  const upcomingExams = exams
    .filter((e) => e.exam_date && new Date(e.exam_date) >= new Date())
    .sort((a, b) => new Date(a.exam_date!).getTime() - new Date(b.exam_date!).getTime())
    .slice(0, 3);

  // Active goals
  const activeGoals = goals.filter((g) => !g.done).slice(0, 3);

  // Active projects
  const activeProjects = projects
    .filter((p) => p.status !== "Done" && p.status !== "Completed")
    .slice(0, 3);

  // Today's habit progress
  const completedHabitsToday = todayHabitLogs.filter((l) => l.done).length;
  const totalHabits = habits.length;

  // Today's task progress
  const completedTasksToday = tasks.filter((t) => t.done && t.due_date === todayStr).length;
  const totalTasksToday = tasks.filter((t) => t.due_date === todayStr).length;
  const taskProgress =
    totalTasksToday > 0 ? Math.round((completedTasksToday / totalTasksToday) * 100) : 0;

  // Daily intention
  const dailyIntention = dailyBriefing?.daily_intention;

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const userName = "User";

  return (
    <div className="h-full overflow-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl text-primary font-medium">
            {greeting}, {userName}
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">{format(new Date(), "EEEE, MMMM d")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-sm font-medium bg-primary/10 text-primary rounded-full">
            {habitProgress}% Habits • {taskProgress}% Tasks
          </span>
        </div>
      </div>

      {/* Top Row: Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Tasks Today"
          value={`${completedTasksToday}/${totalTasksToday}`}
          subtitle={`${taskProgress}% complete`}
          icon={<CheckSquare className="h-5 w-5" />}
          trend={taskProgress > 50 ? "+" : taskProgress > 0 ? "~" : ""}
          trendColor="green"
        />
        <MetricCard
          title="Habits"
          value={`${completedHabitsToday}/${totalHabits}`}
          subtitle={`${habitProgress}% complete`}
          icon={<Target className="h-5 w-5" />}
          trend={habitProgress > 50 ? "+" : habitProgress > 0 ? "~" : ""}
          trendColor="green"
        />
        <MetricCard
          title="Focus Sessions"
          value={focusSessionsToday}
          subtitle="Deep work today"
          icon={<Flame className="h-5 w-5" />}
          trend="+"
          trendColor="amber"
        />
        <MetricCard
          title="Upcoming Exams"
          value={upcomingExams.length}
          subtitle={
            upcomingExams.length > 0 ? `${upcomingExams[0]?.daysRemaining ?? 0} days` : "None"
          }
          icon={<Calendar className="h-5 w-5" />}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column - Main Focus */}
        <div className="lg:col-span-7 space-y-6">
          {/* Today's Focus */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5 text-amber-500" />
                Today's Focus
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Daily Intention */}
              {dailyIntention && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Bookmark className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-900">Today's Intention</p>
                      <p className="text-amber-800">{dailyIntention}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Today's Tasks */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Today's Tasks</h3>
                  {totalTasksToday > 0 && <Progress value={taskProgress} className="w-32 h-2" />}
                </div>
                {todayTasks.length > 0 ? (
                  <ul className="space-y-2">
                    {todayTasks.slice(0, 5).map((task) => (
                      <li
                        key={task.id}
                        className="flex items-center gap-3 p-3 bg-accent/30 rounded-xl group"
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => {}}
                        >
                          <CheckCircle2 className="h-5 w-5 text-muted-foreground group-hover:text-green-500" />
                        </Button>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                task.priority === "High" && "bg-red-100 text-red-700",
                                task.priority === "Medium" && "bg-amber-100 text-amber-700",
                                task.priority === "Low" && "bg-green-100 text-green-700",
                              )}
                            >
                              {task.priority}
                            </span>
                            {task.type && (
                              <span className="text-muted-foreground">• {task.type}</span>
                            )}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-center py-6">
                    No tasks scheduled for today. Enjoy the freedom!
                  </p>
                )}
              </div>

              {/* Upcoming Exams */}
              {upcomingExams.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">Upcoming Exams</h3>
                  <div className="space-y-2">
                    {upcomingExams.map((exam) => (
                      <div key={exam.id} className="p-3 bg-accent/30 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{exam.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {exam.subject} •{" "}
                              {exam.exam_date
                                ? format(new Date(exam.exam_date), "MMM d")
                                : "No date"}
                            </p>
                          </div>
                          <Badge
                            variant={
                              exam.priority === "CRITICAL"
                                ? "destructive"
                                : exam.priority === "HIGH"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {exam.priority}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weak Areas */}
              {weakAreas && weakAreas.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">Areas Needing Attention</h3>
                  <div className="space-y-2">
                    {weakAreas.slice(0, 3).map((area) => (
                      <div
                        key={area.topicId}
                        className="p-3 bg-red-50 border border-red-200 rounded-xl"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-red-900">{area.topic}</p>
                            <p className="text-sm text-red-700">
                              {area.subject} • {area.progress}% complete
                            </p>
                            <p className="text-xs text-red-600 mt-1">{area.signals.join(" • ")}</p>
                          </div>
                          <Badge variant={area.severity === "HIGH" ? "destructive" : "default"}>
                            {area.severity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                <QuickActionButton
                  icon={<Plus className="h-5 w-5" />}
                  label="New Task"
                  onClick={() => {}}
                />
                <QuickActionButton
                  icon={<Calendar className="h-5 w-5" />}
                  label="New Event"
                  onClick={() => {}}
                />
                <QuickActionButton
                  icon={<Target className="h-5 w-5" />}
                  label="Log Habit"
                  onClick={() => {}}
                />
                <QuickActionButton
                  icon={<Zap className="h-5 w-5" />}
                  label="Run Automation"
                  onClick={() => {}}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar Info */}
        <div className="lg:col-span-5 space-y-6">
          {/* Upcoming Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-muted-foreground text-center py-6">No upcoming events</p>
              </div>
            </CardContent>
          </Card>

          {/* Active Goals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Active Goals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeGoals.length > 0 ? (
                <div className="space-y-3">
                  {activeGoals.map((goal) => (
                    <div key={goal.id} className="p-3 bg-accent/30 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{goal.text}</p>
                          <p className="text-xs text-muted-foreground">
                            {goal.scope} •{" "}
                            {goal.deadline
                              ? format(new Date(goal.deadline), "MMM d")
                              : "No deadline"}
                          </p>
                        </div>
                        <Badge variant={goal.done ? "secondary" : "default"}>
                          {goal.done ? "Done" : "Active"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-6">No active goals</p>
              )}
            </CardContent>
          </Card>

          {/* Active Projects */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Active Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeProjects.length > 0 ? (
                <div className="space-y-3">
                  {activeProjects.map((project) => (
                    <div key={project.id} className="p-3 bg-accent/30 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{project.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {project.status} •{" "}
                            {project.deadline
                              ? format(new Date(project.deadline), "MMM d")
                              : "No deadline"}
                          </p>
                          <Progress value={project.progress} className="w-full h-1.5 mt-2" />
                        </div>
                        <Badge variant={project.progress === 100 ? "secondary" : "default"}>
                          {project.progress}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-6">No active projects</p>
              )}
            </CardContent>
          </Card>

          {/* Weak Areas Alert */}
          {weakAreas && weakAreas.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-900">
                  <AlertCircle className="h-5 w-5" />
                  Areas Needing Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {weakAreas.slice(0, 2).map((area) => (
                    <div
                      key={area.topicId}
                      className="p-3 bg-white border border-red-200 rounded-xl"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-red-900">{area.topic}</p>
                          <p className="text-xs text-red-700">
                            {area.subject} • {area.progress}% complete
                          </p>
                          <p className="text-[10px] text-red-600 mt-1">
                            {area.signals.join(" • ")}
                          </p>
                        </div>
                        <Badge variant={area.severity === "HIGH" ? "destructive" : "default"}>
                          {area.severity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Components
function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendColor,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend?: string;
  trendColor?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold font-serif mt-1">{value}</p>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className="p-3 bg-primary/10 rounded-xl">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button variant="outline" onClick={onClick} className="h-20 flex-col gap-2">
      <span className="text-2xl">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </Button>
  );
}

// Helper
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const userName = "User";
