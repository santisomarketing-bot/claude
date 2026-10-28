#!/usr/bin/env python3
"""Genera las dos fuentes del tema «Ficha técnica» a partir de los paquetes de Fontsource (licencia OFL).

  · archivo-expanded-latin-wght-normal.woff2  Archivo con el ancho fijado al 125 % (extendida) y peso variable 600-900: solo titulares grandes (~25 KB).
  · chivo-mono-latin-wght-normal.woff2        Chivo Mono con peso variable 400-700: etiquetas, referencias y cifras (~24 KB).

El texto corrido y los títulos de sección usan el Archivo que ya llevaba la web (ancho normal), así que el tema nuevo solo añade ~48 KB.

  python3 -I scripts/make_ficha_fonts.py --archivo=RUTA/archivo-latin-wdth-normal.woff2 --chivo=RUTA/chivo-mono-latin-wght-normal.woff2
  (los dos archivos salen de `npm pack @fontsource-variable/archivo @fontsource-variable/chivo-mono`, carpeta package/files/)

Necesita:  pip install fonttools brotli.  Después: python3 -I scripts/inline_fonts.py  (regenera los CSS con las fuentes en base64 y en archivos).
"""
import sys
from pathlib import Path

FONTS = Path(__file__).resolve().parent.parent / "site" / "assets" / "fonts"


def option(name):
    """Valor de `--nombre=valor` en la línea de comandos (None si falta)."""
    for a in sys.argv[1:]:
        if a.startswith(f"--{name}="):
            return a.split("=", 1)[1]
    return None


def instance(src, limits, out):
    """Guarda en `out` la fuente variable `src` con los ejes recortados a `limits` (p. ej. {"wdth": 125, "wght": (600, 900)}): un número fija el eje, un par lo acota."""
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    font = instancer.instantiateVariableFont(TTFont(src), limits)
    font.flavor = "woff2"
    font.save(out)
    print(f"✓ {out.name} · {out.stat().st_size / 1024:.1f} KB")


def main():
    """Lee las dos rutas de origen, genera las dos fuentes en site/assets/fonts y avisa de qué hacer a continuación."""
    archivo, chivo = option("archivo"), option("chivo")
    if not archivo or not chivo:
        sys.exit(__doc__)
    instance(archivo, {"wdth": 125, "wght": (600, 900)}, FONTS / "archivo-expanded-latin-wght-normal.woff2")
    instance(chivo, {"wght": (400, 700)}, FONTS / "chivo-mono-latin-wght-normal.woff2")
    print("Ahora: python3 -I scripts/inline_fonts.py")


if __name__ == "__main__":
    main()
