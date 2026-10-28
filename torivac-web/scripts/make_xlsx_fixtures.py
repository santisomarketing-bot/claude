#!/usr/bin/env python3
"""[XLSX-FIXTURES] Genera los libros de ejemplo con los que se prueban los lectores de .xlsx del servidor (Worker en JS y API en PHP):

  python3 -I scripts/make_xlsx_fixtures.py          → shared/xlsx/tarifa-openpyxl.xlsx · shared/xlsx/artesanal.xlsx · shared/xlsx/esperado.json

· tarifa-openpyxl.xlsx  libro escrito por openpyxl (como hará quien exporte desde Python): cadenas compartidas, números con 8 decimales, dos hojas.
· artesanal.xlsx        libro escrito a mano con lo que un Excel real puede traer y openpyxl no: texto enriquecido y con entidades XML, cadenas «inline»,
                        resultados de fórmula, booleanos, notación científica, celdas salteadas, filas con huecos, hoja oculta y orden de hojas distinto al de los ficheros,
                        y una entrada del zip sin comprimir.
· esperado.json         lo que DEBEN devolver los dos lectores para cada libro: [{name, hidden, rows}] (las filas sin celdas no se listan).
Los datos son inventados: no hay precios de Torivac en el repositorio.
"""
import json
import zipfile
from pathlib import Path

import openpyxl

OUT = Path(__file__).resolve().parent.parent / "shared" / "xlsx"
OUT.mkdir(parents=True, exist_ok=True)
FIXED = (2026, 1, 1, 0, 0, 0)


def openpyxl_book():
    """Escribe tarifa-openpyxl.xlsx con openpyxl: dos hojas (Notas y Tarifa) y precios con 8 decimales."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Notas"
    ws.append(["Tarifa de ejemplo", "no es una tarifa real"])
    ws2 = wb.create_sheet("Tarifa")
    ws2.append(["Artículo", "Descripción", "Precio venta"])
    ws2.append(["TT0150117EM", "TRAFO TOROID 152VA 230V/117V-1.3A.", 37.01215908])
    ws2.append(["TT0330212", "TRAFO. TOROIDAL 330VA 230V/2x12V ", 60.09588284])
    ws2.append(["TT00302075", None, 24.38303161])
    ws2.append(["ZZ999", "código que no es de ninguna familia", 5])
    wb.save(OUT / "tarifa-openpyxl.xlsx")


def put(z, name, data, stored=False):
    """Añade una entrada al zip con fecha fija (salida reproducible), comprimida o sin comprimir."""
    zi = zipfile.ZipInfo(name, date_time=FIXED)
    zi.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
    z.writestr(zi, data)


def handmade_book():
    """Escribe artesanal.xlsx a mano (XML) con lo que openpyxl no genera: texto enriquecido, «inline», fórmulas, booleanos, hoja oculta y una entrada sin comprimir."""
    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    rel = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    hdr = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    with zipfile.ZipFile(OUT / "artesanal.xlsx", "w") as z:
        put(z, "[Content_Types].xml", hdr + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
            + "".join(f'<Override PartName="/xl/worksheets/sheet{n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for n in (1, 2, 9)) + '</Types>')
        put(z, "_rels/.rels", hdr + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        put(z, "xl/workbook.xml", hdr + f'<workbook {ns} {rel}><sheets><sheet name="Notas &amp; avisos" sheetId="5" r:id="rId7"/><sheet name="Oculta" sheetId="2" state="hidden" r:id="rId3"/><sheet name="Tarifa" sheetId="1" r:id="rId2"/></sheets></workbook>')
        put(z, "xl/_rels/workbook.xml.rels", hdr + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet2.xml"/>'
            '<Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet9.xml"/></Relationships>')
        put(z, "xl/sharedStrings.xml", hdr + f'<sst {ns} count="7" uniqueCount="6">'
            '<si><t>Artículo</t></si>'
            '<si><t xml:space="preserve"> Descripción </t></si>'
            '<si><r><rPr><b/></rPr><t>Precio </t></r><r><t>venta</t></r></si>'
            '<si><t>TRAFO &amp; "TOROIDAL" &lt;30VA&gt; &#xC1;&#209;</t></si>'
            '<si><t>FIN</t><rPh sb="0" eb="1"><t>ignorar esto</t></rPh><phoneticPr fontId="1"/></si>'
            '<si><t>Hoja de avisos</t></si></sst>')
        put(z, "xl/worksheets/sheet1.xml", hdr + f'<worksheet {ns}><dimension ref="A1:D6"/><sheetData>'
            '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>'
            '<row r="2"><c r="A2" t="inlineStr"><is><t>TT0020210</t></is></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>12.37</v></c></row>'
            '<row r="3"><c r="A3" t="str"><f>"TT"&amp;"0030210"</f><v>TT0030210</v></c><c r="C3" t="n"><v>27.75093203</v></c></row>'
            '<row r="5"><c r="A5" t="s"><v>4</v></c><c r="C5"><v>1.5E-3</v></c><c r="D5" t="b"><v>1</v></c></row>'
            '<row r="6"><c r="B6"/><c r="C6"><v>22000</v></c></row>'
            '</sheetData></worksheet>', stored=True)
        put(z, "xl/worksheets/sheet2.xml", hdr + f'<worksheet {ns}><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>oculta</t></is></c></row></sheetData></worksheet>')
        put(z, "xl/worksheets/sheet9.xml", hdr + f'<worksheet {ns}><sheetData><row r="1"><c r="A1" t="s"><v>5</v></c></row></sheetData></worksheet>')


def expected():
    """Resultado que deben devolver los dos lectores (JS y PHP) para cada libro."""
    return {
        "tarifa-openpyxl.xlsx": [
            {"name": "Notas", "hidden": False, "rows": [["Tarifa de ejemplo", "no es una tarifa real"]]},
            {"name": "Tarifa", "hidden": False, "rows": [
                ["Artículo", "Descripción", "Precio venta"],
                ["TT0150117EM", "TRAFO TOROID 152VA 230V/117V-1.3A.", 37.01215908],
                ["TT0330212", "TRAFO. TOROIDAL 330VA 230V/2x12V ", 60.09588284],
                ["TT00302075", "", 24.38303161],
                ["ZZ999", "código que no es de ninguna familia", 5]]},
        ],
        "artesanal.xlsx": [
            {"name": "Notas & avisos", "hidden": False, "rows": [["Hoja de avisos"]]},
            {"name": "Oculta", "hidden": True, "rows": [["oculta"]]},
            {"name": "Tarifa", "hidden": False, "rows": [
                ["Artículo", " Descripción ", "Precio venta"],
                ["TT0020210", 'TRAFO & "TOROIDAL" <30VA> ÁÑ', 12.37],
                ["TT0030210", "", 27.75093203],
                ["FIN", "", 0.0015, True],
                ["", "", 22000]]},
        ],
    }


if __name__ == "__main__":
    openpyxl_book()
    handmade_book()
    (OUT / "esperado.json").write_text(json.dumps(expected(), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("✓ shared/xlsx: tarifa-openpyxl.xlsx · artesanal.xlsx · esperado.json")
