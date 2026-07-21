"use client";

import { ArrowDownAZ, ArrowUpAZ, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  sortDir,
  onSortDirChange,
  sortLabel = "Date",
  descLabel = "Newest",
  ascLabel = "Oldest",
  right,
}: {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  sortDir: "asc" | "desc";
  onSortDirChange: (v: "asc" | "desc") => void;
  sortLabel?: string;
  descLabel?: string;
  ascLabel?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {onSearchChange ? (
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-2">
        {right}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSortDirChange(sortDir === "desc" ? "asc" : "desc")}
        >
          {sortDir === "desc" ? <ArrowDownAZ className="size-3.5" /> : <ArrowUpAZ className="size-3.5" />}
          {sortLabel}: {sortDir === "desc" ? descLabel : ascLabel}
        </Button>
      </div>
    </div>
  );
}

export function ListPagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        {total} total · page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
