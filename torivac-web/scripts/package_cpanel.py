#!/usr/bin/env python3
"""[PACKAGE-CPANEL] Paquete .zip para subir a un hosting con cPanel o Plesk (Apache + PHP; web estática + API PHP), verificado antes de entregarlo.
(El nombre del script es histórico: el paquete es el mismo para cualquier hosting con Apache y PHP 7.4+.)

  python3 -I scripts/package_cpanel.py --base=https://pruebas.grupotorivac.com --staging     # subdominio/dominio de PRUEBAS (noindex, sin robots)
  python3 -I scripts/package_cpanel.py --base=https://www.grupotorivac.com                    # producción
Opciones:  --out=entrega (carpeta de salida) · --keep (deja también la carpeta sin comprimir) · --embed-prices (permite precios dentro de la web; NO recomendado)
           --theme=ficha|clasico|original (aspecto por defecto; ficha = «Ficha técnica», el nuevo; original = la web actual de grupotorivac.com) · --theme-switch / --no-theme-switch (botones para que quien visita elija aspecto:
           por defecto SÍ en pruebas, para que el cliente compare, y NO en producción, donde se publica uno solo)

Qué hace:  1) compila la web con --base y --php-api (URLs limpias, .htaccess, robots, 404 por idioma, sitemap, llms.txt)
           2) copia a api/ SOLO los archivos permitidos de backend-php/api (lista blanca: código, .htaccess y datos generados; sin tests, sin config.php, sin copias de seguridad)
           3) verifica: ficheros imprescindibles, nada prohibido (claves, tests, scripts de trabajo, precios), php -l, SEO/enlaces (solo producción)
           4) comprime en entrega/torivac-web-<host>[-pruebas]-<fecha>.zip y da el SHA-256
Qué NO lleva nunca: precios (la web los lee del servidor), config.php (claves), tests, scripts de trabajo, documentación.
           --allow-dirty (permite empaquetar PRODUCCIÓN con cambios sin commitear; por defecto no, para poder rehacer y repetir exactamente ese paquete)
Cada paquete lleva api/generated/build.json (versión = commit, fecha del commit, URL base, pruebas/producción, aspecto): el Diagnóstico del panel lo enseña, para saber qué hay publicado.
Funciones: git_version · build_site · copy_api · write_build_info · check_versions · check_csp · check_wp_probes · check_blog · verify · make_zip · main
"""
import argparse
import base64
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
            "api/index.php", "api/page.php", "api/.htaccess", "api/cron.php", "api/config.sample.php", "api/generated/catalog.json", "api/generated/admin-data.json", "api/generated/build.json", "api/lib/Router.php", "api/lib/BlogPage.php", "api/tools/create-user.php",
            "api/generated/blog-shell.es.json", "api/generated/blog-shell.en.json", "api/generated/blog-shell.fr.json", "api/generated/blog-shell.de.json"]
# material de demostración o de gestión interna que NO debe ser público en una web con servidor: el panel de demo (lleva credenciales de ejemplo), las hojas de precios de demostración
# y las propuestas/cobertura del catálogo (solo las sirve el servidor a un manager: GET /api/admin/data)
FORBIDDEN_NAMES = {"api/config.php", "README-DEMO.txt", "assets/js/admin.js", "assets/data/prices.demo.csv", "assets/data/prices.demo.xlsx", "assets/data/proposals.js", "assets/data/admin-data.js"}
FORBIDDEN_DIRS = ("api/tests/", "api/storage/", "node_modules/", ".git/")
FORBIDDEN_EXT = {".py", ".sh", ".md", ".map", ".log", ".mjs", ".ts"}
TEXT_EXT = {".html", ".js", ".css", ".json", ".php", ".txt", ".xml", ".htaccess", ".svg", ""}
# LISTA BLANCA del API: dentro de api/ solo estos archivos pueden ir en el paquete (un config.php.bak, un volcado o un .env olvidados no llegan jamás al servidor)
API_ALLOWED = re.compile(r"^api/(index\.php|page\.php|\.htaccess|cron\.php|config\.sample\.php|lib/[A-Za-z0-9_]+\.php|tools/[a-z0-9\-]+\.php|generated/(catalog|admin-data|build)\.json|generated/blog-shell\.(es|en|fr|de)\.json)$")


