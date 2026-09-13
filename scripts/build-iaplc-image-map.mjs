import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(siteRoot, "..");
const ranked = JSON.parse(fs.readFileSync(path.join(workspaceRoot, "iaplc/entries.json"), "utf8"));
const grandPrizes = JSON.parse(fs.readFileSync(path.join(workspaceRoot, "iaplc/grand_prize_works.json"), "utf8"));
const outputPath = path.join(siteRoot, "public/data/iaplc-images.json");

const images = {};
const assertImageUrl = (rawUrl, expectedPath) => {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.hostname !== "iaplc.com" || url.pathname !== expectedPath || url.username || url.password || url.hash) {
    throw new Error(`Unexpected IAPLC image URL: ${rawUrl}`);
  }
  return url.toString();
};

for (const row of ranked) {
  if (!Number.isInteger(row.year) || !Number.isInteger(row.rank) || typeof row.prefix !== "string" || typeof row.app_id !== "string") {
    throw new Error("Invalid ranked IAPLC image identity");
  }
  const id = `iaplc-${row.year}-${String(row.rank).padStart(4, "0")}`;
  const image = assertImageUrl(row.image_url, "/gallery/en/image/preview");
  const url = new URL(image);
  if (url.searchParams.get("prefix") !== row.prefix || url.searchParams.get("app_id") !== row.app_id) {
    throw new Error(`Image identity mismatch: ${id}`);
  }
  if (images[id]) throw new Error(`Duplicate IAPLC image identity: ${id}`);
  images[id] = image;
}

for (const row of grandPrizes) {
  if (!Number.isInteger(row.year) || typeof row.image_url !== "string") throw new Error("Invalid Grand Prize image record");
  const id = `iaplc-${row.year}-0001`;
  const image = assertImageUrl(row.image_url, row.year >= 2018 ? new URL(row.image_url).pathname : new URL(row.image_url).pathname);
  // Prefer the dedicated Grand Prize photograph for rank-one and historical winner records.
  images[id] = image;
}

const payload = {
  schemaVersion: "fishy.iaplc-images.v1",
  permissionBasis: "Project owner confirmed permission to display IAPLC entry photographs on 2026-09-13.",
  source: "Local IAPLC research records; exact image identities validated against year, rank, prefix, and application ID.",
  count: Object.keys(images).length,
  images,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ output: outputPath, count: payload.count }));
