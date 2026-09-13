"""Assemble a labeled technical comparison from the three original Blender renders."""
import argparse,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
p=argparse.ArgumentParser();p.add_argument('run',type=Path);a=p.parse_args()
items=[('hero-60-arch','01   LIVING ARC','60 × 30 × 36 cm','Branching root arch'),('panorama-90-angular','02   RIVER LINE','90 × 30 × 30 cm','Sparse angular branch'),('cube-45-stump','03   ROOT ISLAND','45 × 45 × 45 cm','Dense radial stump')]
fontpath='/System/Library/Fonts/Helvetica.ttc'
def font(n): return ImageFont.truetype(fontpath,n)
w=1800;h=850;out=Image.new('RGB',(w,h),'#e9ede8');d=ImageDraw.Draw(out)
d.text((48,28),'FISHY / PROCEDURAL AQUARIUM STUDIES',fill='#18271f',font=font(30))
d.text((48,76),'Physical dimensions · Uniform wood fitting · Original editable geometry',fill='#4b6154',font=font(21))
for i,(sub,title,dim,style) in enumerate(items):
 preview=a.run/sub/'beauty-fixed.png' if (a.run/sub/'beauty-fixed.png').exists() else a.run/sub/'beauty.png'; im=Image.open(preview).convert('RGB');im.thumbnail((580,500));x=20+i*600;out.paste(im,(x+(580-im.width)//2,145+(500-im.height)//2))
 d.text((x+25,635),title,fill='#183728',font=font(24));d.text((x+25,675),dim,fill='#183728',font=font(28));d.text((x+25,717),style,fill='#4b6154',font=font(21))
 report=json.loads((a.run/sub/'audit.json').read_text());d.text((x+25,758),f'{report["triangles"]:,} triangles · {report["glb_bytes"]/1e6:.2f} MB GLB',fill='#627266',font=font(18))
d.text((48,815),'Cycles optical previews; browser appearance varies. Water is a surface approximation.',fill='#627266',font=font(16))
out.save(a.run/'comparison.png')
print(a.run/'comparison.png')