def run(cmd, **kw):
    """ejecuta y devuelve (código, salida combinada)"""
    p = subprocess.run(cmd, capture_output=True, text=True, **kw)
    return p.returncode, (p.stdout + p.stderr)


def git_version() -> tuple:
    """→ (versión, fecha del commit, limpio): hash corto del commit actual, su fecha y si el árbol de trabajo no tiene cambios sin commitear; ('sin-git', '', True) si no hay git."""
    code, out = run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT)
    if code:
        return "sin-git", "", True
    _, when = run(["git", "show", "-s", "--format=%cI", "HEAD"], cwd=ROOT)
    _, dirty = run(["git", "status", "--porcelain", "--", "."], cwd=ROOT)
    return out.strip(), when.strip(), not dirty.strip()


def write_build_info(www: Path, version: str, committed_at: str, clean: bool, base: str, staging: bool, theme: str, switch) -> None:
    """escribe api/generated/build.json: qué versión es este paquete (sin hora de compilación, para que el mismo commit dé el mismo .zip)"""
    info = {"version": version + ("" if clean else "+cambios"), "committed_at": committed_at, "base": base, "staging": staging, "theme": theme,
            "theme_switch": staging if switch is None else bool(switch)}
    (www / "api" / "generated" / "build.json").write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_site(base: str, staging: bool, out: Path, theme: str = "ficha", switch=None, google_demo: bool = False) -> None:
    """compila la web de producción (la salida se cuenta línea a línea en la consola de build); `switch` None = el valor por defecto del compilador (sí en pruebas, no en producción)"""
    cmd = ["node", str(ROOT / "site/build.mjs"), f"--base={base}", "--php-api", f"--out={out}", f"--theme={theme}"] + (["--staging"] if staging else []) + ([] if switch is None else ["--theme-switch" if switch else "--no-theme-switch"]) + (["--google-demo"] if google_demo else [])
    code, txt = run(cmd, cwd=ROOT)
    if code:
        sys.exit("✗ la compilación falló:\n" + txt[-1500:])


def copy_api(www: Path) -> None:
    """copia SOLO los archivos permitidos del API PHP (lista blanca API_ALLOWED): sin pruebas, sin almacén de datos, sin copias de seguridad y sin la configuración real (config.php lleva claves y la crea quien despliega)"""
    src = ROOT / "backend-php/api"
    for p in sorted(src.rglob("*")):
        rel = "api/" + p.relative_to(src).as_posix()
        if p.is_file() and API_ALLOWED.match(rel):
            dst = www / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, dst)


def shown(p: Path) -> str:
    """ruta legible: relativa al proyecto si está dentro, absoluta si no"""
    try:
        return str(p.relative_to(ROOT))
    except ValueError:
        return str(p)


def files(www: Path):
    """Todos los ficheros de la carpeta, ordenados (incluye los ocultos como .htaccess)."""
    return sorted(p for p in www.rglob("*") if p.is_file())


def check_versions(www: Path, rel: dict, base: str) -> list:
    """Actualizar sin caché vieja: todo CSS y JS local de cada página lleva «?v=<10 hex>» igual a la huella (SHA-256) del archivo, y no queda ningún marcador sin resolver."""
    errs, seen, bad = [], {}, 0
    bp = urlparse(base).path.strip("/")
    root = www.resolve()
    ref = re.compile(r'(?:href|src)="([^"#?]+?\.(?:css|js))(\?[^"#]*)?"')
    for r, p in rel.items():
        if p.suffix.lower() != ".html":
            continue
        html = p.read_text(encoding="utf-8", errors="ignore")
        if "@@TVV:" in html:
            errs.append(f"marcador de versión sin resolver en {r}")
            continue
        for m in ref.finditer(html):
            url, query = m.group(1), m.group(2) or ""
            if re.match(r"([a-z]+:)?//", url):
                continue                                              # recurso externo: no es del paquete
            if url.startswith("/"):
                key = url.lstrip("/")
            else:
                try:
                    key = (p.parent / url).resolve().relative_to(root).as_posix()
                except ValueError:
                    continue
            if bp and key.startswith(bp + "/"):
                key = key[len(bp) + 1:]
            f = www / key
            if not f.is_file():
                bad += 1
                if bad <= 5:
                    errs.append(f"{r} referencia {url}, que no está en el paquete")
                continue
            if key not in seen:
                seen[key] = hashlib.sha256(f.read_bytes()).hexdigest()[:10]
            if query != "?v=" + seen[key]:
                bad += 1
                if bad <= 5:
                    errs.append(f"{r}: {url}{query} " + ("sin huella de versión" if not query else f"debería terminar en ?v={seen[key]}"))
    if bad > 5:
        errs.append(f"… {bad} referencias de CSS/JS con problemas de versión en total")
    return errs


