#!/usr/bin/env python3
"""Regenera los CSS de fuentes a partir de site/assets/fonts/*.woff2 (ver la cabecera de cada CSS).

  fonts.css / fonts-files.css              Advent Pro + Archivo (aspecto «Clásico»): en base64 (también con file://) y como archivos woff2 (producción)
  fonts-ficha.css / fonts-ficha-files.css  Archivo extendida + Chivo Mono (aspecto «Ficha técnica»): igual, en las dos formas
Las fuentes del aspecto nuevo se generan con scripts/make_ficha_fonts.py. Todas son OFL (licencias junto a los archivos).
"""
import base64, pathlib
R = pathlib.Path(__file__).resolve().parent.parent / "site" / "assets"
LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
LATIN_EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
CLASSIC = [
  ("Advent Pro", "advent-pro-latin-wght-normal.woff2", LATIN, "100 900"),
  ("Advent Pro", "advent-pro-latin-ext-wght-normal.woff2", LATIN_EXT, "100 900"),
  ("Archivo", "archivo-latin-wght-normal.woff2", LATIN, "100 900"),
  ("Archivo", "archivo-latin-ext-wght-normal.woff2", LATIN_EXT, "100 900"),
]
FICHA = [
  ("Archivo Expanded", "archivo-expanded-latin-wght-normal.woff2", LATIN, "600 900"),
  ("Chivo Mono", "chivo-mono-latin-wght-normal.woff2", LATIN, "400 700"),
]


def face(fam, weight, src, rng):
    """Regla @font-face de la familia `fam` con el rango de pesos `weight`, el origen `src` (url(...)) y el rango Unicode `rng`."""
    return f'@font-face{{font-family:"{fam}";font-weight:{weight};font-style:normal;font-display:swap;src:{src} format("woff2");unicode-range:{rng}}}'


def write(faces, name, title_inline, title_files):
    """Escribe <name>.css (base64) y <name>-files.css (archivos woff2) con las familias de `faces`."""
    out, files = [title_inline], [title_files]
    for fam, f, rng, weight in faces:
        b = base64.b64encode((R / "fonts" / f).read_bytes()).decode()
        out.append(face(fam, weight, f"url(data:font/woff2;base64,{b})", rng))
        files.append(face(fam, weight, f"url(../fonts/{f})", rng))
    (R / "css" / f"{name}.css").write_text("\n".join(out) + "\n")
    (R / "css" / f"{name}-files.css").write_text("\n".join(files) + "\n")
    print(f"{name}.css", round((R / "css" / f"{name}.css").stat().st_size / 1024), "KB")


write(CLASSIC, "fonts",
      "/* [FONTS] Advent Pro + Archivo (OFL), en base64 para que funcionen también con file://. Generado por scripts/inline_fonts.py */",
      "/* [FONTS-FILES] Mismas fuentes como ARCHIVOS woff2 (producción por http: cacheables y sin bloquear el pintado). Generado por scripts/inline_fonts.py */")
write(FICHA, "fonts-ficha",
      "/* [FONTS-FICHA] Archivo extendida + Chivo Mono (OFL) del aspecto «Ficha técnica», en base64 para file://. Generado por scripts/inline_fonts.py */",
      "/* [FONTS-FICHA-FILES] Las mismas como ARCHIVOS woff2 (producción por http). Generado por scripts/inline_fonts.py */")
