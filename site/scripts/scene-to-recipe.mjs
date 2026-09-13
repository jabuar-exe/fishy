/**
 * Browser scene → Blender recipe.
 *
 * Reads a scene exported by the editor (`fishy-revision-<n>.json`) and writes a
 * `fishy.recipe.v2` document that blender/build_recipe.py builds directly.
 *
 *   node --experimental-strip-types site/scripts/scene-to-recipe.mjs \
 *     ~/Downloads/fishy-revision-7.json -o /tmp/recipe.json
 *
 * Then, in a separate Blender process:
 *
 *   /Users/joshuabanzon/Applications/Blender.app/Contents/MacOS/Blender \
 *     --background --factory-startup --python-exit-code 1 \
 *     --python blender/build_recipe.py -- \
 *     --recipe /tmp/recipe.json --output /tmp/aquarium.blend --render-dir /tmp/previews
 *
 * Nothing here contacts a model or a network service. It is a pure conversion,
 * which is why it is safe to keep off the web request path.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { argv, exit, stderr, stdout } from "node:process";
import { validateScene } from "../lib/scene.ts";
import { RecipeExportError, toRecipe, validateRecipeFit } from "../lib/recipe.ts";

function usage(message) {
  stderr.write(`${message}\n\nUsage: scene-to-recipe.mjs <scene.json> [-o recipe.json] [--interpretation "text"]\n`);
  exit(2);
}

const args = argv.slice(2);
let input = null, output = null, interpretation;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "-o" || arg === "--output") output = args[++i];
  else if (arg === "--interpretation") interpretation = args[++i];
  else if (arg.startsWith("-")) usage(`Unknown option ${arg}`);
  else if (input) usage("Provide exactly one scene file.");
  else input = arg;
}
if (!input) usage("Provide the exported scene JSON.");

let scene;
try {
  scene = validateScene(JSON.parse(readFileSync(input, "utf8")));
} catch (error) {
  stderr.write(`Not a valid Fishy scene export: ${error instanceof Error ? error.message : error}\n`);
  exit(1);
}

let recipe;
try {
  recipe = toRecipe(scene, interpretation ? { interpretation } : {});
} catch (error) {
  if (error instanceof RecipeExportError) {
    stderr.write(`${error.message}\n`);
    for (const detail of error.detail) stderr.write(`  · ${detail}\n`);
    exit(1);
  }
  throw error;
}

const unfit = validateRecipeFit(recipe);
if (unfit.length) {
  stderr.write(`Recipe failed its own containment check: ${unfit.join(", ")}\n`);
  exit(1);
}

const text = `${JSON.stringify(recipe, null, 2)}\n`;
if (output) {
  writeFileSync(output, text);
  stderr.write(`${recipe.objects.length} objects · ${recipe.tank.width_m * 100} × ${recipe.tank.depth_m * 100} × ${recipe.tank.height_m * 100} cm → ${output}\n`);
  for (const note of recipe.assumptions) stderr.write(`  assumption: ${note}\n`);
} else {
  stdout.write(text);
}