def check_csp(www: Path, rel: dict) -> list:
    """Política de seguridad de contenido: script-src sin 'unsafe-inline' y cada script en línea ejecutable de cada página con su huella SHA-256 en la cabecera (los bloques de datos application/json y ld+json no se ejecutan)."""
    errs = []
    ht = rel[".htaccess"].read_text(encoding="utf-8") if ".htaccess" in rel else ""
    m = re.search(r'Content-Security-Policy "([^"]+)"', ht)
    if not m:
        return ["el .htaccess no fija Content-Security-Policy"]
    script_src = next((d.strip() for d in m.group(1).split(";") if d.strip().startswith("script-src")), "")
    if "'unsafe-inline'" in script_src or "'unsafe-eval'" in script_src:
        errs.append(f"la CSP permite scripts en línea o eval: {script_src}")
    allowed = set(re.findall(r"'sha256-([A-Za-z0-9+/=]+)'", script_src))
    inline = re.compile(r"<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>", re.S | re.I)
    seen, bad = set(), 0
    for r, p in rel.items():
        if p.suffix.lower() != ".html":
            continue
        for sm in inline.finditer(p.read_text(encoding="utf-8", errors="ignore")):
            attrs, body = sm.group("attrs"), sm.group("body")
            if re.search(r"\bsrc=", attrs) or re.search(r'type="application/(ld\+)?json"', attrs):
                continue
            h = base64.b64encode(hashlib.sha256(body.encode("utf-8")).digest()).decode()
            if h not in allowed and h not in seen:
                seen.add(h)
                bad += 1
                if bad <= 3:
                    errs.append(f"script en línea sin huella en la CSP ({r}): {body[:60]!r}")
    return errs


GOOGLE_HOSTS = re.compile(r"googletagmanager|google-analytics|analytics\.google|doubleclick|googleadservices|googlesyndication")


def check_google(rel: dict, staging: bool) -> list:
    """Google (Analytics/Ads/Search Console): el paquete lleva el aviso y consent.js en modo «runtime» (los IDs los da el servidor, desde el panel); la CSP abre los dominios de Google SOLO en producción; los IDs ficticios del paquete de pruebas no llegan a producción; el entorno de pruebas no se verifica en Search Console."""
    errs = []
    ht = rel[".htaccess"].read_text(encoding="utf-8") if ".htaccess" in rel else ""
    m = re.search(r'Content-Security-Policy "([^"]+)"', ht)
    csp_google = bool(m and GOOGLE_HOSTS.search(m.group(1)))
    htmls = [(r, p.read_text(encoding="utf-8", errors="ignore")) for r, p in rel.items() if p.suffix.lower() == ".html"]
    boots = [(r, re.search(r'id="tv-google">([^<]*)<', t)) for r, t in htmls]
    active = [r for r, b in boots if b]
    if not active:
        if csp_google:
            errs.append("la CSP abre orígenes de Google pero ninguna página lleva medición")
        if any("consent.js" in t for _, t in htmls):
            errs.append("hay páginas que cargan consent.js sin IDs de Google")
    else:
        if "assets/js/consent.js" not in rel:
            errs.append("las páginas llevan medición pero falta assets/js/consent.js")
        modes, runtimes = set(), set()
        for r, b in boots:
            if b:
                try:
                    j = json.loads(b.group(1))
                    modes.add(j.get("mode"))
                    runtimes.add(bool(j.get("runtime")))
                except Exception:  # noqa: BLE001
                    errs.append(f"{r}: el bloque tv-google no es JSON válido")
        if runtimes != {True}:
            errs.append("el paquete lleva servidor: todas las páginas con medición deben ser «runtime» (los IDs se leen del servidor, no van fijos en el HTML)")
        if staging and modes != {"test"}:
            errs.append(f"entorno de pruebas con medición en modo {sorted(modes)}: debe ser solo «test» (no se descarga nada de Google)")
        if not staging and modes != {"live"}:
            errs.append(f"producción con medición en modo {sorted(modes)}: debe ser solo «live»")
        if staging and csp_google:
            errs.append("el entorno de pruebas abre orígenes de Google en la CSP")
        if not staging and not csp_google:
            errs.append("producción con medición pero la CSP no deja pasar a Google")
        if not staging and any(re.search(r"G-DEMO000000|AW-0000000000", t) for _, t in htmls):
            errs.append("producción lleva los IDs ficticios de Google del paquete de pruebas")
    if staging and any("google-site-verification" in t for _, t in htmls):
        errs.append("el entorno de pruebas lleva la verificación de Search Console (es noindex: no debe)")
    return errs


