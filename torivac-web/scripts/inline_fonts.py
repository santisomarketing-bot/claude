#!/usr/bin/env python3
"""Regenera site/assets/css/fonts.css (fuentes en base64) a partir de site/assets/fonts/*.woff2. Ver cabecera de fonts.css."""
import base64, pathlib
R = pathlib.Path(__file__).resolve().parent.parent / "site" / "assets"
FACES = [
  ("Advent Pro", "advent-pro-latin-wght-normal.woff2", "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"),
  ("Advent Pro", "advent-pro-latin-ext-wght-normal.woff2", "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"),
  ("Archivo", "archivo-latin-wght-normal.woff2", "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"),
  ("Archivo", "archivo-latin-ext-wght-normal.woff2", "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"),
]
out = ["/* [FONTS] Advent Pro + Archivo (OFL), en base64 para que funcionen también con file://. Generado por scripts/inline_fonts.py */"]
files = ["/* [FONTS-FILES] Mismas fuentes como ARCHIVOS woff2 (producción por http: cacheables y sin bloquear el pintado). Generado por scripts/inline_fonts.py */"]
for fam, f, rng in FACES:
    b = base64.b64encode((R / "fonts" / f).read_bytes()).decode()
    out.append(f'@font-face{{font-family:"{fam}";font-weight:100 900;font-style:normal;font-display:swap;src:url(data:font/woff2;base64,{b}) format("woff2");unicode-range:{rng}}}')
    files.append(f'@font-face{{font-family:"{fam}";font-weight:100 900;font-style:normal;font-display:swap;src:url(../fonts/{f}) format("woff2");unicode-range:{rng}}}')
(R / "css" / "fonts.css").write_text("\n".join(out) + "\n")
(R / "css" / "fonts-files.css").write_text("\n".join(files) + "\n")
print("fonts.css", round((R / "css" / "fonts.css").stat().st_size / 1024), "KB")
