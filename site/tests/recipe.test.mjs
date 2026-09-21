import test from "node:test";
import assert from "node:assert/strict";
import {boundsOf} from "../lib/geometry.ts";
import {initialScene,validateScene} from "../lib/scene.ts";
import {createPlantedStudy} from "../lib/planted-study.ts";
import {RECIPE_SCHEMA_VERSION,RecipeExportError,assetFor,recipeBounds,recipeIdFor,toRecipe,validateRecipeFit} from "../lib/recipe.ts";

const near=(actual,expected,tolerance,label)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: ${actual} vs ${expected} (tolerance ${tolerance})`);

test("export produces a schema v2 recipe that passes its own containment check",()=>{
  const recipe=toRecipe(initialScene());
  assert.equal(recipe.schema_version,RECIPE_SCHEMA_VERSION);
  assert.equal(recipe.objects.length,6);
  assert.deepEqual(validateRecipeFit(recipe),[]);
  assert.equal(recipe.tank.width_m,.6);
  assert.equal(recipe.tank.depth_m,.3);
  assert.equal(recipe.tank.height_m,.36);
  // Schema v2 requires a design block, and the focal id must name an exported object.
  assert.ok(recipe.design.focal_object_id);
  assert.ok(recipe.objects.some(object=>object.id===recipe.design.focal_object_id));
});

test("the user-loadable planted study exports at the editable scene ceiling",()=>{
  const study=createPlantedStudy(),recipe=toRecipe(study);
  assert.equal(study.objects.length,56);
  assert.equal(recipe.objects.length,study.objects.length);
  assert.deepEqual(validateRecipeFit(recipe),[]);
});

test("coordinates convert from browser Y-up centre-origin to Blender Z-up front-left origin",()=>{
  const scene=initialScene(),recipe=toRecipe(scene);
  for(const object of scene.objects){
    const site=boundsOf(object),exported=recipe.objects.find(entry=>entry.label===object.name);
    const bounds=recipeBounds(exported);
    // x measures from the left wall, y from the front glass, z from the tank floor.
    near((bounds.min[0]+bounds.max[0])/2,(site.min.x+site.max.x)/2+scene.tank.width/2,1e-4,`${object.name} x`);
    near((bounds.min[1]+bounds.max[1])/2,scene.tank.depth/2-(site.min.z+site.max.z)/2,1e-4,`${object.name} y`);
    near(bounds.min[2],Math.max(site.min.y,scene.substrate),1e-4,`${object.name} z base`);
    near(bounds.max[2]-bounds.min[2],site.max.y-site.min.y,1e-4,`${object.name} height`);
  }
});

const yawed=degrees=>validateScene({...initialScene(),objects:initialScene().objects.map(object=>
  object.id==="wood-arch"?{...object,rotation:[0,degrees*Math.PI/180,0]}:object)});

test("a yawed object's recipe envelope still contains its browser footprint",()=>{
  const scene=yawed(10);
  const recipe=toRecipe(scene);
  const exported=recipe.objects.find(entry=>entry.id==="wood-arch");
  near(exported.yaw_deg,10,1e-3,"yaw degrees");
  const bounds=recipeBounds(exported),site=boundsOf(scene.objects.find(object=>object.id==="wood-arch"));
  const slack=1e-6;
  assert.ok(bounds.min[0]<=site.min.x+scene.tank.width/2+slack,"left edge contained");
  assert.ok(bounds.max[0]>=site.max.x+scene.tank.width/2-slack,"right edge contained");
  assert.ok(bounds.min[1]<=scene.tank.depth/2-site.max.z+slack,"back edge contained");
  assert.ok(bounds.max[1]>=scene.tank.depth/2-site.min.z-slack,"front edge contained");
  assert.deepEqual(validateRecipeFit(recipe),[]);
});

test("a yaw whose envelope would leave the tank is refused, not silently shrunk",()=>{
  // The browser fits the actual rotated mesh; a recipe rotates the whole pre-yaw box,
  // which is strictly larger. At 36 degrees the 40.7 x 8.4 cm branch needs 30.7 cm of
  // depth in a 30 cm tank, so Blender would reject it. Refuse here instead.
  assert.throws(()=>toRecipe(yawed(36)),error=>{
    assert.ok(error instanceof RecipeExportError);
    assert.deepEqual(error.detail,["River wood (wood-arch)"]);
    return true;
  });
});

test("yaw wraps into the recipe's (-180, 180] range",()=>{
  const spun=validateScene({...initialScene(),objects:initialScene().objects.map(object=>
    object.id==="rock-left"?{...object,rotation:[0,Math.PI*5.5,0]}:object)});
  const exported=toRecipe(spun).objects.find(entry=>entry.id==="rock-left");
  assert.ok(exported.yaw_deg>-180&&exported.yaw_deg<=180,`yaw ${exported.yaw_deg} out of range`);
  // 5.5pi rad is 990 degrees, which is two and three-quarter turns: the same pose as -90.
  near(exported.yaw_deg,-90,1e-3,"wrapped yaw");
});

test("object ids are coerced into the recipe grammar and stay unique",()=>{
  const used=new Set();
  assert.equal(recipeIdFor("ai-1-AbC123",used),"ai-1-abc123");
  assert.equal(recipeIdFor("9-leading-digit",used),"o-9-leading-digit");
  assert.equal(recipeIdFor("Plant Grove!!",used),"plant-grove");
  assert.equal(recipeIdFor("Plant Grove!!",used),"plant-grove-2");
  assert.equal(recipeIdFor("---",used),"object");
  for(const id of used)assert.match(id,/^[a-z][a-z0-9_-]{0,47}$/,`${id} must match the recipe id pattern`);
});

test("browser kinds and plant forms map onto the four Blender assets",()=>{
  const object=(kind,form)=>({id:"x",name:"x",kind,form,position:[0,0,0],rotation:[0,0,0],size:1,color:"#ffffff",protected:false});
  assert.equal(assetFor(object("wood","arch")),"branchwood");
  assert.equal(assetFor(object("rock","faceted")),"rock");
  for(const form of ["grass","carpet","moss"])assert.equal(assetFor(object("plant",form)),"grass",`${form} is a carpet`);
  for(const form of ["stem","fern","broadleaf"])assert.equal(assetFor(object("plant",form)),"bush",`${form} is a bush`);
});

test("substrate is capped at 30% of tank height and the reduction is recorded",()=>{
  const shallow=validateScene({...initialScene(),tank:{width:.6,depth:.3,height:.1,source:"assumed"},substrate:.05,
    objects:initialScene().objects.filter(object=>object.kind!=="wood").map(object=>({...object,position:[object.position[0],.02,object.position[2]],size:.3}))});
  const recipe=toRecipe(shallow);
  assert.equal(recipe.tank.substrate_depth_m,.03);
  assert.ok(recipe.assumptions.some(note=>/Substrate reduced/.test(note)),"the reduction must be declared");
});

test("a declared design block is preserved and its focal id remapped to the exported object",()=>{
  const scene=validateScene({...initialScene(),design:{composition:"concave",focalObjectId:"wood-arch",
    sightline:"Open centre channel.",openForegroundMin:.5,mood:"dark-mysterious",maintenanceTier:"high",story:"A flooded forest floor."}});
  const recipe=toRecipe(scene);
  assert.equal(recipe.design.composition,"concave");
  assert.equal(recipe.design.mood,"dark-mysterious");
  assert.equal(recipe.design.maintenance_tier,"high");
  assert.equal(recipe.design.story,"A flooded forest floor.");
  assert.equal(recipe.design.focal_object_id,"wood-arch");
  assert.ok(!recipe.assumptions.some(note=>/derived from the exported geometry/.test(note)),"a declared design is not derived");
});

test("a scene with no declared design still exports, and says the design was derived",()=>{
  const recipe=toRecipe(initialScene());
  assert.ok(recipe.assumptions.some(note=>/derived from the exported geometry/.test(note)));
  assert.ok(recipe.design.open_foreground_min>=0&&recipe.design.open_foreground_min<=.95);
});

test("an empty scene is refused rather than exported as an empty tank",()=>{
  assert.throws(()=>toRecipe(validateScene({...initialScene(),objects:[]})),RecipeExportError);
});

test("containment check names the objects that leave the tank",()=>{
  const recipe=toRecipe(initialScene());
  recipe.objects[0].position_m[0]=recipe.tank.width_m+1;
  const problems=validateRecipeFit(recipe);
  assert.equal(problems.length,1);
  assert.match(problems[0],new RegExp(recipe.objects[0].id));
});

test("the same scene exports byte-identical recipes, so rebuilds are reproducible",()=>{
  assert.equal(JSON.stringify(toRecipe(initialScene())),JSON.stringify(toRecipe(initialScene())));
});
