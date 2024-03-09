import { useEmotes, useSeriesState } from "../hooks";
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";

export function EmoteInput() {
  const { data: emotes } = useEmotes();
  const [series, handleUpdateSeries] = useSeriesState();
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredEmotes = emotes?.filter((e) =>
    e.Code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          {emotes
            ? emotes?.find((e) => series?.includes(e.Code))?.Code
            : "Select framework..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Input
          placeholder="Search emote..."
          className="w-full"
          value={searchTerm}
          onInput={(e) => setSearchTerm(e.target.value)}
        />
        <div className="flex flex-col max-h-60 overflow-y-auto">
          {filteredEmotes?.map((e) => (
            <Button
              key={e.Code}
              value={e.Code}
              variant="ghost"
              onClick={() => {
                handleUpdateSeries(e.Code);
                setOpen(false);
              }}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  series?.includes(e.Code) ? "opacity-100" : "opacity-0"
                )}
              />
              {e.Code}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
