#!/usr/bin/env python3
"""Sesión 15 · Índice de código para programadores: archivo → propósito → secciones [ETIQUETA] → funciones y qué hace cada una.

  python3 -I scripts/gen_code_index.py            # escribe docs/INDICE-CODIGO.md y muestra la cobertura
  python3 -I scripts/gen_code_index.py --check    # además sale con código 1 si hay archivos sin cabecera o funciones sin describir

Convención del proyecto (ver docs/CONVENCIONES.md):
  · cada archivo empieza con un comentario de cabecera: qué es, secciones, dependencias;
  · las secciones del código van marcadas con una etiqueta entre corchetes: `// ───── [ETIQUETA] descripción`;
  · cada función lleva encima un comentario (`/** … */`, `//` o docstring de Python) de una línea como mínimo.
Este script lo lee y lo vuelca a Markdown; así el índice nunca se desincroniza del código.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCAN = [
    ("site", ["*.mjs"]), ("site/lib", ["*.mjs"]), ("site/assets/js", ["*.js"]), ("site/assets/css", ["*.css"]),
    ("scripts", ["*.py", "*.mjs", "*.sh"]), ("scripts/lib", ["*.mjs"]),
    ("workers/api/src", ["*.js"]), ("workers/api/test", ["*.js"]), ("shared", ["*.mjs"]),
    ("backend-php/api", ["*.php"]), ("backend-php/api/lib", ["*.php"]), ("backend-php/api/tools", ["*.php"]), ("backend-php/api/tests", ["*.php"]),
]
JS_FUNC = [
    re.compile(r"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\("),
    re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)"),
    re.compile(r"^\s*([A-Za-z_$][\w$.]*)\s*[:=]\s*(?:async\s+)?function\s*\("),            # TV.csvParse = function (…)   |   clave: function (…)
    re.compile(r"^\s{2,}(?:async\s+)?([a-z][\w$]*)\s*\([^)]*\)\s*\{\s*$"),                   # método de objeto/clase (sangrado)
]
PHP_FUNC = re.compile(r"^\s*(?:(?:public|private|protected|static|final|abstract)\s+)*function\s+&?([A-Za-z_]\w*)\s*\(")
KEYWORDS = {"if", "for", "while", "switch", "catch", "function", "return", "else", "do", "with"}
TAG = re.compile(r"\[([A-Z][A-Z0-9\-_/ ]{1,30})\]")


def header_of(lines, lang):
    """Primer comentario del archivo (la «cabecera»)."""
    out = []
    i = 0
    if lines and lines[0].startswith("#!"):
        i = 1
    if lang == "py":
        s = "\n".join(lines[i:i + 40])
        m = re.match(r'\s*(?:#.*\n)*\s*("""|\'\'\')(.*?)\1', s, re.S)
        return m.group(2).strip().splitlines()[:6] if m else []
    while i < len(lines) and lines[i].strip() == "":
        i += 1
    while i < len(lines) and (lines[i].strip().startswith(("//", "/*", "*", "<!--", "#")) or lines[i].strip() == ""):
        t = lines[i].strip()
        if t:
            out.append(re.sub(r"^(//+|/\*+|\*+/?|#+|<!--)\s?", "", t).rstrip("*/ ").strip())
        i += 1
        if len(out) > 8:
            break
    return [x for x in out if x]


def comment_above(lines, idx):
    """Comentario inmediatamente encima de la línea idx (o al final de esa línea)."""
    j = idx - 1
    buf = []
    while j >= 0 and lines[j].strip().startswith(("//", "*", "/*", "*/", "#")):
        buf.append(re.sub(r"^(//+|/\*+|\*+/?|#+)\s?", "", lines[j].strip()).rstrip("*/ ").strip())
        j -= 1
    buf = [b for b in reversed(buf) if b and not b.startswith("─")]       # las líneas «// ───── [ETIQUETA] …» rotulan secciones: no describen la función
    if buf:
        return buf[0]
    m = re.search(r"//\s*(.+)$", lines[idx]) or re.search(r"/\*\s*(.+?)\s*\*/", lines[idx])
    return m.group(1).strip() if m else ""


def scan_js(path):
    """Lee un archivo JS/MJS: cabecera, etiquetas [SECCIÓN] y funciones con el comentario que llevan encima."""
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    funcs, tags = [], []
    for i, ln in enumerate(lines):
        for t in TAG.findall(ln if ln.strip().startswith(("//", "/*", "*")) else ""):
            if t not in tags:
                tags.append(t)
        for rx in JS_FUNC:
            m = rx.match(ln)
            if m and m.group(1) not in KEYWORDS and not ln.strip().startswith(("//", "*")):
                funcs.append((i + 1, m.group(1), comment_above(lines, i)))
                break
    return header_of(lines, "js"), tags, funcs


