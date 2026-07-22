"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const DATE_RANGES = {
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
  all: { label: "All time", days: null },
} as const;

export type DateRangeKey = keyof typeof DATE_RANGES;

export function rangeToDates(key: DateRangeKey): { from?: Date; to?: Date } {
  const days = DATE_RANGES[key].days;
  if (days == null) return {};
  return { from: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
}

export function DateRangeFilter({ value, onChange }: { value: DateRangeKey; onChange: (v: DateRangeKey) => void }) {
  return (
    <Select
      items={Object.entries(DATE_RANGES).map(([value, r]) => ({ value, label: r.label }))}
      value={value}
      onValueChange={(v) => onChange((v as DateRangeKey) ?? "all")}
    >
      <SelectTrigger className="w-40">
        <SelectValue placeholder="All time" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(DATE_RANGES).map(([key, r]) => (
          <SelectItem key={key} value={key}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
