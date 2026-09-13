import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_REVISION, SAVE_KEY, commitScene, initialScene, readSavedScene, validateScene } from "../lib/scene.ts";
import { fitObject, outsideObjects, resizeTank } from "../lib/geometry.ts";

const memoryStorage = entries => ({
  getItem: key => entries.get(key) ?? null,
});

test("scene schema rejects invalid asymmetric dimensions before they can be persisted", () => {
  const scene = initialScene();
  assert.throws(
    () => validateScene({ ...scene, tank: { ...scene.tank, width: .099 } }),
    /greater than or equal to 0\.1/,
  );
  assert.throws(
    () => validateScene({ ...scene, tank: { ...scene.tank, depth: 3.01 } }),
    /less than or equal to 3/,
  );
  assert.equal(validateScene({ ...scene, tank: { ...scene.tank, width: .1, depth: 3, height: .1 } }).tank.depth, 3);
});

test("a rotated object that crosses two tank edges is fitted by its rendered bounds", () => {
  const scene = initialScene();
  const rock = scene.objects.find(object => object.kind === "rock");
  assert.ok(rock);
  const rotatedAtCorner = { ...rock, position: [.29, .03, .14], rotation: [0, Math.PI / 4, 0] };
  const fitted = fitObject(rotatedAtCorner, scene, false);
  const result = { ...scene, objects: scene.objects.map(object => object.id === rock.id ? fitted : object) };
  assert.deepEqual(outsideObjects(result), []);
  assert.notDeepEqual(fitted.position, rotatedAtCorner.position);
});

test("resize preserves every object identity when non-protected geometry must be replaced", () => {
  const scene = initialScene();
  const unlocked = { ...scene, objects: scene.objects.map(object => ({ ...object, protected: false })) };
  const ids = unlocked.objects.map(object => object.id);
  const result = resizeTank(unlocked, { width: .2, depth: .15, height: .15, source: "user-entered" });
  assert.deepEqual(result.scene.objects.map(object => object.id), ids);
  assert.deepEqual(outsideObjects(result.scene), []);
  assert.ok(result.changed.length > 0);
});

test("protected objects stay byte-for-byte stable during an AI commit while other objects may change", () => {
  const scene = initialScene();
  const protectedObject = scene.objects.find(object => object.protected);
  const editableObject = scene.objects.find(object => !object.protected);
  assert.ok(protectedObject && editableObject);
  const candidate = {
    ...scene,
    objects: scene.objects.map(object => object.id === editableObject.id ? { ...object, color: "#123456" } : object),
  };
  const committed = commitScene(scene, candidate, scene.revision, "ai");
  assert.deepEqual(committed.objects.find(object => object.id === protectedObject.id), protectedObject);
  assert.equal(committed.objects.find(object => object.id === editableObject.id)?.color, "#123456");
  assert.equal(scene.revision, 1);
});

test("corrupt saved JSON fails closed and the stored bytes remain untouched", () => {
  const bytes = "{not valid JSON";
  const storage = memoryStorage(new Map([["fishy.studio.scene.v4", bytes]]));
  assert.throws(() => readSavedScene(storage));
  assert.equal(storage.getItem("fishy.studio.scene.v4"), bytes);
});

test("commits advance revisions without mutating an earlier snapshot, supporting repeated undo/redo snapshots", () => {
  const original = initialScene();
  const first = commitScene(original, { ...original, brief: "first" }, original.revision);
  const second = commitScene(first, { ...first, brief: "second" }, first.revision);
  assert.equal(original.brief, "");
  assert.equal(first.brief, "first");
  assert.equal(second.brief, "second");
  assert.deepEqual([original.revision, first.revision, second.revision], [1, 2, 3]);
});

test("the final safe revision is reachable once and further commits fail without changing it", () => {
  const almostExhausted = { ...initialScene(), revision: MAX_REVISION - 1, brief: "before final revision" };
  const final = commitScene(almostExhausted, { ...almostExhausted, brief: "final revision" }, almostExhausted.revision);
  assert.equal(final.revision, MAX_REVISION);
  assert.throws(
    () => commitScene(final, { ...final, brief: "must not commit" }, final.revision),
    /Revision limit reached/,
  );
  assert.equal(final.brief, "final revision");
});

