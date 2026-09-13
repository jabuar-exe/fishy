import bpy
from mathutils import Vector
from pathlib import Path
p=Path(__file__).parent/'runs/20260913-110819/panorama-90-angular'
bpy.ops.wm.open_mainfile(filepath=str(p/'aquarium.blend'))
s=bpy.context.scene;t=Vector((0,0,.30*.44));s.camera.location=t+(s.camera.location-t)*3;s.render.filepath=str(p/'beauty-fixed.png')
bpy.ops.wm.save_as_mainfile(filepath=str(p/'aquarium-camera-fixed.blend'));bpy.ops.render.render(write_still=True)
