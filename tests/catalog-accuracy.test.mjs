import {test} from "node:test";
import assert from "node:assert/strict";
import {catalogExpansion} from "../lib/catalog-expansion.ts";

const entry=id=>{const found=catalogExpansion.find(candidate=>candidate.id===id);assert(found,`missing ${id}`);return found;};

test("Fluval sources resolve to their matching product SKU pages",()=>{
  for(const model of ["207","307","407"]){const product=entry(`filter-fluval-${model}`);assert.match(product.source.url,new RegExp(`/product/${model}-canister-filter-`));}
  for(const watts of [12,18,27,35]){const product=entry(`light-fluval-aquasky-${watts}`);assert.match(product.source.url,new RegExp(`/product/aquasky-3-0-led-${watts}w-`));assert(!product.source.url.includes("replacement-parts"));}
});

test("ADA Aquasky preserves rated power while using bounded rendering inputs",()=>{
  const product=entry("light-ada-aquasky-rgb-ii-60");assert.equal(product.system?.type,"light");
  assert.equal(product.system.kelvin,9500);assert.equal(product.system.ratedWatts,108);assert.equal(product.system.intensity,.66);
  assert(product.browseTags.includes("8000–11000K default CCT"));assert.match(product.identityCaveat,/0–66 W power consumption/);
});