def scan_php(path):
    """PHP: la cabecera es el primer docblock tras `<?php`; cada método/función lleva encima un docblock o un comentario `//`."""
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    body = lines[1:] if lines and lines[0].startswith("<?php") else lines
    funcs, tags = [], []
    for i, ln in enumerate(lines):
        if ln.strip().startswith(("//", "/*", "*")):
            for t in TAG.findall(ln):
                if t not in tags:
                    tags.append(t)
        m = PHP_FUNC.match(ln)
        if m and not ln.strip().startswith(("//", "*")):
            funcs.append((i + 1, m.group(1), comment_above(lines, i)))
    return header_of(body, "js"), tags, funcs


def scan_py(path):
    """Lee un archivo Python: cabecera, etiquetas [SECCIÓN] y funciones con su docstring o comentario."""
    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    funcs, tags = [], []
    for i, ln in enumerate(lines):
        if ln.lstrip().startswith("#"):
            for t in TAG.findall(ln):
                if t not in tags:
                    tags.append(t)
        m = re.match(r"^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(", ln)
        if m:
            doc = ""
            k = i + 1
            while k < len(lines) and not lines[k].strip().endswith(":") and ")" not in lines[k - 1]:
                k += 1
            nxt = "\n".join(lines[i + 1:i + 6])
            d = re.match(r'\s*(?:r?)("""|\'\'\')(.*?)(\1|$)', nxt, re.S)
            if d:
                doc = d.group(2).strip().splitlines()[0] if d.group(2).strip() else ""
            if not doc:
                doc = comment_above(lines, i)
            funcs.append((i + 1, m.group(1), doc))
    return header_of(lines, "py"), tags, funcs


def scan_css(path):
    """Lee un archivo CSS: comentario de cabecera y etiquetas [SECCIÓN]."""
    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    head = [re.sub(r"^/\*+\s?|\s?\*+/$", "", l.strip()) for l in lines[:3] if l.strip().startswith("/*")]
    tags = []
    for ln in lines:
        for t in TAG.findall(ln):
            if t not in tags:
                tags.append(t)
    return head, tags, []


def main():
    """Recorre los archivos, escribe docs/INDICE-CODIGO.md y, con --check, falla si hay archivos sin cabecera o funciones sin describir."""
    check = "--check" in sys.argv
    out = ["# Índice de código (generado)", "", "> Generado por `scripts/gen_code_index.py`. **No editar a mano**: se rehace con `python3 -I scripts/gen_code_index.py`.",
           "> Cada archivo se describe por su cabecera; las secciones `[ETIQUETA]` marcan los bloques; cada función lleva su descripción (⚠ = falta describirla).", ""]
    tot_f = tot_doc = 0
    nohead = []
    rows = []
    for d, pats in SCAN:
        for pat in pats:
            for f in sorted((ROOT / d).glob(pat)):
                if f.name.startswith("_") or "generated" in f.parts or f.stat().st_size == 0 or f.name.endswith(".min.js"):
                    continue
                ext = f.suffix
                if ext == ".py":
                    head, tags, funcs = scan_py(f)
                elif ext == ".css":
                    head, tags, funcs = scan_css(f)
                elif ext == ".php":
                    head, tags, funcs = scan_php(f)
                elif ext == ".sh":
                    head, tags, funcs = header_of(f.read_text().splitlines(), "js"), [], []
                else:
                    head, tags, funcs = scan_js(f)
                rel = f.relative_to(ROOT).as_posix()
                if not head:
                    nohead.append(rel)
                rows.append((rel, head, tags, funcs))
    cur = None
    for rel, head, tags, funcs in rows:
        folder = rel.rsplit("/", 1)[0]
        if folder != cur:
            out += [f"## `{folder}/`", ""]
            cur = folder
        out.append(f"### `{rel.rsplit('/', 1)[1]}`")
        out.append("")
        out.append((" ".join(head[:3]) if head else "⚠ **sin cabecera**").strip())
        if tags:
            out += ["", "Secciones: " + " · ".join(f"`[{t}]`" for t in tags)]
        if funcs:
            out.append("")
            for ln, name, doc in funcs:
                tot_f += 1
                if doc:
                    tot_doc += 1
                out.append(f"- `{name}` (l. {ln}) — {doc if doc else '⚠ sin describir'}")
        out.append("")
    cov = 100 * tot_doc / max(1, tot_f)
    out.insert(4, f"**Cobertura**: {tot_doc}/{tot_f} funciones descritas ({cov:.0f} %) · {len(rows) - len(nohead)}/{len(rows)} archivos con cabecera.\n")
    (ROOT / "docs" / "INDICE-CODIGO.md").write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"archivos {len(rows)} · con cabecera {len(rows) - len(nohead)} · funciones {tot_doc}/{tot_f} descritas ({cov:.0f} %)")
    if nohead:
        print("sin cabecera:", ", ".join(nohead))
    if check and (nohead or tot_doc < tot_f):
        sys.exit(1)


if __name__ == "__main__":
    main()