test("resize identifies out-of-bounds objects by ID when objects share a name", () => {
  const scene = initialScene();
  const [rock] = scene.objects.filter(object => object.kind === "rock");
  assert.ok(rock);
  const outsideUnlocked = { ...rock, id: "outside-unlocked", name: "Twin rock", position: [.25, .03, 0], protected: false };
  const insideProtected = { ...rock, id: "inside-protected", name: "Twin rock", position: [0, .03, 0], protected: true };
  const withTwins = { ...scene, objects: [outsideUnlocked, insideProtected] };
  const result = resizeTank(withTwins, { width: .5, depth: .3, height: .36, source: "user-entered" });
  assert.deepEqual(result.changed, ["Twin rock"]);
  assert.equal(result.scene.objects[0].id, outsideUnlocked.id);
  assert.deepEqual(result.scene.objects[1], insideProtected);
  assert.deepEqual(outsideObjects(result.scene), []);
});

test("legacy object records retain explicit size, form, color, stretch, and catalog identity", () => {
  const legacy = JSON.stringify({
    model: {
      revision: 9,
      objects: [{
        id: "legacy-wood", name: "Retained specimen", kind: "wood",
        p: [.01, .04, -.02], r: [.1, .2, .3], size: .73, form: "spider",
        color: "#123a5f", stretch: [1.2, .8, 1.1], catalogId: "spider-wood",
      }],
    },
  });
  const saved = readSavedScene(memoryStorage(new Map([["fishy.v2", legacy]])));
  const object = saved.scene.objects[0];
  assert.deepEqual(object, {
    id: "legacy-wood", name: "Retained specimen", kind: "wood",
    position: [.01, .04, -.02], rotation: [.1, .2, .3], size: .73, form: "spider",
    color: "#123a5f", stretch: [1.2, .8, 1.1], catalogId: "spider-wood", protected: false,
  });
  assert.equal(saved.scene.revision, 9);
});

test("saved history envelope restores bounded undo and redo snapshots with its scene", () => {
  const scene = { ...initialScene(), revision: 50, brief: "current" };
  const past = Array.from({ length: 41 }, (_, index) => ({ ...initialScene(), revision: index + 1, brief: `past-${index}` }));
  const future = [
    { ...initialScene(), revision: 51, brief: "redo-one" },
    { ...initialScene(), revision: 52, brief: "redo-two" },
  ];
  const raw = JSON.stringify({ scene, past, future });
  const storage = memoryStorage(new Map([[SAVE_KEY, raw]]));
  const saved = readSavedScene(storage);
  assert.equal(saved.raw, raw);
  assert.equal(saved.scene.brief, "current");
  assert.equal(saved.past?.length, 40);
  assert.equal(saved.past?.[0].brief, "past-1");
  assert.deepEqual(saved.future?.map(snapshot => snapshot.brief), ["redo-one", "redo-two"]);
  assert.equal(storage.getItem(SAVE_KEY), raw);
});

test("scene identity cannot be empty or replaced by a commit", () => {
  const scene=initialScene();
  assert.throws(()=>validateScene({...scene,id:""}));
  assert.throws(()=>commitScene(scene,{...scene,id:"another-scene"},scene.revision),/different scene/);
});
test("nested legacy model metadata is recovered without changing source", () => {
  const scene=initialScene(), model={...scene,id:"legacy-project",brief:"Retain this",references:["idea"],substrate:.025};
  const raw=JSON.stringify({model}), storage=memoryStorage(new Map([["fishy.scene",raw]]));
  const recovered=readSavedScene(storage).scene;
  assert.equal(recovered.id,"legacy-project");assert.equal(recovered.brief,"Retain this");
  assert.deepEqual(recovered.references,["idea"]);assert.equal(recovered.substrate,.025);
  assert.equal(storage.getItem("fishy.scene"),raw);
});
