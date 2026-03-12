"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Search } from "lucide-react";

export interface FilterValues {
  businessUnit?: string;
  projectName?: string;
  yahooPoC?: string;
  status?: string;
  search?: string;
}

interface FilterBarProps {
  filters: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
  projectNames?: string[];
  yahooPocs?: string[];
  showStatus?: boolean;
  statusOptions?: { value: string; label: string }[];
}

const businessUnits = [
  { value: "MAIL", label: "Mail" },
  { value: "HOME_ECO", label: "Home Eco" },
  { value: "PARANOIDS", label: "Paranoids" },
  { value: "SPORTS", label: "Sports" },
  { value: "OTHER", label: "Other" },
];

const defaultStatusOptions = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "FUTURE_NEED", label: "Future Need" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function FilterBar({
  filters,
  onFilterChange,
  projectNames = [],
  yahooPocs = [],
  showStatus = true,
  statusOptions = defaultStatusOptions,
}: FilterBarProps) {
  const hasFilters =
    filters.businessUnit ||
    filters.projectName ||
    filters.yahooPoC ||
    filters.status ||
    filters.search;

  const updateFilter = (key: keyof FilterValues, value: string | undefined) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearAll = () => {
    onFilterChange({});
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={filters.search ?? ""}
          onChange={(e) => updateFilter("search", e.target.value || undefined)}
          className="pl-8"
        />
      </div>

      <Select
        value={filters.businessUnit ?? ""}
        onValueChange={(val) => updateFilter("businessUnit", val || undefined)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Business Unit" />
        </SelectTrigger>
        <SelectContent>
          {businessUnits.map((bu) => (
            <SelectItem key={bu.value} value={bu.value}>
              {bu.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {projectNames.length > 0 && (
        <Select
          value={filters.projectName ?? ""}
          onValueChange={(val) => updateFilter("projectName", val || undefined)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            {projectNames.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {yahooPocs.length > 0 && (
        <Select
          value={filters.yahooPoC ?? ""}
          onValueChange={(val) => updateFilter("yahooPoC", val || undefined)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Yahoo POC" />
          </SelectTrigger>
          <SelectContent>
            {yahooPocs.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showStatus && (
        <Select
          value={filters.status ?? ""}
          onValueChange={(val) => updateFilter("status", val || undefined)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 px-2">
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
