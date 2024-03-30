import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDashboardNavigate, useDashboardState } from "@/hooks";

export function DatePicker() {
  const handleUpdateURL = useDashboardNavigate();
  const { from } = useDashboardState();

  const date = from ? new Date(from) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !from && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onDayClick={(d) => handleUpdateURL({ from: toLocalIso(d) })}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function toLocalIso(date: Date) {
  const timezoneOffset = date.getTimezoneOffset() * 60000;

  // Subtract the timezone offset from the date's time
  const localTime = new Date(date.getTime() - timezoneOffset);

  // Convert to ISO string and remove the time portion
  return localTime.toISOString();
}
