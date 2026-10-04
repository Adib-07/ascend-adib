import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { listEvents } from "@/lib/event.functions";
import { format } from "date-fns";

export default function CalendarView() {
  const listEvents = useServerFn(listEvents);
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { data: events, isLoading } = listEvents();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" /> Calendar
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setView("month")}>
            Month
          </Button>
          <Button variant="outline" size="sm" onClick={() => setView("week")}>
            Week
          </Button>
          <Button variant="outline" size="sm" onClick={() => setView("day")}>
            Day
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading events...</p>
        ) : (
          <div className="space-y-2">
            {events?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No events yet.</p>
            ) : (
              <ul className="divide-y">
                {events?.map((ev) => (
                  <li key={ev.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{ev.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(ev.start_at), "MMM d, yyyy h:mm a")} –{" "}
                        {format(new Date(ev.end_at), "h:mm a")}
                        {ev.location && ` • ${ev.location}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
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
