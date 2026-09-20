"use client";

import { Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CatalogEntry, CatalogKind } from "@/lib/catalog-types";

export type CatalogFilterId = "all" | CatalogKind;

const groups: ReadonlyArray<{ label: string; filters: ReadonlyArray<{ id: CatalogFilterId; label: string }> }> = [
  { label: "Natural materials", filters: [{ id: "rock", label: "Rocks" }, { id: "plant", label: "Plants" }, { id: "wood", label: "Wood" }] },
  { label: "Tank systems", filters: [{ id: "substrate", label: "Substrate" }, { id: "filter", label: "Filters" }, { id: "light", label: "Lighting" }] },
];

const labelFor = (filter: CatalogFilterId) => filter === "all" ? "All materials" : groups.flatMap(group => group.filters).find(item => item.id === filter)?.label ?? filter;

export function CatalogFilter({ entries, value, onValueChange }: { entries: readonly CatalogEntry[]; value: CatalogFilterId; onValueChange: (value: CatalogFilterId) => void }) {
  const count = (filter: CatalogFilterId) => filter === "all" ? entries.length : entries.filter(entry => entry.kind === filter).length;

  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button className="catalog-filter-trigger" type="button" aria-label={`Filter materials: ${labelFor(value)}`} title="Filter materials">
        <Filter size={17} aria-hidden="true" />
        <span className="sr-only">Filter materials</span>
        {value !== "all" && <span className="catalog-filter-active" aria-hidden="true" />}
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="catalog-filter-menu" align="end" sideOffset={6} aria-label="Material filters">
      <DropdownMenuRadioGroup value={value} onValueChange={next => onValueChange(next as CatalogFilterId)}>
        <DropdownMenuRadioItem value="all" className="catalog-filter-item">All materials <span>{count("all")}</span></DropdownMenuRadioItem>
        {groups.map(group => <div key={group.label}>
          <DropdownMenuSeparator className="catalog-filter-separator" />
          <DropdownMenuLabel className="catalog-filter-label">{group.label}</DropdownMenuLabel>
          {group.filters.map(filter => <DropdownMenuRadioItem key={filter.id} value={filter.id} className="catalog-filter-item">{filter.label} <span>{count(filter.id)}</span></DropdownMenuRadioItem>)}
        </div>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
