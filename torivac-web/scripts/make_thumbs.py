#!/usr/bin/env python3
"""Sesión 3/8 · Miniaturas incrustadas para el PDF del presupuesto, logo para el PDF y favicon.

  python3 -I scripts/make_thumbs.py

Salida: data/catalog/thumbs.json  {"<assets/media/...webp>": "data:image/jpeg;base64,...", "__logo": "data:image/png;base64,..."}
        site/assets/img/favicon.png, site/assets/img/logo.png
Las miniaturas van EMBEBIDAS en un .js (no se piden por red/canvas) para que el PDF funcione también abriendo el demo con file://.
"""
import base64
import io
import json
import re
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CAT, RAW, SITE = ROOT / "data" / "catalog", ROOT / "data" / "raw", ROOT / "site"
(SITE / "assets" / "img").mkdir(parents=True, exist_ok=True)


def data_url(im, fmt="JPEG", **kw):
    """Imagen PIL → URI data: en base64 con el formato indicado (`kw` se pasa a `save`)."""
    b = io.BytesIO()
    im.save(b, fmt, **kw)
    return f"data:image/{fmt.lower()};base64," + base64.b64encode(b.getvalue()).decode()


def thumb(path, size=96):
    """Miniatura cuadrada `size`×`size` en JPEG (fondo blanco, imagen centrada) del archivo `path`, como URI data:."""
    im = Image.open(path)
    im.load()
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, "white")
        bg.paste(im, mask=im.split()[-1])
        im = bg
    im = im.convert("RGB")
    im.thumbnail((size, size))
    canvas = Image.new("RGB", (size, size), "white")
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2))
    return data_url(canvas, "JPEG", quality=72, optimize=True)


def main():
    """Genera thumbs.json (miniaturas de producto y logo negativo para el PDF), site/assets/img/logo.png y favicon.png."""
    products = json.loads((CAT / "products.json").read_text())
    files = set()
    for p in products:
        for i in p.get("images", []):
            if i.get("file"):
                files.add(i["file"])
        for v in p.get("variants", []):
            if (v.get("image") or {}).get("file"):
                files.add(v["image"]["file"])
    out = {}
    for f in sorted(files):
        src = SITE / f
        if src.exists():
            try:
                out[f] = thumb(src)
            except Exception as e:  # noqa: BLE001
                print("miniatura falló", f, e)
    # logo blanco (negativo) para la banda oscura del PDF
    imap = json.loads((CAT / "image-map.json").read_text())
    key = next((k for k in imap if "Torivac_negativo" in k), None)
    if key:
        raw = next((RAW / "media").glob("*Torivac_negativo.png"), None)
        if raw:
            im = Image.open(raw).convert("RGBA")
            im.thumbnail((420, 180))
            out["__logo"] = data_url(im, "PNG", optimize=True)
            shutil_logo = SITE / "assets" / "img" / "logo.png"
            im.save(shutil_logo, "PNG", optimize=True)
    # favicon: el icono real del sitio
    fav = SITE / "assets" / "img" / "favicon.png"
    try:
        html = (RAW / "html" / "es" / "home.html").read_text(errors="replace")
        m = re.search(r'<link[^>]+rel=["\']icon["\'][^>]+href=["\']([^"\']+)', html) or re.search(r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']icon', html)
        if m:
            req = urllib.request.Request(m.group(1), headers={"User-Agent": "Mozilla/5.0 (compatible; SantisoMarketing-Migration/1.0)"})
            fav.write_bytes(urllib.request.urlopen(req, timeout=30).read())
    except Exception as e:  # noqa: BLE001
        print("favicon remoto falló:", e)
    if not fav.exists():
        # respaldo: círculo cobre
        im = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        from PIL import ImageDraw
        ImageDraw.Draw(im).ellipse((4, 4, 60, 60), fill=(186, 107, 30, 255), outline=(16, 4, 4, 255), width=4)
        im.save(fav)
    (CAT / "thumbs.json").write_text(json.dumps(out))
    print(f"miniaturas: {len(out) - ('__logo' in out)} | logo: {'__logo' in out} | favicon: {fav.exists()}")


if __name__ == "__main__":
    main()
