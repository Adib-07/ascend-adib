import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { X, ChevronLeft, ChevronRight, Search, Filter, Settings, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

interface InspectorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  ref?: React.RefObject<HTMLAsideElement>;
}

interface InspectorTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const TABS: InspectorTab[] = [
  { id: "context", label: "Context", icon: <Search className="h-4 w-4" /> },
  { id: "related", label: "Related", icon: <Search className="h-4 w-4" /> },
  { id: "ai", label: "AI Suggestions", icon: <Search className="h-4 w-4" /> },
  { id: "upcoming", label: "Upcoming", icon: <Search className="h-4 w-4" /> },
] as const;

export function InspectorPanel({ isOpen, onClose, ref }: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState("context");

  return (
    <aside
      ref={ref}
      className={cn(
        "fixed right-0 top-0 z-50 h-screen bg-[var(--card)] border-l border-border transition-all duration-300 ease-out",
        isOpen ? "w-80 translate-x-0" : "-translate-x-full lg:w-80 lg:translate-x-0",
      )}
      style={{ boxShadow: "var(--shadow-lg)" }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between h-12 px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Tabs defaultValue="context" onValueChange={setActiveTab} className="flex-1">
              <TabsList className="bg-transparent p-0">
                {[
                  { id: "context", label: "Context" },
                  { id: "related", label: "Related" },
                  { id: "ai", label: "AI" },
                  { id: "upcoming", label: "Upcoming" },
                ].map((tab) => (
                  <TabsTrigger 
                    key={tab.id} 
                    value={tab.id} 
                    className="px-3 py-1.5 text-sm font-medium"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Close inspector"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <TabsContent value="context" className="h-full">
            <div className="p-4 space-y-4">
              <div className="text-sm text-muted-foreground">
                Contextual information for the current view will appear here.
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="related" className="h-full">
            <div className="p-4 space-y-4">
              <div className="text-sm text-muted-foreground">
                Related items and connections will appear here.
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="ai" className="h-full">
            <div className="p-4 space-y-4">
              <div className="text-sm text-muted-foreground">
                AI suggestions and insights will appear here.
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="upcoming" className="h-full">
            <div className="p-4 space-y-4">
              <div className="text-sm text-muted-foreground">
                Upcoming items and deadlines will appear here.
              </div>
            </div>
          </TabsContent>
        </div>
      </div>
    </aside>
  );
}