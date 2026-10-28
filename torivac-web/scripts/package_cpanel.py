#!/usr/bin/env python3
"""[PACKAGE-CPANEL] Paquete .zip para subir a un hosting con cPanel (web estática + API PHP), verificado antes de entregarlo.

  python3 -I scripts/package_cpanel.py --base=https://pruebas.grupotorivac.com --staging     # subdominio/dominio de PRUEBAS (noindex, sin robots)
  python3 -I scripts/package_cpanel.py --base=https://www.grupotorivac.com                    # producción
Opciones:  --out=entrega (carpeta de salida) · --keep (deja también la carpeta sin comprimir) · --embed-prices (permite precios dentro de la web; NO recomendado)

Qué hace:  1) compila la web con --base y --php-api (URLs limpias, .htaccess, robots, 404 por idioma, sitemap, llms.txt)
           2) copia backend-php/api (sin tests, sin config.php) a api/
           3) verifica: ficheros imprescindibles, nada prohibido (claves, tests, scripts de trabajo, precios), php -l, SEO/enlaces (solo producción)
           4) comprime en entrega/torivac-cpanel-<host>[-pruebas]-<fecha>.zip y da el SHA-256
Qué NO lleva nunca: precios (la web los lee del servidor), config.php (claves), tests, scripts de trabajo, documentación.
Funciones: build_site · copy_api · verify · make_zip · main
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))          # `python3 -I` no añade la carpeta del script
import secret_scan  # noqa: E402  (reutiliza los patrones de claves)

REQUIRED = ["index.html", ".htaccess", "404.html", "robots.txt", "en/index.html", "en/404.html", "en/.htaccess", "fr/index.html", "de/index.html",
            "admin/index.html", "presupuesto/index.html", "contacto/index.html", "assets/data/catalog.js", "assets/data/prices.js", "assets/css/site.css",
            "api/index.php", "api/.htaccess", "api/cron.php", "api/config.sample.php", "api/generated/catalog.json", "api/lib/Router.php", "api/tools/create-user.php"]
FORBIDDEN_NAMES = {"api/config.php", "README-DEMO.txt"}
FORBIDDEN_DIRS = ("api/tests/", "api/storage/", "node_modules/", ".git/")
FORBIDDEN_EXT = {".py", ".sh", ".md", ".map", ".log", ".mjs", ".ts"}
TEXT_EXT = {".html", ".js", ".css", ".json", ".php", ".txt", ".xml", ".htaccess", ".svg", ""}


def run(cmd, **kw):
    """ejecuta y devuelve (código, salida combinada)"""
    p = subprocess.run(cmd, capture_output=True, text=True, **kw)
    return p.returncode, (p.stdout + p.stderr)


def build_site(base: str, staging: bool, out: Path) -> None:
    """compila la web de producción (la salida se cuenta línea a línea en la consola de build)"""
    cmd = ["node", str(ROOT / "site/build.mjs"), f"--base={base}", "--php-api", f"--out={out}"] + (["--staging"] if staging else [])
    code, txt = run(cmd, cwd=ROOT)
    if code:
        sys.exit("✗ la compilación falló:\n" + txt[-1500:])


def copy_api(www: Path) -> None:
    """copia el API PHP sin pruebas, sin almacén de datos y sin la configuración real (config.php lleva claves y la crea quien despliega)"""
    shutil.copytree(ROOT / "backend-php/api", www / "api", ignore=shutil.ignore_patterns("tests", "storage", "config.php", "__pycache__", "*.log"))


def shown(p: Path) -> str:
    """ruta legible: relativa al proyecto si está dentro, absoluta si no"""
    try:
        return str(p.relative_to(ROOT))
    except ValueError:
        return str(p)


def files(www: Path):
    """Todos los ficheros de la carpeta, ordenados (incluye los ocultos como .htaccess)."""
    return sorted(p for p in www.rglob("*") if p.is_file())


def verify(www: Path, base: str, staging: bool, embed_prices: bool):
    """→ (errores, avisos). Un error impide entregar el paquete."""
    errs, warns = [], []
    rel = {p.relative_to(www).as_posix(): p for p in files(www)}
    for r in REQUIRED:
        if r not in rel:
            errs.append(f"falta {r}")
    if not staging:
        for r in ("sitemap.xml", "llms.txt", "llms-full.txt"):
            if r not in rel:
                errs.append(f"falta {r} (producción)")
    for r, p in rel.items():
        if r in FORBIDDEN_NAMES or r.startswith(FORBIDDEN_DIRS) or p.suffix.lower() in FORBIDDEN_EXT:
            errs.append(f"no debe ir en el paquete: {r}")
    # claves: los mismos patrones que el escáner del repositorio, sobre todo lo que se va a publicar
    for r, p in rel.items():
        if p.suffix.lower() in TEXT_EXT or p.name == ".htaccess":
            try:
                txt = p.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            for name, rx in secret_scan.PATTERNS.items():
                m = rx.search(txt)
                if m and not secret_scan.ALLOW.search(txt[max(0, m.start() - 40):m.end() + 40]):
                    errs.append(f"posible {name} en {r}")
    # precios: la web pública no los lleva (los da el servidor); una tarifa real jamás debe quedar escrita en un .js estático
    try:
        pj = json.loads(re.search(r"TV\.prices=(\{.*\});", rel["assets/data/prices.js"].read_text(encoding="utf-8")).group(1))
        if pj.get("items") and not embed_prices:
            errs.append(f"assets/data/prices.js lleva {len(pj['items'])} precios (modo {pj.get('mode')}): la web de producción debe leerlos del servidor")
        if pj.get("mode") == "demo":
            errs.append("assets/data/prices.js está en modo DEMO")
    except Exception as e:  # noqa: BLE001
        errs.append(f"no puedo leer assets/data/prices.js: {e}")
    cat = rel["assets/data/catalog.js"].read_text(encoding="utf-8") if "assets/data/catalog.js" in rel else ""
    origin_base = base.rstrip("/")
    if f'"api":"{origin_base}"' not in cat:
        errs.append(f"catalog.js no apunta al API de la propia web ({origin_base})")
    if '"demo":false' not in cat:
        errs.append("catalog.js no está en modo producción (demo:false)")
    # entorno local olvidado en el contenido publicado
    local = re.compile(r"127\.0\.0\.1|localhost|api\.invalid")
    if not local.search(base):
        for r, p in rel.items():
            if p.suffix.lower() in {".html", ".js", ".xml", ".txt"} and local.search(p.read_text(encoding="utf-8", errors="ignore")):
                errs.append(f"referencia a un entorno local en {r}")
                break
    # robots / noindex coherentes con el modo
    robots = rel["robots.txt"].read_text(encoding="utf-8") if "robots.txt" in rel else ""
    htaccess = rel[".htaccess"].read_text(encoding="utf-8") if ".htaccess" in rel else ""
    home = rel["index.html"].read_text(encoding="utf-8") if "index.html" in rel else ""
    if staging:
        if "Disallow: /\n" not in robots + "\n":
            errs.append("robots.txt de pruebas debe prohibirlo todo")
        if "X-Robots-Tag" not in htaccess or 'content="noindex' not in home:
            errs.append("el entorno de pruebas debe llevar noindex (cabecera y meta)")
    else:
        if "Sitemap:" not in robots:
            errs.append("robots.txt sin Sitemap")
        if "noindex" in home:
            errs.append("la portada de producción lleva noindex")
    if "api/index.php" not in htaccess:
        errs.append(".htaccess sin la reescritura de /api")
    # PHP sintácticamente correcto
    if shutil.which("php"):
        for r, p in rel.items():
            if p.suffix == ".php":
                code, out = run(["php", "-l", str(p)])
                if code:
                    errs.append(f"php -l falla en {r}: {out.strip()[:120]}")
    else:
        warns.append("php no está instalado aquí: no se comprobó la sintaxis de los .php (las pruebas PHP sí se pasan en CI)")
    # SEO y enlaces internos (solo producción: el entorno de pruebas no publica sitemap)
    if not staging:
        code, out = run(["python3", "-I", str(ROOT / "scripts/seo_check.py"), str(www), f"--base={base}"])
        if code:
            errs.append("seo_check.py con errores:\n" + "\n".join(out.strip().splitlines()[-12:]))
    else:
        warns.append("entorno de pruebas: no se ejecuta seo_check (no hay sitemap); se ejecuta al empaquetar producción")
    return errs, warns


def make_zip(www: Path, dest: Path) -> str:
    """comprime la carpeta (con ficheros ocultos como .htaccess) y devuelve el SHA-256"""
    dest.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in files(www):
            zi = zipfile.ZipInfo(p.relative_to(www).as_posix(), date_time=(2026, 1, 1, 0, 0, 0))   # fecha fija: mismo contenido → mismo zip
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            z.writestr(zi, p.read_bytes())
    return hashlib.sha256(dest.read_bytes()).hexdigest()


def main():
    """Compila, copia el API, verifica y comprime; si la verificación falla no genera el .zip."""
    ap = argparse.ArgumentParser(description="Paquete cPanel de Torivac")
    ap.add_argument("--base", required=True, help="URL pública con https, sin barra final salvo subcarpeta (https://pruebas.dominio.com)")
    ap.add_argument("--staging", action="store_true", help="entorno de pruebas: noindex y robots.txt cerrado")
    ap.add_argument("--out", default="entrega")
    ap.add_argument("--keep", action="store_true")
    ap.add_argument("--embed-prices", action="store_true")
    a = ap.parse_args()
    u = urlparse(a.base)
    if u.scheme not in ("https", "http") or not u.netloc:
        sys.exit("✗ --base debe ser una URL completa, p. ej. https://pruebas.grupotorivac.com")
    if u.scheme == "http" and not re.search(r"127\.0\.0\.1|localhost", u.netloc):
        print("⚠ --base sin https: cPanel da el certificado gratis (AutoSSL); la web redirige a https solo si la URL empieza por https")
    base = a.base.rstrip("/")
    tmp = Path(tempfile.mkdtemp(prefix="tv-cpanel-"))
    www = tmp / "www"
    try:
        print(f"1/4 compilando {base}{' (PRUEBAS)' if a.staging else ''} …")
        build_site(base, a.staging, www)
        print("2/4 copiando el API PHP …")
        copy_api(www)
        print("3/4 verificando …")
        errs, warns = verify(www, base, a.staging, a.embed_prices)
        for w in warns:
            print("  ⚠", w)
        if errs:
            print("\n✗ el paquete NO se genera:")
            for e in errs:
                print("  ✗", e)
            sys.exit(1)
        host = re.sub(r"[^a-z0-9]+", "-", (u.netloc + u.path).lower()).strip("-")
        dest = ROOT / a.out / f"torivac-cpanel-{host}{'-pruebas' if a.staging and 'prueba' not in host else ''}-{date.today():%Y%m%d}.zip"
        print("4/4 comprimiendo …")
        sha = make_zip(www, dest)
        n = len(files(www))
        print(f"\n✓ {shown(dest)}  ·  {n} ficheros  ·  {dest.stat().st_size / 1048576:.1f} MB\n  SHA-256 {sha}")
        print("\nSiguiente: docs/DESPLIEGUE-CPANEL.md (subir, crear api/config.php, primer usuario manager, cron de precios).")
        if a.keep:
            keep = ROOT / a.out / dest.stem
            shutil.rmtree(keep, ignore_errors=True)
            shutil.copytree(www, keep)
            print(f"  carpeta sin comprimir: {shown(keep)}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
