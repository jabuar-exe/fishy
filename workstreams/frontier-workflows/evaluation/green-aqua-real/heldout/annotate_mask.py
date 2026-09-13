"""Private evaluator annotation, authored from D145 before reconstruction/scoring.
Polygons follow exposed mineral faces. No beauty-color segmentation is used.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
regions=[
('upper-left-tower',[(65,111),(81,103),(98,91),(114,85),(134,93),(148,108),(155,128),(160,150),(158,168),(144,173),(128,163),(112,163),(96,155),(87,143),(83,130),(73,130),(67,121)]),
('left-middle-rock',[(54,181),(65,175),(81,172),(96,175),(107,178),(119,176),(131,173),(142,181),(152,189),(157,206),(147,217),(129,222),(120,214),(114,209),(96,204),(86,214),(75,220),(63,211),(54,207),(58,196)]),
('left-low-rock',[(28,284),(35,269),(49,258),(61,251),(73,245),(87,251),(96,264),(98,281),(108,296),(109,313),(100,320),(78,324),(53,321),(32,316)]),
('main-front-rock',[(108,256),(119,246),(135,242),(147,236),(164,239),(176,243),(188,245),(198,249),(215,249),(227,255),(249,257),(263,264),(272,275),(283,280),(284,301),(274,308),(256,313),(241,320),(201,321),(166,324),(140,319),(129,310),(122,300),(118,285),(110,280),(106,269)]),
('centre-boulder',[(266,248),(279,241),(298,239),(315,238),(332,241),(349,240),(365,246),(371,252),(366,268),(359,288),(347,303),(332,309),(313,311),(297,306),(290,289),(279,276)]),
('centre-top-slab',[(270,237),(281,232),(293,231),(304,232),(312,235),(330,234),(339,239),(323,243),(306,242),(288,244)]),
('right-standing-dark-base',[(379,266),(390,260),(405,260),(412,273),(424,281),(419,294),(410,301),(400,306),(387,305),(375,299),(370,285),(374,275)]),
('right-standing-rock',[(411,239),(416,226),(422,214),(430,213),(438,222),(444,235),(454,244),(462,254),(468,266),(454,275),(436,276),(426,271),(414,276),(404,266),(407,252)]),
('right-back-rock',[(476,228),(487,220),(502,223),(514,229),(516,240),(526,250),(533,260),(531,276),(517,281),(499,276),(489,267),(477,261),(475,247),(482,239)]),
('right-front-boulder',[(420,285),(437,278),(456,276),(470,270),(489,270),(502,267),(516,272),(530,278),(535,289),(529,303),(515,312),(497,316),(473,316),(448,317),(434,313),(413,305),(408,296)]),
('right-side-small-rock',[(533,276),(543,276),(548,283),(545,290),(537,295),(529,294)]),
('foreground-stone-a',[(234,316),(241,310),(249,305),(256,309),(262,318),(257,323),(244,324),(232,322)]),
('foreground-stone-b',[(292,319),(300,313),(309,308),(319,313),(325,319),(327,324),(315,327),(303,325),(291,324)]),
('foreground-stone-c',[(369,318),(378,313),(389,308),(397,311),(405,316),(410,321),(402,325),(387,325),(375,324),(367,322)]),
('foreground-stone-d',[(437,328),(445,324),(450,321),(457,322),(461,328),(455,332),(442,332)]),
('small-left-mid-stone',[(41,224),(52,219),(64,220),(69,226),(65,235),(58,240),(46,240),(40,235)])
]
# Explicit foreground leaf/grass occlusions. Diffuse biofilm/mineral staining
# remains part of a visible mineral face; separately discernible leaves do not.
exclusions=[
('left-middle-leaves',[(52,185),(63,181),(74,188),(85,184),(94,188),(92,197),(79,204),(71,199),(61,202),(56,195)]),
('left-middle-fern',[(101,194),(113,195),(120,204),(126,203),(128,217),(119,222),(113,212),(103,209),(96,201)]),
('left-low-ferns',[(44,252),(54,247),(69,242),(77,246),(72,256),(68,268),(61,267),(57,258),(46,264)]),
('main-front-leaf-clump',[(112,281),(120,276),(128,279),(138,281),(138,287),(131,293),(130,301),(123,306),(117,302),(118,294),(111,292)]),
('centre-front-grass',[(279,254),(291,256),(299,267),(294,281),(299,294),(296,309),(283,311),(278,298),(279,284),(274,274)]),
('right-back-leaves',[(474,249),(481,248),(488,252),(495,255),(498,263),(492,269),(482,266),(476,259)]),
('right-standing-leaves',[(409,227),(417,230),(416,238),(411,245),(401,248),(399,240),(402,232)])
]
mask=Image.new('L',(640,360),0); draw=ImageDraw.Draw(mask)
for _,points in regions: draw.polygon(points,fill=255)
for _,points in exclusions: draw.polygon(points,fill=0)
mask.save(ROOT/'visible-hardscape-mask.png')
photo=Image.open(ROOT/'photo.png').convert('RGB')
overlay=photo.copy();green=Image.new('RGB',photo.size,(30,240,100));overlay.paste(Image.blend(photo,green,.42),mask=mask)
outline=ImageDraw.Draw(overlay)
for _,points in regions: outline.line(points+[points[0]],fill=(255,255,60),width=1)
for _,points in exclusions: outline.line(points+[points[0]],fill=(255,80,80),width=1)
overlay.save(ROOT/'annotation-overlay-private.png')
record={'schemaVersion':'fishy.manual-mask-annotation.v1','source':'photo.png','mask':'visible-hardscape-mask.png','resolution':[640,360],'foregroundPolicy':'Conservative visible exposed mineral faces; separate discernible plants/fish/sand/glass excluded. Diffuse surface staining is treated as the mineral face.','annotationMethod':'Evaluator-authored integer-pixel polygons and explicit foreground-leaf subtraction, visually reviewed at2×. No automatic color segmentation and no rendered recipe used.','ambiguities':['Dark shaded rock/background boundaries, diffuse moss/biofilm versus exposed mineral, subpixel foliage and video compression create annotation uncertainty.','Some intricate foliage boundaries are approximated by polygons; typical boundary uncertainty is several source pixels, not an empirically measured accuracy bound.','Conservative inclusion of recognizable mineral faces may omit ambiguous shaded hardscape. No per-object ground-truth correspondences are asserted.'],'regions':[{'name':name,'polygon':points} for name,points in regions],'plantOcclusions':[{'name':name,'polygon':points} for name,points in exclusions],'foregroundPixels':sum(v>127 for v in mask.tobytes()),'createdBeforeAnyRealRecipeRender':True,'accepted':False}
(ROOT/'mask-annotation.json').write_text(json.dumps(record,indent=2)+'\n')
print(record['foregroundPixels'])
