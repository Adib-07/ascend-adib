import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { InspectorPanel } from "./InspectorPanel";
import { CommandPalette } from "@/components/ascend/CommandPalette";
import { NotificationPanel } from "@/components/ascend/NotificationPanel";
import { FocusMode } from "@/components/ascend/FocusMode";
import { PWAInstallBanner } from "@/components/ascend/PWAInstallBanner";
import { OfflineBar } from "@/components/ascend/OfflineBar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [currentView, setCurrentView] = useState("today");
  const [focusSessionsToday, setFocusSessionsToday] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const sidebarRef = useRef<HTMLAsideElement>(null);
  const inspectorRef = useRef<HTMLAsideElement>(null);

  const handleNavigate = (view: string) => {
    setCurrentView(view);
  };

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setSidebarOpen(false);
        setInspectorOpen(false);
      }
      if (e.metaKey && e.key === "b") {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
      if (e.metaKey && e.shiftKey && e.key === "i") {
        e.preventDefault();
        setInspectorOpen(!inspectorOpen);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen, inspectorOpen]);

  // Handle outside clicks for sidebar/inspector on mobile
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      // Close sidebar on mobile when clicking outside
      if (window.innerWidth < 1024 && sidebarOpen && !sidebarRef.current?.contains(event.target as Node)) {
        setSidebarOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sidebarOpen]);

  const handleSearch = () => setPaletteOpen(true);
  const handleQuickCapture = () => { /* TODO: implement */ };
  const handleNewAutomation = () => { /* TODO */ };
  const handleNewTask = () => { /* TODO */ };
  const handleNewEvent = () => { /* TODO */ };
  const handleNewDocument = () => { /* TODO */ };

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <OfflineBar />
      <PWAInstallBanner />
      
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentView="today"
        onNavigate={() => {}}
        ref={sidebarRef}
      />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Top Bar */}
      <TopBar
        onSearch={() => {}}
        onQuickCapture={() => {}}
        onNewAutomation={() => {}}
        onNewTask={() => {}}
        onNewEvent={() => {}}
        onNewDocument={() => {}}
      />

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 overflow-hidden transition-all duration-300",
        "lg:ml-72"
      )}>
        <main 
          role="main" 
          className={cn(
            "h-[calc(100vh-3.5rem)] overflow-auto transition-all duration-300",
            "lg:ml-0"
          )}
        >
          {children}
        </main>

        {/* Right Inspector Panel */}
        <InspectorPanel
          isOpen={inspectorOpen}
          onClose={() => setInspectorOpen(false)}
          ref={inspectorRef}
        />
      </div>

      {/* Mobile inspector overlay */}
      {inspectorOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setInspectorOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Command Palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={() => {}}
        quickActions={[]}
      />

      {/* Notifications */}
      <NotificationPanel
        open={false}
        onClose={() => {}}
        notifications={[]}
        onMarkAllRead={() => {}}
        onDismiss={() => {}}
      />

      {/* Focus Mode */}
      <FocusMode open={focusOpen} onClose={() => setFocusOpen(false)} />

      {/* PWA Install Banner */}
      <PWAInstallBanner />
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}