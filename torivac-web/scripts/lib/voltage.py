"""Etiquetas de voltaje: taxonomía y reglas con evidencia (sin IA, sin inventar).

La web original casi no tiene etiquetas de tensión; las que se publican salen SOLO de:
  · tablas/cabeceras/menciones del PDF verificado enlazado a la ficha (family_tags / model_tags)
  · frases literales de la propia ficha de la web, revisadas una a una (data/catalog/voltage-curated.json)
Lo que no tiene evidencia no lleva etiqueta; los candidatos dudosos van a propuestas del panel.

  TAGS            taxonomía (id → etiqueta por idioma, título, tipo visual, orden, si sirve de filtro)
  family_tags()   etiquetas de producto deducidas de las columnas «In 230 (A)»… y de las menciones de tensión del PDF
  model_tags()    etiquetas de una variante (secundarios «2x12», escala grabada «0-230v»)
"""
import re

L = lambda es, en, fr, de: {"es": es, "en": en, "fr": fr, "de": de}  # noqa: E731


def _sec(n):
    return {"label": f"2×{n} V", "title": L(f"Dos secundarios de {n} V (en serie: {2 * float(n):g} V)", f"Two {n} V secondaries (in series: {2 * float(n):g} V)", f"Deux secondaires de {n} V (en série : {2 * float(n):g} V)", f"Zwei {n}-V-Sekundärwicklungen (in Reihe: {2 * float(n):g} V)"), "kind": "ac", "filter": True}


TAGS = {
    "230v": {"label": "230 V", "title": L("Tensión de 230 V (entrada o primario, según la ficha)", "230 V (input or primary, as stated on the datasheet)", "230 V (entrée ou primaire, selon la fiche)", "230 V (Eingang oder Primärseite laut Datenblatt)"), "kind": "ac", "sort": 10, "filter": True},
    "400v": {"label": "400 V", "title": L("Tensión de 400 V trifásica (entrada, según la ficha)", "400 V three-phase (input, as stated on the datasheet)", "400 V triphasé (entrée, selon la fiche)", "400 V dreiphasig (Eingang laut Datenblatt)"), "kind": "three-phase", "sort": 20, "filter": True},
    "out-0-230": {"label": "0–230 V", "title": L("Tensión de salida regulable de 0 a 230 V", "Adjustable output voltage from 0 to 230 V", "Tension de sortie réglable de 0 à 230 V", "Einstellbare Ausgangsspannung von 0 bis 230 V"), "kind": "range", "sort": 30, "filter": True},
    "out-0-240ac": {"label": "0–240 V AC", "title": L("Tensión de salida variable de 0 a 240 V AC (monofásico)", "Variable output voltage 0–240 V AC (single-phase)", "Tension de sortie variable 0–240 V AC (monophasé)", "Variable Ausgangsspannung 0–240 V AC (einphasig)"), "kind": "range", "sort": 31, "filter": True},
    "out-0-440ac": {"label": "0–440 V AC", "title": L("Tensión de salida variable de 0 a 440 V AC (trifásico)", "Variable output voltage 0–440 V AC (three-phase)", "Tension de sortie variable 0–440 V AC (triphasé)", "Variable Ausgangsspannung 0–440 V AC (dreiphasig)"), "kind": "range", "sort": 32, "filter": True},
    "dc-0-30": {"label": "0–30 V DC", "title": L("Salida de corriente continua de 0 a 30 V", "DC output 0–30 V", "Sortie courant continu 0–30 V", "Gleichstromausgang 0–30 V"), "kind": "dc", "sort": 40, "filter": True},
    "dc-15-30": {"label": "15–30 V DC", "title": L("Entrada de corriente continua de 15 a 30 V", "DC input 15–30 V", "Entrée courant continu 15–30 V", "Gleichstromeingang 15–30 V"), "kind": "dc", "sort": 41, "filter": True},
    "ctrl-0-10": {"label": "0–10 V DC", "title": L("Señal de control analógica 0-10 V DC", "0–10 V DC analogue control signal", "Signal de commande analogique 0–10 V DC", "Analoges Steuersignal 0–10 V DC"), "kind": "dc", "sort": 42, "filter": False},
    "bat-12": {"label": L("Batería 12 V", "12 V battery", "Batterie 12 V", "12-V-Batterie"), "title": L("Tensión nominal de batería 12 V", "Nominal battery voltage 12 V", "Tension nominale de batterie 12 V", "Nennspannung der Batterie 12 V"), "kind": "dc", "sort": 50, "filter": True},
    "bat-24": {"label": L("Batería 24 V", "24 V battery", "Batterie 24 V", "24-V-Batterie"), "title": L("Tensión nominal de batería 24 V", "Nominal battery voltage 24 V", "Tension nominale de batterie 24 V", "Nennspannung der Batterie 24 V"), "kind": "dc", "sort": 51, "filter": True},
    "bat-48": {"label": L("Batería 48 V", "48 V battery", "Batterie 48 V", "48-V-Batterie"), "title": L("Tensión nominal de batería 48 V", "Nominal battery voltage 48 V", "Tension nominale de batterie 48 V", "Nennspannung der Batterie 48 V"), "kind": "dc", "sort": 52, "filter": True},
    "in-15-80": {"label": L("Entrada 15–80 V", "Input 15–80 V", "Entrée 15–80 V", "Eingang 15–80 V"), "title": L("Tensión admisible en la entrada: 15 a 80 V", "Permitted input voltage: 15 to 80 V", "Tension d'entrée admissible : 15 à 80 V", "Zulässige Eingangsspannung: 15 bis 80 V"), "kind": "dc", "sort": 53, "filter": False},
    "line-100": {"label": L("Línea 100 V", "100 V line", "Ligne 100 V", "100-V-Leitung"), "title": L("Transformadores de línea de 100 V (audio)", "100 V line (audio) transformers", "Transformateurs de ligne 100 V (audio)", "100-V-Leitungsübertrager (Audio)"), "kind": "ac", "sort": 60, "filter": False},
    "work-1000ac": {"label": "≈1000 V AC", "title": L("Tensión de trabajo aproximada de 1 000 V AC", "Approximate working voltage 1,000 V AC", "Tension de service approximative 1 000 V AC", "Ungefähre Betriebsspannung 1 000 V AC"), "kind": "ac", "sort": 61, "filter": False},
    "scale-230": {"label": L("Escala 0–230 V", "0–230 V scale", "Échelle 0–230 V", "Skala 0–230 V"), "title": L("Escala grabada de 0 a 230 V (no es una tensión de servicio)", "Printed scale 0–230 V (not an operating voltage)", "Échelle gravée 0–230 V (pas une tension de service)", "Aufgedruckte Skala 0–230 V (keine Betriebsspannung)"), "kind": "range", "sort": 70, "filter": False},
    "scale-250": {"label": L("Escala 0–250 V", "0–250 V scale", "Échelle 0–250 V", "Skala 0–250 V"), "title": L("Escala grabada de 0 a 250 V (no es una tensión de servicio)", "Printed scale 0–250 V (not an operating voltage)", "Échelle gravée 0–250 V (pas une tension de service)", "Aufgedruckte Skala 0–250 V (keine Betriebsspannung)"), "kind": "range", "sort": 71, "filter": False},
}
for _n in (6, 7.5, 9, 10, 12, 15, 18, 20, 22, 24, 25, 26, 28, 30, 35, 40, 45, 50, 55):
    _k = f"{_n:g}"
    TAGS[f"sec-{_k}"] = {**_sec(_k), "sort": 100 + float(_n)}


