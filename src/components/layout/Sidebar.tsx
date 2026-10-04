import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Home,
  Calendar,
  Clock,
  Target,
  BookOpen,
  CheckSquare,
  Zap,
  FileText,
  Brain,
  Settings,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Bell,
  User,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: string;
  onNavigate: (view: string) => void;
}

const NAV_ITEMS = [
  { id: "today", label: "Today", icon: Sun, shortcut: "1" },
  { id: "tasks", label: "Tasks", icon: CheckSquare, shortcut: "2" },
  { id: "calendar", label: "Calendar", icon: Calendar, shortcut: "3" },
  { id: "reminders", label: "Reminders", icon: Bell, shortcut: "4" },
  { id: "habits", label: "Habits", icon: Target, shortcut: "5" },
  { id: "projects", label: "Projects", icon: BookOpen, shortcut: "6" },
  { id: "goals", label: "Goals", icon: Target, shortcut: "7" },
  { id: "knowledge", label: "Knowledge", icon: Brain, shortcut: "8" },
  { id: "documents", label: "Documents", icon: FileText, shortcut: "9" },
  { id: "academics", label: "Academics", icon: Brain, shortcut: "0" },
  { id: "automations", label: "Automations", icon: Zap, shortcut: "a" },
] as const;

export function Sidebar({ isOpen, onClose, currentView, onNavigate }: SidebarProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 h-screen bg-[var(--card)] border-r border-border transition-all duration-300 ease-out",
        isOpen ? "w-72 translate-x-0" : "-translate-x-full lg:w-72 lg:translate-x-0",
        isCollapsed && "w-16",
      )}
      style={{ boxShadow: "var(--shadow-lg)" }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-border">
          {!isCollapsed && <h1 className="font-serif text-xl text-primary font-medium">Ascend</h1>}
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", isCollapsed && "ml-auto")}
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-2 py-2">
          <nav className="space-y-1" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    isCollapsed && "justify-center px-2",
                  )}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onNavigate(item.id);
                      onClose();
                    }
                  }}
                  title={isCollapsed ? item.label : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {!isCollapsed && (
                    <kbd className="text-[10px] font-mono text-muted-foreground/50 px-1.5 py-0.5 rounded">
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="space-y-2">
            <Button
              variant="ghost"
              className={cn("w-full justify-start gap-3", isCollapsed && "justify-center px-2")}
              onClick={() => {
                onNavigate("settings");
                onClose();
              }}
            >
              <Settings className="h-4 w-4" />
              {!isCollapsed && <span>Settings</span>}
            </Button>
            <div className="flex items-center gap-2 px-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  /* theme toggle */
                }}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {!isCollapsed && user && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{user.email}</p>
                  <p className="text-[10px] text-muted-foreground">Signed in</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