def check_wp_probes(rel: dict, base: str) -> list:
    """El .htaccess corta con 410 los sondeos de WordPress (wp-login.php, xmlrpc.php, wp-admin…) sin tocar las fotos y PDF antiguos de wp-content/uploads ni las páginas de la web: se prueba la expresión con rutas de ejemplo."""
    ht = rel[".htaccess"].read_text(encoding="utf-8") if ".htaccess" in rel else ""
    m = re.search(r"^RedirectMatch 410 (\S+)$", ht, re.M)
    if not m:
        return [".htaccess sin la regla que corta con 410 los sondeos de WordPress"]
    bp = urlparse(base).path.rstrip("/")
    try:
        rx = re.compile(m.group(1))
    except re.error as e:
        return [f"la regla 410 de WordPress no es una expresión válida: {e}"]
    errs = []
    for path in ("/wp-login.php", "/xmlrpc.php", "/wp-admin/", "/wp-admin/admin-ajax.php", "/wp-json/wp/v2/users", "/wp-includes/js/jquery.js", "/wp-content/plugins/x/readme.txt", "/wp-content/themes/y/style.css", "/wp-config.php"):
        if not rx.search(bp + path):
            errs.append(f"la regla 410 no corta {bp + path}")
    for path in ("/", "/en/", "/productos/", "/tienda/", "/en/shop/", "/blog/", "/wp-content/uploads/2020/01/ficha.pdf", "/api/health", "/admin/", "/robots.txt", "/sitemap.xml"):
        if rx.search(bp + path):
            errs.append(f"la regla 410 corta una ruta legítima: {bp + path}")
    return errs


