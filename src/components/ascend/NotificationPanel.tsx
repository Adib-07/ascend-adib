import { Bell, X, CheckCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/notifications";

const TYPE_ICONS: Record<AppNotification["type"], string> = {
  "task-due": "📋",
  overdue: "🔴",
  habit: "✅",
  exam: "📚",
  streak: "🔥",
  info: "ℹ️",
};

type Props = {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
};

export default function NotificationPanel({ open, onClose, notifications, onMarkAllRead, onDismiss }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest?.("[data-notif-toggle]")) return;
      if (panelRef.current && !panelRef.current.contains(target)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-11 w-80 max-w-[92vw] bg-[var(--card)] border border-border rounded-2xl shadow-[var(--shadow-lg)] z-[100] overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-primary" />
          <span className="font-medium text-sm text-foreground">Notifications</span>
          {unread > 0 && (
            <span className="text-[10px] bg-[var(--destructive)] text-[var(--destructive-foreground)] px-1.5 py-0.5 rounded-full font-bold">
              {unread}
            </span>
          )}
        </div>
        {notifications.length > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-xs text-[var(--gold)] hover:text-primary font-medium flex items-center gap-1"
          >
            <CheckCheck size={12} /> Mark all read
          </button>
        )}
      </div>

      <div className="max-h-[320px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <span className="text-3xl">✓</span>
            <p className="font-serif text-foreground font-medium">All caught up</p>
            <p className="text-xs text-muted-foreground">No new notifications</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex gap-3 px-4 py-3 border-b border-border/60 hover:bg-secondary/50 transition-colors",
                !n.read && "bg-[var(--gold)]/5",
              )}
            >
              <span className="text-lg flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type]}</span>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm text-foreground",
                    !n.read && "font-medium",
                    n.urgent && "text-[var(--destructive)]",
                  )}
                >
                  {n.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.subtitle}</p>
              </div>
              <button
                onClick={() => onDismiss(n.id)}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                aria-label="Dismiss"
              >
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
