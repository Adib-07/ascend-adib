import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listAutomationLogs } from "@/lib/automation.functions";
import { format } from "date-fns";

const STATUS_STYLE: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-gray-100 text-gray-800",
};

interface AutomationLog {
  id: string;
  user_id: string;
  rule_id: string;
  status: string;
  trigger_data: unknown;
  condition_result: boolean | null;
  action_result: unknown;
  error_message: string | null;
  executed_at: string;
  execution_id: string | null;
}

export default function AutomationLogsView() {
  const listAutomationLogsFn = useServerFn(listAutomationLogs);
  const [filterRule, setFilterRule] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["automationLogs", filterRule],
    queryFn: () => listAutomationLogsFn({ data: { rule_id: filterRule ?? undefined } }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automation Logs</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-2">
            {logs?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No logs yet.</p>
            ) : (
              <ul className="divide-y">
                {logs?.map((log: AutomationLog) => (
                  <li key={log.id} className="py-3 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{log.rule_id}</p>
                        <Badge className={STATUS_STYLE[log.status]} variant="outline">
                          {log.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(log.executed_at).toLocaleString()}
                      </p>
                      {log.error_message && (
                        <p className="text-sm text-red-600">{log.error_message}</p>
                      )}
                    </div>
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