def check_blog(rel: dict, base: str, staging: bool) -> list:
    """Blog del panel: las cuatro plantillas del servidor (api/generated/blog-shell.<idioma>.json) se leen, son de ESTA compilación (misma base y mismo modo pruebas/producción), traen todas las marcas que rellena PHP,
    ninguna huella de versión sin resolver y el listado partido donde van las tarjetas; y el .htaccess lleva las reglas que mandan las direcciones del blog a api/page.php (sitemap y llms solo en producción)."""
    errs = []
    need = ["seotitle", "description", "links", "social", "ld", "path", "langlinks", "boot", "title", "date", "datefmt", "content"]
    for lang in ("es", "en", "fr", "de"):
        key = f"api/generated/blog-shell.{lang}.json"
        if key not in rel:
            continue                                             # ya lo dice REQUIRED
        try:
            sh = json.loads(rel[key].read_text(encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            errs.append(f"no puedo leer {key}: {e}")
            continue
        if sh.get("v") != 1 or sh.get("lang") != lang:
            errs.append(f"{key}: versión o idioma inesperados")
        if sh.get("base") != base.rstrip("/") or bool(sh.get("staging")) != bool(staging):
            errs.append(f"{key} no es de esta compilación (base o modo pruebas/producción distintos)")
        post = sh.get("post", "")
        for k in need:
            if post.count(f"@@TV:{k}@@") < 1:
                errs.append(f"{key}: la plantilla de la entrada no trae la marca @@TV:{k}@@")
        if "@@TVV:" in post or "@@TVV:" in sh.get("index", {}).get("pre", "") or "@@TVV:" in sh.get("index", {}).get("post", ""):
            errs.append(f"{key}: quedan marcadores de versión sin resolver")
        if not sh.get("index", {}).get("pre", "").endswith('<div class="posts">') or not sh.get("index", {}).get("post", "").startswith("</div></div></section>"):
            errs.append(f"{key}: el listado del blog no está partido donde van las tarjetas")
        if len(sh.get("cards", [])) < 1 or any("@@TV:" in c.get("h", "") for c in sh.get("cards", [])):
            errs.append(f"{key}: tarjetas de las entradas existentes ausentes o con marcas sin rellenar")
    ht = rel[".htaccess"].read_text(encoding="utf-8") if ".htaccess" in rel else ""
    if ht.count("api/page.php [L]") < (3 if staging else 4):
        errs.append(".htaccess sin todas las reglas del blog hacia api/page.php")
    if staging and "sitemap" in ht.split("api/page.php")[0] + ht.split("api/page.php")[-1] and "sitemap\\.xml|llms" in ht:
        errs.append("el .htaccess de pruebas reescribe sitemap/llms (no existen en pruebas)")
    if not staging and "sitemap\\.xml|llms\\.txt|llms-full\\.txt" not in ht:
        errs.append(".htaccess de producción sin la regla de sitemap.xml, llms.txt y llms-full.txt hacia api/page.php")
    return errs


def verify(www: Path, base: str, staging: bool, embed_prices: bool, theme: str = "ficha", switch=None):
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
        elif r.startswith("api/") and not API_ALLOWED.match(r):
            errs.append(f"archivo del API fuera de la lista blanca (no debe ir en el paquete): {r}")
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
    # aspecto: el pedido (--theme / selector) es el que acaba en la portada y en la hoja de estilos
    css = rel["assets/css/site.css"].read_text(encoding="utf-8", errors="ignore") if "assets/css/site.css" in rel else ""
    want_switch = staging if switch is None else switch
    if f'data-theme="{theme}"' not in home:
        errs.append(f"la portada no lleva el aspecto pedido (data-theme=\"{theme}\")")
    if want_switch != ('data-theme-switch="footer"' in home):
        errs.append("el selector de aspecto del pie " + ("falta" if want_switch else "sobra") + " en la portada")
    # hoja por capas: con selector van las tres (classic,ficha,original); sin selector, solo la del aspecto elegido (y «Clásico» va sin capas)
    want_layer = "@layer classic,ficha,original;" if want_switch else {"ficha": "@layer classic,ficha;", "original": "@layer classic,original;"}.get(theme)
    if want_layer and want_layer not in css:
        errs.append(f"site.css no lleva la declaración de capas esperada ({want_layer})")
    if theme == "clasico" and not want_switch and ("@layer" in css or "Archivo Expanded" in css or "PT Sans" in css):
        errs.append("publicación solo en «Clásico»: site.css no debería llevar los otros aspectos")
    if theme == "original" and not want_switch and ("Archivo Expanded" in css or '[data-theme="ficha"]' in css):
        errs.append("publicación solo en «Original»: site.css no debería llevar «Ficha técnica»")
    if theme == "ficha" and not want_switch and ('[data-theme="original"]' in css or "assets/img/original" in str(sorted(rel))):
        errs.append("publicación solo en «Ficha técnica»: sobra lo del aspecto «Original» (hoja o fotos)")
    if ("original" == theme or want_switch) and not any(k.startswith("assets/img/original/") for k in rel):
        errs.append("falta assets/img/original (fotos del aspecto «Original»)")
    errs += check_versions(www, rel, base)
    errs += check_csp(www, rel)
    errs += check_google(rel, staging)
    errs += check_wp_probes(rel, base)
    errs += check_blog(rel, base, staging)
    try:
        bi = json.loads(rel["api/generated/build.json"].read_text(encoding="utf-8"))
        if bi.get("base") != base or bool(bi.get("staging")) != bool(staging) or bi.get("theme") != theme or not bi.get("version"):
            errs.append("api/generated/build.json no coincide con lo que se está empaquetando (base, pruebas/producción, aspecto o versión)")
    except Exception as e:  # noqa: BLE001
        errs.append(f"no puedo leer api/generated/build.json: {e}")
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
    ap = argparse.ArgumentParser(description="Paquete de Torivac para un hosting con cPanel o Plesk (Apache + PHP)")
    ap.add_argument("--base", required=True, help="URL pública con https, sin barra final salvo subcarpeta (https://pruebas.dominio.com)")
    ap.add_argument("--staging", action="store_true", help="entorno de pruebas: noindex y robots.txt cerrado")
    ap.add_argument("--out", default="entrega")
    ap.add_argument("--keep", action="store_true")
    ap.add_argument("--embed-prices", action="store_true")
    ap.add_argument("--google-demo", action="store_true", help="solo con --staging: IDs ficticios de Google para ver el aviso de cookies en el entorno de pruebas (no se envía nada a Google)")
    ap.add_argument("--allow-dirty", action="store_true", help="permite empaquetar PRODUCCIÓN con cambios sin commitear (por defecto no: el paquete no se podría repetir)")
    ap.add_argument("--theme", choices=["ficha", "clasico", "original"], default="ficha", help="aspecto por defecto: ficha (Ficha técnica, el nuevo), clasico (el de la primera versión) u original (la web actual de grupotorivac.com)")
    sw = ap.add_mutually_exclusive_group()
    sw.add_argument("--theme-switch", dest="switch", action="store_true", default=None, help="muestra el selector de aspecto (cinta y pie)")
    sw.add_argument("--no-theme-switch", dest="switch", action="store_false", help="oculta el selector de aspecto (por defecto: visible en pruebas, oculto en producción)")
    a = ap.parse_args()
    u = urlparse(a.base)
    if u.scheme not in ("https", "http") or not u.netloc:
        sys.exit("✗ --base debe ser una URL completa, p. ej. https://pruebas.grupotorivac.com")
    if u.scheme == "http" and not re.search(r"127\.0\.0\.1|localhost", u.netloc):
        print("⚠ --base sin https: el hosting da el certificado gratis (AutoSSL en cPanel, Let's Encrypt en Plesk); la web redirige a https solo si la URL empieza por https")
    base = a.base.rstrip("/")
    version, committed_at, clean = git_version()                  # antes de compilar: la compilación regenera archivos y no debe contar como cambios del usuario
    if not clean:
        if a.staging or a.allow_dirty:
            print(f"⚠ hay cambios sin commitear: el paquete se marca como {version}+cambios y no se podrá repetir exactamente")
        else:
            sys.exit(f"✗ producción con cambios sin commitear ({version}+cambios): haz commit antes (así el paquete se puede repetir y volver atrás) o usa --allow-dirty")
    tmp = Path(tempfile.mkdtemp(prefix="tv-paquete-"))
    www = tmp / "www"
    try:
        print(f"1/4 compilando {base}{' (PRUEBAS)' if a.staging else ''} · aspecto {a.theme} …")
        build_site(base, a.staging, www, a.theme, a.switch, a.google_demo)
        print("2/4 copiando el API PHP …")
        copy_api(www)
        write_build_info(www, version, committed_at, clean, base, a.staging, a.theme, a.switch)
        print("3/4 verificando …")
        errs, warns = verify(www, base, a.staging, a.embed_prices, a.theme, a.switch)
        for w in warns:
            print("  ⚠", w)
        if errs:
            print("\n✗ el paquete NO se genera:")
            for e in errs:
                print("  ✗", e)
            sys.exit(1)
        host = re.sub(r"[^a-z0-9]+", "-", (u.netloc + u.path).lower()).strip("-")
        dest = ROOT / a.out / f"torivac-web-{host}{'-pruebas' if a.staging and 'prueba' not in host else ''}-{date.today():%Y%m%d}.zip"
        print("4/4 comprimiendo …")
        sha = make_zip(www, dest)
        n = len(files(www))
        print(f"\n✓ {shown(dest)}  ·  {n} ficheros  ·  {dest.stat().st_size / 1048576:.1f} MB\n  versión {version}{'' if clean else '+cambios'}  ·  SHA-256 {sha}")
        print("\nSiguiente: docs/DESPLIEGUE-PLESK.md (Plesk) o docs/DESPLIEGUE-CPANEL.md (cPanel): subir, crear api/config.php, primer usuario manager, cron de precios.")
        if a.keep:
            keep = ROOT / a.out / dest.stem
            shutil.rmtree(keep, ignore_errors=True)
            shutil.copytree(www, keep)
            print(f"  carpeta sin comprimir: {shown(keep)}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
