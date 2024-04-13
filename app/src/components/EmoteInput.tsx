import { useEmotes, useSeriesState } from "../hooks";
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { EmoteImage } from "@/components/TopPerformingEmotes";

export function EmoteInput() {
  const { data: emotes } = useEmotes();
  const [, handleUpdateSeries] = useSeriesState();
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredEmotes = emotes?.filter((e) =>
    e.Code.toLowerCase().includes(searchTerm.toLowerCase()),
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
          Search tracked emotes
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Input
          placeholder="Search emote..."
          className="w-full"
          value={searchTerm}
          onInput={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
        />
        <div className="flex max-h-60 flex-col overflow-y-auto">
          {filteredEmotes?.map((e) => (
            <Button
              key={e.Code}
              value={e.Code}
              variant="ghost"
              onClick={() => {
                handleUpdateSeries(e.ID);
                setOpen(false);
              }}
            >
              <EmoteImage emote={e} />
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
