import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listReminders, dismissReminder } from "@/lib/reminder.functions";
import { Check, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  sent: "bg-green-100 text-green-800",
  dismissed: "bg-gray-100 text-gray-800",
  failed: "bg-red-100 text-red-800",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  sent: <CheckCircle2 className="h-3 w-3" />,
  dismissed: <Check className="h-3 w-3" />,
  failed: <AlertCircle className="h-3 w-3" />,
};

const FILTER_TABS = ["today", "upcoming", "overdue", "completed"] as const;

export default function RemindersView() {
  const listReminders = useServerFn(listReminders);
  const dismissReminderFn = useServerFn(dismissReminder);
  const [filter, setFilter] = useState<"today" | "upcoming" | "overdue" | "completed" | "all">("all");
  const { data: reminders, isLoading, refetch } = listReminders({ status: filter === "all" ? undefined : filter });

  const handleDismiss = async (id: string) => {
    await dismissReminderFn({ id });
    refetch();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">Reminders</CardTitle>
        <div className="flex gap-1">
          {FILTER_TABS.map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>Loading reminders...</p> : (
          <div className="space-y-2">
            {reminders?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No reminders.</p>
            ) : (
              <ul className="divide-y">
                {reminders?.map((rem) => (
                  <li key={rem.id} className="py-3 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{rem.title}</p>
                        <Badge className={STATUS_STYLE[rem.status]} variant="outline">
                          {STATUS_ICON[rem.status]} {rem.status}
                        </Badge>
                      </div>
                      {rem.message && <p className="text-sm text-muted-foreground">{rem.message}</p>}
                      <p className="text-xs text-muted-foreground">
                        Due: {new Date(rem.trigger_at).toLocaleString()}
                      </p>
                    </div>
                    {rem.status === "pending" && (
                      <Button variant="ghost" size="sm" onClick={() => handleDismiss(rem.id)}>
                        Dismiss
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}