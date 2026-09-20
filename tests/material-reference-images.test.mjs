import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {resolve} from "node:path";
import test from "node:test";
import {catalogEntries,isOrganicCatalogEntry,isSystemCatalogEntry} from "../lib/catalog.ts";

const root=resolve(import.meta.dirname,"..");
const registry=JSON.parse(readFileSync(resolve(root,"public/data/catalog-registry.json"),"utf8"));

test("the original photographed Materials entries retain local attribution",()=>{
  assert.equal(registry.entries.length,20);
  for(const entry of registry.entries){
    const image=entry.referenceImage;
    assert.ok(image,`${entry.id} is missing referenceImage`);
    for(const key of ["src","alt","scope","sourceUrl","author","license","licenseUrl"])assert.equal(typeof image[key],"string",`${entry.id} referenceImage.${key} must be a string`);
    assert.match(image.src,/^\/material-references\/[a-z0-9-]+\.jpg$/);
    assert.match(image.sourceUrl,/^https:\/(?:\/commons\.wikimedia\.org\/wiki\/File:|\/www\.flickr\.com\/photos\/)/);
    assert.match(image.licenseUrl,/^https:\/\//);
    const file=resolve(root,"public",image.src.slice(1));
    assert.ok(existsSync(file),`${entry.id} image file is missing`);
    assert.deepEqual([...readFileSync(file).subarray(0,3)],[0xff,0xd8,0xff],`${entry.id} must be a JPEG reference photo`);
  }
});

test("expanded material catalog includes reference-matched organics and grounded installed systems",()=>{
  assert.equal(catalogEntries.length,88);
  assert.equal(catalogEntries.filter(isOrganicCatalogEntry).length,55);
  const expected={substrate:12,filter:11,light:10};
  for(const kind of ["substrate","filter","light"]){
    const entries=catalogEntries.filter(entry=>entry.kind===kind);
    assert.equal(entries.length,expected[kind],`${kind} needs the expected real-world counterparts`);
    for(const entry of entries){
      assert.ok(isSystemCatalogEntry(entry));
      assert.equal(entry.system.type,kind);
      assert.match(entry.source.url,/^https:\/\//);
      assert.match(entry.identityCaveat,/./);
      assert.match(entry.renderingLimit,/./);
    }
  }
  for(const entry of catalogEntries.filter(item=>item.organic)){
    assert.ok(isOrganicCatalogEntry(entry));
    assert.match(entry.source.url,/^https:\/\//);
  }
});

test("Weeping Moss uses its exact, reusable Flickr reference",()=>{
  const image=registry.entries.find(({id})=>id==="plant-vesicularia-weeping")?.referenceImage;
  assert.equal(image?.sourceUrl,"https://www.flickr.com/photos/21708387@N02/12444482133");
  assert.equal(image?.author,"Joel Carnat");
  assert.equal(image?.license,"CC BY 2.0");
  assert.equal(image?.licenseUrl,"https://creativecommons.org/licenses/by/2.0/");
  assert.match(image?.scope??"",/^Exact real-photo reference/);
});

test("Materials cards render 3D model previews and reveal real reference photos on demand",()=>{
  const page=readFileSync(resolve(root,"app/page.tsx"),"utf8");
  const filter=readFileSync(resolve(root,"components/catalog-filter.tsx"),"utf8");
  assert.match(page,/useMaterialThumbnails\(catalog,materialsVisible&&!realSampleOpen\)/);
  assert.match(page,/src=\{materialThumbnails\[entry\.id\]\}/);
  assert.match(page,/3D model preview of/);
  assert.match(page,/Inspect real sample/);
  assert.match(page,/Real reference photo ·/);
  assert.match(page,/candidate\.referenceImage\.sourceUrl/);
  assert.match(page,/<CatalogFilter entries=\{catalog\} value=\{catCategory\}/);
  assert.match(filter,/Filter/);
  assert.match(filter,/All materials/);
  assert.match(filter,/Natural materials/);
  assert.match(filter,/label: "Rocks"/);
  assert.match(filter,/label: "Plants"/);
  assert.match(filter,/label: "Wood"/);
  assert.match(filter,/Tank systems/);
  assert.match(filter,/label: "Substrate"/);
  assert.match(filter,/label: "Filters"/);
  assert.match(filter,/label: "Lighting"/);
  assert.match(filter,/DropdownMenuRadioGroup/);
});

test("the desktop configuration tray has an accessible resize control",()=>{
  const page=readFileSync(resolve(root,"app/page.tsx"),"utf8");
  assert.match(page,/aria-label="Resize configuration panel"/);
  assert.match(page,/onPointerDown=\{beginLeftResize\}/);
  assert.match(page,/onKeyDown=\{resizeLeftWithKey\}/);
});

test("the configuration tabs share their row with the left-panel hide action",()=>{
  const page=readFileSync(resolve(root,"app/page.tsx"),"utf8");
  assert.match(page,/className="dock-navigation"/);
  assert.match(page,/aria-label="Hide left panel"/);
  assert.doesNotMatch(page,/<span>Aquascape<\/span>/);
});

test("the reference photo area omits the removed session-detail helper text",()=>{
  const page=readFileSync(resolve(root,"app/page.tsx"),"utf8");
  assert.doesNotMatch(page,/Kept in this session\. The four most recent are compressed and sent when you generate\./);
});

test("the material browser omits the removed preview-summary helper text",()=>{
  const page=readFileSync(resolve(root,"app/page.tsx"),"utf8");
  assert.doesNotMatch(page,/3D procedural previews; real samples available to inspect/);
});
