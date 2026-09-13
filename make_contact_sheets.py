from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys

src = Path(sys.argv[1])
dst = Path(sys.argv[2])
prefix = sys.argv[3] if len(sys.argv) > 3 else "sheet"
dst.mkdir(parents=True, exist_ok=True)
files = sorted(p for p in src.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
font = ImageFont.load_default()
cols, rows = 5, 4
cw, ch, label_h = 260, 210, 26
for page, start in enumerate(range(0, len(files), cols * rows), 1):
    canvas = Image.new("RGB", (cols * cw, rows * (ch + label_h)), "white")
    draw = ImageDraw.Draw(canvas)
    for slot, path in enumerate(files[start:start + cols * rows]):
        x = (slot % cols) * cw
        y = (slot // cols) * (ch + label_h)
        try:
            with Image.open(path) as im:
                im = im.convert("RGB")
                im.thumbnail((cw - 8, ch - 8), Image.Resampling.LANCZOS)
                px = x + (cw - im.width) // 2
                py = y + (ch - im.height) // 2
                canvas.paste(im, (px, py))
        except Exception:
            draw.rectangle((x + 4, y + 4, x + cw - 4, y + ch - 4), outline="red")
        draw.text((x + 4, y + ch + 5), path.name[:34], fill="black", font=font)
    canvas.save(dst / f"{prefix}_{page:02d}.jpg", quality=90)
print(f"{len(files)} images -> {page} sheets")
