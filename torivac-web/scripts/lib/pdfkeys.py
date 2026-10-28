"""Utilidades comunes de los scripts de PDFs: claves de comparación independientes del idioma.

  alnum(s)       minúsculas sin acentos ni signos
  model_key(ref) clave de modelo (código impreso, «MOD. 15», «30 VA», «2x250W», LED «3mm dibujo 1»…) igual en español e inglés
Las usan scripts/contrast_pdfs.py (ES↔EN) y scripts/link_pdfs.py (duplicados catálogo↔ficha).
"""
import re
import unicodedata


def alnum(s):
    """clave de comparación: minúsculas, sin acentos ni signos"""
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", s)


def model_key(ref):
    """clave de modelo independiente del idioma: código impreso (TT0020210, BOS014, CA0050180, PC12, 29DF), «MOD. 15», «30 VA», «2x250W», «3W», LED «3mm dibujo 1»… o, si no, el texto en alfanumérico"""
    r = str(ref or "").strip()
    if re.fullmatch(r"[A-Z]{1,4}\d{2,}[A-Z0-9]*|\d{2,3}DF", r):
        return r.lower()
    if re.fullmatch(r"\d{1,3}", r):
        return "mod" + r
    m = re.search(r"\bmod\.?\s*(\d+)", r, re.I)
    if m:
        return "mod" + m.group(1)
    m = re.search(r"(\d+)\s*x\s*(\d+)\s*(k?va|w)\b", r, re.I)
    if m:
        return f"{m.group(1)}x{m.group(2)}{m.group(3).lower()}"
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(k?va)\b", r, re.I)
    if m:
        extra = re.search(r"[Øø]\s*(\d+(?:[.,]\d+)?)", r) or re.search(r"(?:fila|row)\s*(\d+)", r, re.I)
        return m.group(1).replace(",", ".") + m.group(2).lower() + (("-" + extra.group(1)) if extra else "")
    m = re.search(r"(\d+)\s*mm", r, re.I)
    d = re.search(r"(?:dibujo|drawing)\s*(\d)", r, re.I)
    if m and d:
        return f"led{m.group(1)}mm-d{d.group(1)}"
    m = re.fullmatch(r"(?:potenci[oó]metro\s+)?(\d+)\s*w(?:\s+potentiometer)?", r, re.I) or re.fullmatch(r"(\d+)\s*w\s+potentiometer", r, re.I)
    if m:
        return f"{m.group(1)}w"
    if re.search(r"(doble|twin)", r, re.I) and re.search(r"2\s*x\s*3", r):
        return "2x3w"
    if re.search(r"parcial|partial", r, re.I):
        return "encapsulado-parcial"
    if re.search(r"completo|complete", r, re.I):
        return "encapsulado-completo"
    return alnum(r)
