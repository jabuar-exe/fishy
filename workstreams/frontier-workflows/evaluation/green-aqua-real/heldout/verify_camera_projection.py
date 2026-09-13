"""Independent camera-projection check; no reconstruction recipe or scoring."""
from pathlib import Path
import sys,math
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
REPO=Path(__file__).resolve().parents[5]
sys.path.insert(0,str(REPO/'blender'))
from heldout_evaluation import read_json,write_new_json
from render_heldout import configure_camera
ROOT=Path(__file__).resolve().parent
config=read_json(ROOT.parent/'config.json')
annotation=read_json(ROOT/'camera-annotation.json')
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
camera=configure_camera(scene,config['camera'])
bpy.context.view_layer.update()
points=[]
for point in annotation['points']:
    p=world_to_camera_view(scene,camera,Vector(point['assumedWorldM']))
    actual=[p.x*640,(1-p.y)*360]
    disagreement=math.dist(actual,point['projectedPixel'])
    if disagreement>0.001: raise RuntimeError('Analytic and Blender projection differ: '+str(disagreement))
    points.append({'name':point['name'],'blenderProjectedPixel':actual,'analyticDisagreementPx':disagreement,'markedCornerErrorPx':math.dist(actual,point['manuallyMarkedPixel'])})
result={'status':'passed','renderer':bpy.app.version_string,'cameraHash':annotation['cameraHash'],'usedReconstructionRecipe':False,'renderedOrScoredHardscape':False,'checks':points,'frontCornerRmsResidualPx':math.sqrt(sum(p['markedCornerErrorPx']**2 for p in points)/len(points))}
write_new_json(ROOT/'camera-projection-verification.json',result)
print(result)