def family_tags(fam, doc):
    """etiquetas de PRODUCTO deducidas del PDF: columnas «In 230 (A)» / «In 400 (A)» de las tablas (corriente nominal a esa tensión) y menciones de tensión de entrada/primario.
    Devuelve [(tag, evidencia)]"""
    out, seen = [], set()

    def add(tag, why):
        if tag not in seen:
            seen.add(tag)
            out.append((tag, why))
    cols = {c for m in fam.get("models", []) for c in (m.get("specs") or {})}
    for c in sorted(cols):
        m = re.match(r"In\s*(\d{3})\b", c)
        if m and m.group(1) == "230":
            add("230v", f"columna «{c}» de la tabla del PDF")
        if m and m.group(1) == "400":
            add("400v", f"columna «{c}» de la tabla del PDF")
    pages = {m.get("page") for m in fam.get("models", []) if m.get("page")} | {fam.get("page")}
    for v in doc.get("voltage_mentions") or []:
        if v.get("page") not in pages:
            continue
        txt = f"{v.get('raw', '')} {v.get('normalized_hint', '')}".lower()
        if re.search(r"(entrada|input|primario|primary)\W{0,3}\s*230|230\s*v\s*(ac)?\s*\((?:input|entrada|primario|primary)", txt):
            add("230v", f"PDF folio {v.get('page')}: «{str(v.get('raw'))[:60]}»")
        if re.search(r"(entrada|input|primario|primary)\W{0,3}\s*400|400\s*v\s*(ac)?\s*\((?:input|entrada)", txt):
            add("400v", f"PDF folio {v.get('page')}: «{str(v.get('raw'))[:60]}»")
    return out


def model_tags(model):
    """etiquetas de una VARIANTE: secundarios «2x12» (columna V) y escala grabada «0-230v»"""
    out = []
    for col, val in (model.get("specs") or {}).items():
        v = str(val or "")
        if re.fullmatch(r"V", col.strip()):
            m = re.fullmatch(r"\s*2\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*", v)
            if m:
                n = f"{float(m.group(1).replace(',', '.')):g}"
                if f"sec-{n}" in TAGS:
                    out.append((f"sec-{n}", f"columna V del PDF: {v}"))
        if re.search(r"grabado|printed", col, re.I):
            m = re.fullmatch(r"\s*0\s*[-–]\s*(230|250)\s*v\s*", v, re.I)
            if m:
                out.append((f"scale-{m.group(1)}", f"escala grabada del PDF: {v}"))
    return out
