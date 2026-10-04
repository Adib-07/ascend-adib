import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listAutomationRules, executeManualAutomation, evaluateAutomationRule } from "@/lib/automation.functions";
import { Plus, Play, Eye, Zap, Trash2 } from "lucide-react";

export default function AutomationsView() {
  const listAutomations = useServerFn(listAutomationRules);
  const executeManual = useServerFn(executeManualAutomation);
  const evaluateRule = useServerFn(evaluateAutomationRule);
  const [rules, isLoading] = listAutomations();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleRun = async (ruleId: string) => {
    const result = await executeManual({ ruleId });
    if (!result.success) alert(result.error || "Failed");
  };

  const handleEvaluate = async (ruleId: string) => {
    const evalResult = await evaluateRule({ ruleId });
    alert(`Should execute: ${evalResult.shouldExecute}\nReason: ${evalResult.reason}`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">Automations</CardTitle>
        <Button onClick={() => setEditingId(null)}>New Automation</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>Loading...</p> : (
          <>
            {rules?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No automations yet.</p>
            ) : (
              <div className="space-y-3">
                {rules?.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg bg-[var(--card)]">
                    <div className="flex items-center gap-3">
                      <Badge variant={rule.enabled ? "default" : "secondary"}>{rule.enabled ? "Enabled" : "Disabled"}</Badge>
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-sm text-muted-foreground">{rule.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Trigger: {rule.trigger_type} • Action: {rule.action_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleRun(rule.id)} title="Run now">
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEvaluate(rule.id)} title="Evaluate">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Edit">
                        <Zap className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        </CardContent>
      </Card>
    );
  }
