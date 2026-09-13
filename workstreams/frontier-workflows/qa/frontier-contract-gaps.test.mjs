import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILDER, initialScene } from "../../../site/lib/scene.ts";
import { reviewSchema, stageBrowserProposal } from "../../../site/lib/frontier.ts";

const hash = "a".repeat(64);
const artifact = (scene = initialScene()) => ({
  schemaVersion: "fishy.frontier.review.v1",
  provenance: "protocol_fixture",
  run: {
    id: "independent-fixture", runtime: "browser", builder: BUILDER,
    sceneId: scene.id, baseRevision: scene.revision, revision: scene.revision + 1,
    createdAt: "2026-09-13T04:10:00Z",
  },
  observations: [], requests: [], changes: [],
  protection: { protectedIds: [], blockedAttempts: [] },
  evaluation: null, browserProposal: structuredClone(scene),
});

test("every standalone change record requires at least one known reconstruction citation", () => {
  const review = artifact();
  review.changes = [{ objectId: "rock-left", summary: "Unsubstantiated move", observationIds: [] }];
  assert.throws(() => reviewSchema.parse(review), /citation/i);
});

test("imported protection declarations do not change current-browser merge authority", () => {
  const current = initialScene();
  const review = artifact(current);
  review.protection.protectedIds = ["rock-left"];
  review.browserProposal.objects.find(object => object.id === "rock-left").position[0] += .01;
  const staged = stageBrowserProposal(current, review);
  assert.equal(staged.attempts.length, 0);
  assert.notDeepEqual(
    staged.effective.objects.find(object => object.id === "rock-left").position,
    current.objects.find(object => object.id === "rock-left").position,
  );
});

test("a current no-op proposal preserves protection without inventing review changes", () => {
  const current = initialScene();
  const staged = stageBrowserProposal(current, artifact(current));
  assert.deepEqual(staged.effective, current);
  assert.deepEqual(staged.attempts, []);
  assert.deepEqual(staged.changes, []);
});
