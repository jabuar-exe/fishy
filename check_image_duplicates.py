from pathlib import Path
from PIL import Image
import sys

root = Path(sys.argv[1])
paths = sorted(p for p in root.iterdir() if p.suffix.lower() in {'.jpg','.jpeg','.png','.webp'})

def dhash(path):
    with Image.open(path) as im:
        im = im.convert('L').resize((17, 16), Image.Resampling.LANCZOS)
        px = list(im.getdata())
    bits = 0
    for y in range(16):
        for x in range(16):
            bits = (bits << 1) | (px[y*17+x] > px[y*17+x+1])
    return bits

hashes = [(p, dhash(p)) for p in paths]
for i, (a, ha) in enumerate(hashes):
    for b, hb in hashes[i+1:]:
        d = (ha ^ hb).bit_count()
        if d <= 22:
            print(f'{d:02d} {a.name} {b.name}')
