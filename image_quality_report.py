from pathlib import Path
from PIL import Image
import sys

root = Path(sys.argv[1])
rows = []
for p in root.iterdir():
    if p.suffix.lower() not in {'.jpg','.jpeg','.png','.webp'}:
        continue
    try:
        with Image.open(p) as im:
            w,h = im.size
        rows.append((w*h, w, h, p.name, p.stat().st_size))
    except Exception:
        pass
for _,w,h,name,size in sorted(rows):
    print(f'{w:4}x{h:<4} {size/1024:7.1f}KB {name}')
