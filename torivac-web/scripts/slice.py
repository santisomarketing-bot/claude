#!/usr/bin/env python3
"""Trocea una captura alta en bandas visualizables: python3 -I scripts/slice.py in.png outdir [alto=1300] [ancho=1000]"""
import sys
from pathlib import Path
from PIL import Image
src, out = Path(sys.argv[1]), Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
h = int(sys.argv[3]) if len(sys.argv) > 3 else 1300; w = int(sys.argv[4]) if len(sys.argv) > 4 else 1000
im = Image.open(src).convert("RGB"); W, H = im.size
for i, y in enumerate(range(0, H, h)):
    b = im.crop((0, y, W, min(y + h, H))); b = b.resize((w, int(b.height * w / W)))
    b.save(out / f"{src.stem}-{i}.png")
print(src.name, im.size, "->", (H + h - 1) // h, "bandas")
