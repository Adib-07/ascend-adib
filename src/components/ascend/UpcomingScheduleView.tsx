import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { runFullAutomationSweepFn } from "@/lib/event.dispatcher.functions";
import { format } from "date-fns";

export default function UpcomingScheduleView() {
  const runSweep = useServerFn(runFullAutomationSweepFn);
  const [sweepResult, setSweepResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSweep = async () => {
    setIsLoading(true);
    try {
      const result = await runFullAutomationSweepFn({ batchSize: 50, lookAheadMinutes: 60 });
      setSweepResult(result);
    } catch (e) {
      alert("Sweep failed: " + e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Upcoming Schedule</CardTitle>
        <Button onClick={handleSweep} disabled={isLoading}>
          Run Sweep Now
        </Button>
      </CardHeader>
      <CardContent>
        {sweepResult && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <p className="text-sm text-green-700">Scheduled Automations</p>
                  <p className="text-3xl font-bold text-green-900">{sweepResult.scheduled?.processedRules ?? 0}</p>
                  <p className="text-xs text-green-600">Executed: {sweepResult.scheduled?.executedAutomations ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="pt-6">
                  <p className="text-sm text-yellow-700">Reminders</p>
                  <p className="text-3xl font-bold text-yellow-900">{sweepResult.reminders?.processed ?? 0}</p>
                  <p className="text-xs text-yellow-600">Errors: {sweepResult.reminders?.errors?.length ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <p className="text-sm text-blue-700">Upcoming Events</p>
                  <p className="text-3xl font-bold text-blue-900">{sweepResult.upcomingEvents?.processed ?? 0}</p>
                  <p className="text-xs text-blue-600">Errors: {sweepResult.upcomingEvents?.errors?.length ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-6">
                  <p className="text-sm text-red-700">Overdue Tasks</p>
                  <p className="text-3xl font-bold text-red-900">{sweepResult.overdueTasks?.processed ?? 0}</p>
                  <p className="text-xs text-red-600">Errors: {sweepResult.overdueTasks?.errors?.length ?? 0}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}