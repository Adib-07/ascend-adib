import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  Command as CmdIcon,
  Plus,
  Bell,
  Settings,
  User,
  LogOut,
  ChevronDown,
  Zap,
  FileText,
  Calendar,
  Target,
  Brain,
  Command as CmdIcon2,
  Sun,
  Moon,
  Bell,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { CommandPalette } from "@/components/ascend/CommandPalette";

interface TopBarProps {
  onSearch: () => void;
  onQuickCapture: () => void;
  onNewAutomation: () => void;
  onNewTask: () => void;
  onNewEvent: () => void;
  onNewDocument: () => void;
}

export function TopBar({
  onSearch,
  onQuickCapture,
  onNewAutomation,
  onNewTask,
  onNewEvent,
  onNewDocument,
}: TopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(event.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border/60 backdrop-blur-sm bg-[var(--card)]/95">
      <div className="mx-auto max-w-screen-2xl px-4 h-full flex items-center justify-between gap-4">
        {/* Left: Global Search */}
        <div className="flex-1 max-w-xl">
          <button
            onClick={onSearch}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/50 border border-border/50 text-sm text-muted-foreground hover:bg-accent transition-all duration-200 group"
            aria-label="Global search"
          >
            <Search className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground" />
            <span className="text-muted-foreground group-hover:text-foreground">Search...</span>
            <kbd className="ml-auto text-[10px] font-mono text-muted-foreground/50 px-1.5 py-0.5 rounded">
              <CmdIcon2 className="h-3 w-3" />K
            </kbd>
          </button>
        </div>

        {/* Center: Quick Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={onQuickCapture}
            aria-label="Quick capture"
          >
            <Plus className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={onNewTask}
            aria-label="New task"
          >
            <FileText className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={onNewEvent}
            aria-label="New event"
          >
            <Calendar className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={onNewAutomation}
            aria-label="New automation"
          >
            <Zap className="h-5 w-5" />
          </Button>
        </div>

        {/* Right: Theme, Notifications, Profile */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>

          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 relative"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold flex items-center justify-center">
                3
              </span>
            </Button>
          </div>

          {/* Avatar Menu */}
          <div className="relative" ref={avatarRef}>
            <Button
              variant="ghost"
              className="h-10 w-10 rounded-full p-0"
              onClick={() => setAvatarOpen(!avatarOpen)}
              aria-label="Account menu"
            >
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
            </Button>
            {avatarOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAvatarOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[var(--card)] border border-border shadow-lg py-1 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-[10px] tracking-widest uppercase text-muted-foreground">
                      Account
                    </p>
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                  </div>
                  <div className="px-1">
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-accent text-foreground">
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-accent text-foreground">
                      <User className="h-4 w-4" />
                      Profile
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-accent text-destructive"
                      onClick={() => {
                        signOut().catch(() => {});
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
