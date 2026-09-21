"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
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

type CategoryFilter = { id: CatalogFilterId; label: string; thumbnail: string };

const groups: ReadonlyArray<{ label: string; filters: ReadonlyArray<CategoryFilter> }> = [
  { label: "Natural materials", filters: [
    { id: "wood", label: "Wood", thumbnail: "/material-references/wood-mopani.jpg" },
    { id: "plant", label: "Plants", thumbnail: "/material-references/plant-cryptocoryne-wendtii-green.jpg" },
    { id: "rock", label: "Rocks", thumbnail: "/render-assets/textures/fishy-rock-albedo.png" },
    { id: "fish", label: "Fishes", thumbnail: "/render-assets/fish-thumbnails/neon-tetra.png" },
  ] },
  { label: "Tank systems", filters: [
    { id: "substrate", label: "Substrate", thumbnail: "/category-previews/substrate.svg" },
    { id: "filter", label: "Filters", thumbnail: "/render-assets/filter-thumbnails/filter-fluval-207.png" },
    { id: "light", label: "Lighting", thumbnail: "/category-previews/lighting.svg" },
  ] },
];

const labelFor = (filter: CatalogFilterId) => filter === "all" ? "All materials" : groups.flatMap(group => group.filters).find(item => item.id === filter)?.label ?? filter;

export function CatalogFilter({ entries, value, onValueChange }: { entries: readonly CatalogEntry[]; value: CatalogFilterId; onValueChange: (value: CatalogFilterId) => void }) {
  const count = (filter: CatalogFilterId) => filter === "all" ? entries.length : entries.filter(entry => entry.kind === filter).length;

  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button className="catalog-filter-trigger" type="button" aria-label={`Material category: ${labelFor(value)}`}>
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span className="catalog-filter-trigger-label">{labelFor(value)}</span>
        <span className="catalog-filter-trigger-count">{count(value)}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="catalog-filter-menu" align="end" sideOffset={6} aria-label="Material filters">
      <DropdownMenuRadioGroup value={value} onValueChange={next => onValueChange(next as CatalogFilterId)}>
        <DropdownMenuRadioItem value="all" className="catalog-filter-item">All materials <span>{count("all")}</span></DropdownMenuRadioItem>
        {groups.map(group => <div key={group.label}>
          <DropdownMenuSeparator className="catalog-filter-separator" />
          <DropdownMenuLabel className="catalog-filter-label">{group.label}</DropdownMenuLabel>
          {group.filters.map(filter => <DropdownMenuRadioItem key={filter.id} value={filter.id} className="catalog-filter-item"><img className="catalog-filter-thumbnail" src={filter.thumbnail} alt="" aria-hidden="true" />{filter.label} <span>{count(filter.id)}</span></DropdownMenuRadioItem>)}
        </div>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
