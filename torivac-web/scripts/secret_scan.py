#!/usr/bin/env python3
"""Sesión 16 · Escáner de secretos (claves de API, claves privadas, tokens) en los archivos versionados de torivac-web.

  python3 -I scripts/secret_scan.py            # sale con código 1 si encuentra algo
Los valores de prueba de los tests (sk-test, re_test, master-test…) están en la lista blanca. Las claves REALES van siempre como secretos
del Worker (`wrangler secret put`) o de GitHub Actions, nunca en el código.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATTERNS = {
    "Anthropic/OpenAI": re.compile(r"\bsk-(?:ant-|proj-)?[A-Za-z0-9_\-]{24,}"),
    "Resend": re.compile(r"\bre_[A-Za-z0-9]{20,}"),
    "AWS": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "Google API": re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b"),
    "GitHub": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
    "Slack": re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}"),
    "Clave privada": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----"),
    "Cloudflare": re.compile(r"\bcfut_[A-Za-z0-9]{30,}"),
}
ALLOW = re.compile(r"sk-test|re_test|master-test|sk-ant-xxx|EXAMPLE|placeholder", re.I)
SKIP_DIRS = {"node_modules", ".git", "dist", "entrega"}
# las pruebas generan una clave RSA efímera en memoria para firmar un JWT de ejemplo (no es una clave real)
ALLOW_PATH = {"Clave privada": ("workers/api/test/",)}
SKIP_EXT = {".png", ".jpg", ".jpeg", ".webp", ".pdf", ".woff2", ".xlsx", ".zip", ".ico", ".gif"}


def tracked():
    """Rutas absolutas de los archivos versionados en git (git ls-files)."""
    out = subprocess.run(["git", "ls-files", "--", "."], cwd=ROOT, capture_output=True, text=True).stdout.split("\n")
    return [ROOT / p for p in out if p]


def main():
    """Busca patrones de claves y tokens en los archivos versionados; sale con código 1 si hay alguno fuera de la lista blanca."""
    hits = []
    for f in tracked():
        rel = f.relative_to(ROOT)
        if rel.parts[0] in SKIP_DIRS or f.suffix.lower() in SKIP_EXT or not f.is_file() or f.stat().st_size > 3_000_000:
            continue
        try:
            text = f.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for i, line in enumerate(text.splitlines(), 1):
            for name, rx in PATTERNS.items():
                m = rx.search(line)
                if m and not ALLOW.search(line) and not str(rel).startswith(ALLOW_PATH.get(name, ('\0',))):
                    hits.append((str(rel), i, name, m.group(0)[:8] + "…"))
    for h in hits:
        print(f"✗ {h[0]}:{h[1]} · posible {h[2]} ({h[3]})")
    print(f"{len(hits)} posibles secretos" if hits else "✓ sin secretos en los archivos versionados")
    sys.exit(1 if hits else 0)


if __name__ == "__main__":
    main()
