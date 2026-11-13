#!/usr/bin/env python3
"""Plan de mejora 2027 (12/11/2026) · Datos que Torivac debe confirmar antes de publicar contenido nuevo → PROPUESTAS para el panel.
La web NO se modifica: cada punto queda como propuesta «pendiente» (tipo missing_data) para que lo resuelva quien corresponda (equipo comercial o técnico).

  python3 -I scripts/plan2027_proposals.py     # escribe data/analysis/plan2027-proposals-raw.json (lo recoge enrich_catalog.py)
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = "Plan de mejora 2027 (12/11/2026)"

# (título, campo, valor actual en la web, recomendación, gravedad)
CONFIRMAR = [
    ("Ubicación exacta de la planta y qué actividades se hacen en cada una", "planta", None,
     "Confirmar dónde se fabrica y qué procesos se realizan internamente. Sin esto no se publican «fabricante europeo», «manufactured in Spain» ni «Torivac Europe».", "alta"),
    ("Rangos técnicos reales por familia: potencias, tensiones, frecuencias, aislamiento y montaje", "rangos", None,
     "Aportar los rangos validados por ingeniería. Las tablas comparativas (AVS/BAVS, variadores, resistencias) solo se rellenan con estos datos.", "alta"),
    ("Volumen mínimo por referencia y política de prototipos", "minimos", None,
     "Decidir si puede comunicarse públicamente. Mientras tanto, los textos nuevos dicen que se confirma para cada proyecto.", "media"),
    ("Certificaciones, ensayos, documentación y normas aplicables por producto", "certificaciones", None,
     "Listar solo lo realmente acreditado y con documento. No se publica ninguna certificación sin respaldo.", "alta"),
    ("Plazos medios y capacidad de fabricación", "plazos", None,
     "Indicar solo si pueden comunicarse y mantenerse. Hasta entonces los textos dicen que los plazos se confirman para cada proyecto.", "media"),
    ("Antigüedad: actividad desde 1964, fecha legal de constitución y antigüedad de la gama toroidal", "antiguedad", None,
     "Aclarar la relación entre las tres fechas para redactar la historia de la empresa sin afirmaciones ambiguas.", "media"),
    ("Relación entre los modelos AVS / BAVS y sus aplicaciones", "avs-bavs", None,
     "Validar qué aplicación corresponde a cada tecnología (electromecánica frente a electrónica) antes de publicar el comparador.", "media"),
    ("Formulación exacta de las afirmaciones de fabricación europea", "fabricacion-europea", None,
     "Redactar con el equipo comercial la frase que se puede publicar y en qué idiomas.", "alta"),
    ("Responsables de cada idioma: usuario comercial y traductor", "responsables", None,
     "Indicar quién aprueba el texto comercial (afirmaciones, condiciones) y quién valida las traducciones EN, FR y DE.", "media"),
]

# términos que el plan marca solo como «puntos de revisión semántica»: no se cambian; si son deliberados se documenta y se conservan
TERMINOS = [
    ("en", "Toroidal shocks", "Posible traducción ambigua en inglés de «choques toroidales»"),
    ("fr", "Portails", "Posible término ambiguo en francés"),
    ("de", "Antrieben", "Posible término ambiguo en alemán"),
]


def main():
    """Genera las propuestas del plan 2027 (datos a confirmar, unidad de potencia y términos a revisar) en plan2027-proposals-raw.json."""
    out = []
    for title, field, value, rec, sev in CONFIRMAR:
        out.append({"type": "missing_data", "lang": "es", "product_name": "Contenido nuevo (plan 2027)", "field": field, "title": title, "web_value": value, "pdf_value": None,
                    "severity": sev, "recommendation": rec, "confidence": "alta", "evidence": {"source": SOURCE}})
    out.append({"type": "missing_data", "lang": "es", "product_name": "Resistencias | Bancos de carga", "field": "potencia", "title": "Rango «50W a 200K W»: confirmar la unidad y el valor máximo",
                "web_value": "50W a 200K W", "pdf_value": None, "severity": "media", "confidence": "alta",
                "recommendation": "El texto de la web original dice «50W a 200K W» (aparece en 5 categorías). Confirmar si debe ser «50 W a 200 kW» y unificar. No se modifica nada hasta que Torivac lo confirme.",
                "evidence": {"source": SOURCE}})
    for lang, term, why in TERMINOS:
        out.append({"type": "missing_data", "lang": lang, "product_name": f"Terminología ({lang.upper()}): «{term}»", "field": "terminología", "title": f"{why}: confirmar si es deliberado",
                    "web_value": term, "pdf_value": None, "severity": "baja", "confidence": "media",
                    "recommendation": "El plan 2027 lo señala solo como punto de revisión semántica. Si Torivac lo usa a propósito se documenta el motivo y se conserva; no se cambia por defecto.",
                    "evidence": {"source": SOURCE}})
    (ROOT / "data" / "analysis" / "plan2027-proposals-raw.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"{len(out)} propuestas del plan 2027 → data/analysis/plan2027-proposals-raw.json")


if __name__ == "__main__":
    main()
