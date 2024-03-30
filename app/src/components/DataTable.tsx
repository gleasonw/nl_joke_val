import { useEmoteGrowth, useLiveStatus } from "@/hooks";
import React from "react";
import { EmotePerformance } from "@/types";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";

export interface DataTableProps {
  children?: React.ReactNode;
  className?: string;
}

const columns: ColumnDef<EmotePerformance>[] = [
  {
    header: "Emote",
    accessorKey: "Code",
  },
  {
    accessorKey: "Count",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Sum
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    header: "Average sum (three months)",
    accessorKey: "Average",
  },
  {
    accessorKey: "PercentDifference",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Percent Difference
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const { PercentDifference } = row.original;
      const trend = PercentDifference > 0 ? "up" : "down";
      return (
        <div className="flex items-center gap-1">
          <span
            data-trend={trend}
            className={clsx("rounded p-3", {
              "text-green-500": trend === "up",
              "bg-green-100": trend === "up",
              "text-red-500": trend === "down",
              "bg-red-100": trend === "down",
            })}
          >
            {Math.round(PercentDifference)}%
          </span>
        </div>
      );
    },
  },
];

// the intuitive code, ?? [], creates a new array every render
// causing react to explode
const emptyArray = [] as EmotePerformance[];

export function DataTable() {
  const { data } = useEmoteGrowth();
  const [sortingState, setSortingState] = React.useState<SortingState>([]);
  const table = useReactTable({
    data: data?.Emotes ?? emptyArray,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSortingState,
    state: {
      sorting: sortingState,
    },
  });

  return (
    <div className="rounded-md border">
      <DataTableTitle />
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <Link
                      to="/"
                      search={(prev) => ({
                        ...prev,
                        focusedEmote: row.original.EmoteID,
                      })}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </Link>
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>{" "}
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function DataTableTitle() {
  const { data } = useEmoteGrowth();
  const grouping = data?.Input?.Grouping;
  const { data: isNlLive } = useLiveStatus();

  if (data?.Input && "Date" in data.Input) {
    return (
      <CardTitle>
        {new Date(data?.Input?.Date).toLocaleDateString()}
        <span className="ml-2 text-xs"> binned by {grouping}</span>
      </CardTitle>
    );
  }

  if (isNlLive) {
    return <CardTitle>Live counts grouped by {grouping}</CardTitle>;
  }

  return <CardTitle>binned by {data?.Input?.Grouping}</CardTitle>;
}
