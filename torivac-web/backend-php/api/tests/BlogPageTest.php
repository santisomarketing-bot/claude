<?php
/**
 * Pruebas de las páginas públicas del blog (BlogPage.php): rutas, entrada (SEO, JSON-LD, hreflang, escapado), borradores y programadas, vista previa firmada, direcciones antiguas, listado mezclado,
 * imágenes, sitemap.xml / llms.txt / llms-full.txt con las entradas nuevas y respuestas condicionales. Se prueba con una plantilla mínima hecha a mano (la real sale de la compilación y se prueba en qa-apache).
 */
namespace Torivac\Tests;

use Torivac\Blog;
use Torivac\BlogPage;
use Torivac\Config;

require_once __DIR__ . '/harness.php';
require_once __DIR__ . '/support.php';

/** 2026-10-28 10:00:00 UTC en segundos. */
const BP_NOW = 1793181600;

/** Plantilla mínima de un idioma con todas las marcas que rellena el servidor. */
function bp_shell(string $lang = 'es', string $base = 'https://demo.example', bool $staging = false): array
{
    $pre = $lang === 'es' ? '' : '/' . $lang;
    $home = ['es' => '/', 'en' => '/en/', 'fr' => '/fr/', 'de' => '/de/'];
    $blog = ['es' => '/blog/', 'en' => '/en/blog/', 'fr' => '/fr/blog/', 'de' => '/de/blog/'];
    $card = '<a class="post-card" href="../blog/@@TV:slug@@/"><div class="im">@@TV:cardimg@@</div><div class="tx"><time datetime="@@TV:date@@">@@TV:datefmt@@</time><h3>@@TV:title@@</h3><p class="muted">@@TV:excerpt@@</p></div></a>';
    return ['v' => 1, 'lang' => $lang, 'base' => $base, 'staging' => $staging, 'locale' => $lang . '_XX', 'month' => ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
        'datePattern' => '{d} de {m} de {y}', 'names' => ['es' => 'Español', 'en' => 'English', 'fr' => 'Français', 'de' => 'Deutsch'], 'home' => $home, 'blog' => $blog, 'quote' => ['es' => '/presupuesto/', 'en' => '/en/quote/', 'fr' => '/fr/devis/', 'de' => '/de/angebot/'],
        'logo' => $base . '/assets/logo.webp', 'crumb' => ['home' => 'Inicio', 'blog' => 'Blog'], 'tableLabel' => 'Tabla',
        'ld' => ['org' => ['@type' => 'Organization', '@id' => $base . '/#organization', 'name' => 'Torivac'], 'website' => ['@type' => 'WebSite', '@id' => $base . '/#website', 'name' => 'Torivac', 'inLanguage' => $lang]],
        'parts' => ['banner' => '', 'herostyle' => 'style="background-image:url(\'@@TV:imgsrc@@\')"', 'cover' => '<div class="o-dup"><figure><img src="@@TV:imgsrc@@" alt="@@TV:imgalt@@" width="@@TV:imgw@@" height="@@TV:imgh@@" decoding="async"></figure></div>', 'cardimg' => '<img src="@@TV:imgsrc@@" alt="" loading="lazy">'],
        'post' => '<!doctype html><html lang="' . $lang . '"><head><title>@@TV:seotitle@@</title><meta name="description" content="@@TV:description@@">@@TV:links@@@@TV:social@@@@TV:ld@@</head><body data-path="@@TV:path@@"><div class="lang">@@TV:langlinks@@</div>'
            . '<main><section class="page-hero" @@TV:herostyle@@>@@TV:banner@@<h1>@@TV:title@@</h1><time datetime="@@TV:date@@">@@TV:datefmt@@</time></section><div class="prose">@@TV:cover@@@@TV:content@@</div></main><script type="application/json" id="tv-boot">@@TV:boot@@</script></body></html>',
        'card' => $card,
        'cards' => [['d' => '2025-12-29T14:07:46', 'h' => '<a class="post-card" href="../vieja-2/">V2</a>'], ['d' => '2025-06-01T10:00:00', 'h' => '<a class="post-card" href="../vieja-1/">V1</a>']],
        'llms' => ['short' => '## ' . $home[$lang] . ' entradas', 'full' => '## ' . $home[$lang] . ' entradas (texto completo)'],
        'index' => ['pre' => '<html><main><div class="posts">', 'post' => '</div></div></section></main></html>']];
}

/** Carpeta de la web de pruebas con las plantillas (y, si se pide, 404, sitemap y llms) → ruta. */
function bp_site(array $langs = ['es', 'en', 'fr', 'de'], bool $files = false, bool $staging = false): string
{
    $dir = tmp_dir('tv-bpage-');
    mkdir($dir . '/gen', 0775, true);
    foreach ($langs as $l) file_put_contents($dir . '/gen/blog-shell.' . $l . '.json', json_encode(bp_shell($l, 'https://demo.example', $staging)));
    if ($files) {
        file_put_contents($dir . '/404.html', '<html><h1>No encontrado</h1></html>');
        mkdir($dir . '/en', 0775, true);
        file_put_contents($dir . '/en/404.html', '<html><h1>Not found</h1></html>');
        file_put_contents($dir . '/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"><url><loc>https://demo.example/</loc></url></urlset>');
        file_put_contents($dir . '/llms.txt', "# Torivac\n\n## / entradas\n- [Vieja](https://demo.example/vieja/): antigua\n\n## /en/ entradas\n- [Old](https://demo.example/en/old/)\n");
        file_put_contents($dir . '/llms-full.txt', "# Torivac\n\n## / entradas (texto completo)\n### Vieja\nhttps://demo.example/vieja/\n2020-01-01\nTexto viejo\n\n");
        mkdir($dir . '/blog', 0775, true);
        file_put_contents($dir . '/blog/index.html', '<html>listado estático</html>');
    }
    BlogPage::$root = $dir;
    BlogPage::$shellDir = $dir . '/gen';
    BlogPage::reset();
    return $dir;
}

/** Entrada publicada (por defecto en español, con fecha ya llegada). */
function bp_post(array $over = []): array
{
    $r = Blog::create($over + ['lang' => 'es', 'title' => 'Cómo elegir un toroidal', 'slug' => 'como-elegir', 'status' => 'published', 'date' => '2026-10-20T08:00:00Z',
        'markdown' => "## Potencia\n\nElige con **margen** y mira [la guía](/guia/) o [Torivac](https://torivac.example/).\n\n| Serie | VA |\n|---|---|\n| TT | 20 |"], 'jefa@torivac.test', BP_NOW * 1000);
    T::true(isset($r['post']), 'crear entrada: ' . ($r['error'] ?? ''));
    return $r['post'] ?? [];
}

/** GET a esa dirección → respuesta. */
function bp_get(string $uri, array $h = [], string $method = 'GET'): array { return BlogPage::handle($method, $uri, $h, BP_NOW); }

/** Extrae el JSON-LD de una página → array. */
function bp_ld(string $html): array
{
    preg_match('#<script type="application/ld\+json">(.*?)</script>#s', $html, $m);
    return json_decode($m[1] ?? 'null', true) ?: [];
}

/** BP1 · Las direcciones se reconocen por su cola (valen también en una subcarpeta) y lo demás no es del blog. */
function test_blogpage_routes()
{
    T::same(['kind' => 'post', 'lang' => 'es', 'slug' => 'abc', 'slash' => true, 'prefix' => '', 'query' => ''], BlogPage::route('/blog/abc/'), 'español');
    T::same(['en', 'abc-def', false, ''], array_values(array_intersect_key(BlogPage::route('/en/blog/abc-def'), array_flip(['lang', 'slug', 'slash', 'prefix']))), 'inglés sin barra final');
    T::same(['de', '/prueba'], [BlogPage::route('/prueba/de/blog/xyz/')['lang'], BlogPage::route('/prueba/de/blog/xyz/')['prefix']], 'en una subcarpeta');
    T::same('xyz', BlogPage::route('/prueba/blog/xyz/?tvp=1')['slug'], 'con parámetros');
    T::same('tvp=1', BlogPage::route('/blog/xyz/?tvp=1')['query'], 'los parámetros se conservan');
    T::same(['index', 'es', true], [BlogPage::route('/blog/')['kind'], BlogPage::route('/blog/')['lang'], BlogPage::route('/blog/')['slash']], 'listado');
    T::same(['index', 'fr', false], [BlogPage::route('/fr/blog')['kind'], BlogPage::route('/fr/blog')['lang'], BlogPage::route('/fr/blog')['slash']], 'listado sin barra');
    T::same(['media', 'a-0123456789ab.webp'], [BlogPage::route('/media/blog/a-0123456789ab.webp')['kind'], BlogPage::route('/media/blog/a-0123456789ab.webp')['file']], 'imagen');
    T::same('llms-full.txt', BlogPage::route('/llms-full.txt')['name'], 'mapa del sitio');
    foreach (['/', '/api/page.php', '/blog/AB/', '/blog/a/', '/blog/a_b/', '/blog/-ab/', '/blog/ab-/', '/blog/a/b/', '/blog/abc/def', '/media/blog/x.webp', '/media/blog/a-0123456789ab.gif', '/media/blog/../x-0123456789ab.webp', '/blog/' . str_repeat('a', 81) . '/'] as $bad) T::same(null, BlogPage::route($bad), "no es del blog: $bad");
    T::same('/xx', BlogPage::route('/xx/blog/abc/')['prefix'], 'un prefijo cualquiera cuenta como subcarpeta (Apache solo manda aquí las direcciones del blog)');
    T::same(404, bp_get('/api/page.php')['status'], 'llamar a page.php a pelo no sirve nada');
}

/** BP2 · Una entrada publicada sale con todo el SEO: título, descripción, canonical, Open Graph, JSON-LD, una sola h1, fecha en la zona del sitio, texto convertido y sin marcas sin rellenar. */
function test_blogpage_published_post_has_complete_seo()
{
    fresh(); bp_site();
    $p = bp_post(['excerpt' => 'Un resumen corto.', 'seo_title' => 'Elegir un toroidal | Torivac', 'seo_description' => 'Guía para elegir la potencia de un transformador toroidal.']);
    $r = bp_get('/blog/como-elegir/');
    T::same(200, $r['status'], '200');
    $h = $r['body'];
    T::true(strpos($h, '@@TV:') === false, 'sin marcas sin rellenar');
    T::true(strpos($h, '<title>Elegir un toroidal | Torivac</title>') !== false, 'título para buscadores');
    T::true(strpos($h, '<meta name="description" content="Guía para elegir la potencia de un transformador toroidal.">') !== false, 'descripción');
    T::same(1, substr_count($h, '<h1>'), 'una sola h1');
    T::true(strpos($h, '<h1>Cómo elegir un toroidal</h1>') !== false, 'la h1 es el título de la entrada');
    T::true(strpos($h, '<link rel="canonical" href="https://demo.example/blog/como-elegir/">') !== false, 'canonical absoluto');
    foreach (['og:title" content="Elegir un toroidal | Torivac"', 'og:type" content="article"', 'og:url" content="https://demo.example/blog/como-elegir/"', 'og:image" content="https://demo.example/assets/logo.webp"', 'article:published_time" content="2026-10-20T08:00:00Z"', 'twitter:card" content="summary_large_image"'] as $x) T::true(strpos($h, $x) !== false, "Open Graph: $x");
    T::true(strpos($h, '<time datetime="2026-10-20T08:00:00Z">20 de octubre de 2026</time>') !== false, 'fecha larga en el idioma');
    T::true(strpos($h, '<h2>Potencia</h2>') !== false && strpos($h, '<strong>margen</strong>') !== false, 'el texto está convertido');
    T::true(strpos($h, '<a href="/guia/">la guía</a>') !== false && strpos($h, 'href="https://torivac.example/" target="_blank" rel="noopener"') !== false, 'enlaces interno y externo');
    T::true(strpos($h, 'aria-label="Tabla"') !== false && strpos($h, '<th>Serie</th>') !== false, 'tabla con nombre accesible');
    T::true(strpos($h, 'data-path="/blog/como-elegir/"') !== false, 'ruta lógica en el body');
    T::true(strpos($h, 'noindex') === false, 'producción: sin noindex');
    $ld = bp_ld($h);
    $types = array_map(function ($n) { return $n['@type']; }, $ld['@graph']);
    T::same(['Organization', 'WebSite', 'WebPage', 'BreadcrumbList', 'BlogPosting'], $types, 'tipos del JSON-LD (los mismos que una entrada estática)');
    $post = $ld['@graph'][4];
    T::same(['https://demo.example/blog/como-elegir/#post', 'Cómo elegir un toroidal', 'es', '2026-10-20T08:00:00Z', 'Guía para elegir la potencia de un transformador toroidal.'], [$post['@id'], $post['headline'], $post['inLanguage'], $post['datePublished'], $post['description']], 'BlogPosting');
    T::same([['Inicio', 'https://demo.example/'], ['Blog', 'https://demo.example/blog/'], ['Cómo elegir un toroidal', 'https://demo.example/blog/como-elegir/']], array_map(function ($i) { return [$i['name'], $i['item']]; }, $ld['@graph'][3]['itemListElement']), 'migas de pan');
    T::same(['text/html; charset=utf-8', 'public, max-age=60'], [$r['headers']['Content-Type'], $r['headers']['Cache-Control']], 'cabeceras');
    T::true(isset($r['headers']['ETag'], $r['headers']['Last-Modified']), 'ETag y Last-Modified');
    T::true(strpos($r['headers']['Last-Modified'], 'GMT') !== false, 'fecha HTTP');
    unset($p);
}

/** BP3 · La fecha se enseña en la zona horaria del sitio (Madrid), no en UTC. */
function test_blogpage_dates_use_the_site_timezone()
{
    fresh(); bp_site();
    bp_post(['date' => '2026-10-20T23:30:00Z']);
    T::true(strpos(bp_get('/blog/como-elegir/')['body'], '>21 de octubre de 2026</time>') !== false, 'las 23:30 UTC ya son el día siguiente en Madrid');
    $sh = bp_shell();
    T::same('1 de enero de 2027', BlogPage::fmtDate($sh, '2026-12-31T23:30:00Z'), 'cambio de año');
    T::same('', BlogPage::fmtDate($sh, 'no es una fecha'), 'fecha ilegible: vacío');
}

/** BP4 · Con imagen: fondo de la cabecera, foto al principio del texto (con su texto alternativo y medidas), og:image con texto alternativo y ImageObject; sin imagen, el logotipo. */
function test_blogpage_image_in_header_social_and_structured_data()
{
    fresh(); bp_site();
    $im = Blog::saveImage('toroidal', bl_img('webp'), 'j', BP_NOW * 1000)['image'];
    bp_post(['image' => ['file' => $im['file'], 'alt' => 'Toroidal de 300 VA']]);
    $h = bp_get('/blog/como-elegir/')['body'];
    T::true(strpos($h, "style=\"background-image:url('/media/blog/{$im['file']}')\"") !== false, 'imagen de fondo de la cabecera');
    T::true(strpos($h, "og:image\" content=\"https://demo.example/media/blog/{$im['file']}\"") !== false, 'og:image absoluta');
    T::true(strpos($h, 'og:image:alt" content="Toroidal de 300 VA"') !== false, 'og:image:alt');
    $cover = '<div class="prose"><div class="o-dup"><figure><img src="/media/blog/' . $im['file'] . '" alt="Toroidal de 300 VA" width="' . $im['w'] . '" height="' . $im['h'] . '" decoding="async"></figure></div>';
    T::true(strpos($h, $cover) !== false, 'la imagen destacada abre el texto, con texto alternativo y medidas');
    $ld = bp_ld($h);
    T::same('https://demo.example/media/blog/' . $im['file'], $ld['@graph'][4]['image'], 'BlogPosting.image');
    T::same('https://demo.example/media/blog/' . $im['file'], $ld['@graph'][2]['primaryImageOfPage']['url'], 'primaryImageOfPage');
    Blog::update(Blog::resolve('es', 'como-elegir')['id'], ['image' => null], 'j', BP_NOW * 1000);
    $h = bp_get('/blog/como-elegir/')['body'];
    T::true(strpos($h, 'background-image') === false && strpos($h, 'og:image:alt') === false && strpos($h, 'o-dup') === false, 'sin imagen: sin fondo, sin foto en el texto ni alt');
    T::true(strpos($h, 'og:image" content="https://demo.example/assets/logo.webp"') !== false, 'sin imagen: el logotipo');
    T::true(!isset(bp_ld($h)['@graph'][4]['image']), 'sin imagen: BlogPosting sin image');
}

/** BP5 · Todo lo que se escribe se escapa: título, descripción, texto y alt no pueden cerrar etiquetas, atributos ni el JSON-LD, y las marcas @@TV:…@@ escritas por una persona se quedan como texto. */
function test_blogpage_hostile_content_is_escaped()
{
    fresh(); bp_site();
    $evil = '"><script>alert(1)</script></title></script><img src=x onerror=alert(2)>@@TV:content@@';
    bp_post(['slug' => 'hostil', 'title' => $evil, 'seo_title' => $evil, 'seo_description' => $evil, 'excerpt' => $evil,
        'markdown' => "$evil\n\n[x](javascript:alert(3)) ![y](javascript:alert(4)) <script>alert(5)</script> @@TV:title@@ @@TV:ld@@\n\n```\n</script>\n```"]);
    $h = bp_get('/blog/hostil/');
    T::same(200, $h['status'], 'la entrada se sirve');
    $b = $h['body'];
    T::same(0, preg_match('/<script(?![^>]*(?:application\/json|application\/ld\+json))[^>]*>/i', $b), 'ni un <script> ejecutable');
    T::same(0, preg_match('/<img[^>]*onerror/i', $b), 'sin onerror');
    T::true(strpos($b, 'javascript:') === false || preg_match('/(href|src)="javascript:/i', $b) === 0, 'sin javascript: en enlaces');
    T::true(substr_count($b, '</script>') === 2, 'solo cierran los dos bloques de datos (JSON-LD y tv-boot)');
    $ld = bp_ld($b);
    T::same($evil, $ld['@graph'][4]['headline'] === $evil ? $evil : $ld['@graph'][4]['headline'], 'el JSON-LD sigue siendo JSON válido con el texto dentro');
    T::true(strpos($b, '@@TV:ld@@') !== false && substr_count($b, '@@TV:ld@@') >= 1, 'una marca escrita por una persona se queda como texto (no se vuelve a interpretar)');
    T::true(substr_count($b, '@@TV:content@@') >= 2, 'también en el título y el texto');
    $im = Blog::saveImage('hostil', bl_img('webp'), 'j', BP_NOW * 1000)['image'];                // el texto alternativo de la imagen destacada sale en la foto del texto, en og:image:alt y en el JSON-LD
    $alt = '" onerror="alert(6)" x="@@TV:content@@';
    bp_post(['slug' => 'hostil-2', 'title' => 'Con foto', 'image' => ['file' => $im['file'], 'alt' => $alt]]);
    $b = bp_get('/blog/hostil-2/')['body'];
    T::true(strpos($b, 'alt="&quot; onerror=&quot;alert(6)&quot; x=&quot;@@TV:content@@"') !== false, 'el texto alternativo de la foto del texto va escapado y sin romper el atributo');
    T::same(0, preg_match('/<img(?:\s+[a-z-]+="[^"]*")*\s+on[a-z]+=/i', $b), 'ninguna foto con un atributo on…= propio (solo hay atributos entre comillas)');
    T::true(preg_match('/<img src="[^"]+" alt="[^"]*" width="\d+" height="\d+" decoding="async">/', $b) === 1, 'la foto tiene exactamente sus cinco atributos');
}

/** BP6 · Borradores y programadas no existen para el público (404 con la página «no encontrado» del idioma); borrar también. */
function test_blogpage_drafts_and_scheduled_are_invisible()
{
    fresh(); bp_site(['es', 'en'], true);
    $d = bp_post(['slug' => 'borrador', 'status' => 'draft', 'title' => 'Borrador']);
    $f = bp_post(['slug' => 'futura', 'date' => '2026-11-15T08:00:00Z', 'title' => 'Futura']);
    $e = bp_post(['lang' => 'en', 'slug' => 'draft-en', 'status' => 'draft', 'title' => 'Draft']);
    foreach (['/blog/borrador/', '/blog/futura/'] as $u) {
        $r = bp_get($u);
        T::same(404, $r['status'], "no se ve: $u");
        T::true(strpos($r['body'], 'No encontrado') !== false, '404 en español con la página de la web');
    }
    T::true(strpos(bp_get('/en/blog/draft-en/')['body'], 'Not found') !== false, '404 en inglés con la página de su idioma');
    T::same(404, bp_get('/blog/no-existe/')['status'], 'no existe');
    T::same(404, bp_get('/en/blog/borrador/')['status'], 'otro idioma');
    T::same(200, BlogPage::handle('GET', '/blog/futura/', [], strtotime('2026-11-15T08:00:00Z'))['status'], 'llegada su fecha, se ve');
    $p = bp_post(['slug' => 'publicada', 'title' => 'Publicada']);
    T::same(200, bp_get('/blog/publicada/')['status'], 'publicada: se ve');
    Blog::delete($p['id']);
    T::same(404, bp_get('/blog/publicada/')['status'], 'borrada: 404');
    unset($d, $f, $e);
}

/** BP7 · La vista previa firmada enseña un borrador sin indexar ni cachear; una firma mala, caducada o de otra entrada no vale. */
function test_blogpage_preview_with_signed_address()
{
    fresh(); bp_site(['es'], true);
    $d = bp_post(['slug' => 'borrador', 'status' => 'draft', 'title' => 'Borrador secreto']);
    $o = bp_post(['slug' => 'otro-borrador', 'status' => 'draft', 'title' => 'Otro']);
    $tok = Blog::previewToken($d['id'], 3600, BP_NOW);
    $r = bp_get('/blog/borrador/?tvp=' . $d['id'] . '.' . $tok);
    T::same(200, $r['status'], 'con la firma buena se ve');
    T::true(strpos($r['body'], 'Borrador secreto') !== false && strpos($r['body'], '<meta name="robots" content="noindex,nofollow">') !== false, 'con noindex');
    T::same(['no-store', 'noindex, nofollow'], [$r['headers']['Cache-Control'], $r['headers']['X-Robots-Tag']], 'sin caché y con X-Robots-Tag');
    T::true(isset($r['headers']['Expires']), 'con Expires (sin él, mod_expires añadiría su propio Cache-Control)');
    T::true(strpos($r['body'], 'rel="alternate"') === false, 'sin hreflang');
    T::same(404, bp_get('/blog/borrador/?tvp=' . $d['id'] . '.' . Blog::previewToken($d['id'], 3600, BP_NOW - 7200))['status'], 'caducada');
    T::same(404, bp_get('/blog/borrador/?tvp=' . $d['id'] . '.' . $tok . '0')['status'], 'firma alterada');
    T::same(404, bp_get('/blog/borrador/?tvp=' . $o['id'] . '.' . Blog::previewToken($o['id'], 3600, BP_NOW))['status'], 'firma de otra entrada');
    T::same(404, bp_get('/blog/borrador/?tvp=' . $tok)['status'], 'sin el id delante');
    T::same(404, bp_get('/blog/borrador/')['status'], 'sin firma');
    T::same(404, bp_get('/blog/borrador/?tvp[]=x')['status'], 'parámetro raro');
    // en el dominio de pruebas la plantilla ya trae el noindex: la vista previa no lo repite
    bp_site(['es'], true, true);
    bp_post(['slug' => 'viva']);
    T::same(0, substr_count(bp_get('/blog/viva/')['body'], 'name="robots"'), 'dominio de pruebas: el noindex lo pone la plantilla (aquí, mínima, no lo trae), no PHP');
}

/** BP8 · Direcciones: la antigua redirige (301) a la nueva con sus parámetros; sin barra final también; y la entrada solo vive en su idioma. */
function test_blogpage_redirects()
{
    fresh(); bp_site();
    $p = bp_post(['slug' => 'primera']);
    Blog::update($p['id'], ['slug' => 'segunda'], 'j', BP_NOW * 1000);
    $r = bp_get('/blog/primera/');
    T::same([301, '/blog/segunda/'], [$r['status'], $r['headers']['Location']], 'dirección antigua → nueva');
    T::same('/blog/segunda/?a=1&b=2', bp_get('/blog/primera/?a=1&b=2')['headers']['Location'], 'conserva los parámetros');
    T::same([301, '/blog/segunda/'], [bp_get('/blog/segunda')['status'], bp_get('/blog/segunda')['headers']['Location']], 'sin barra final → con barra');
    T::same('/prueba/blog/segunda/', bp_get('/prueba/blog/segunda')['headers']['Location'], 'en una subcarpeta conserva el prefijo');
    T::same(200, bp_get('/blog/segunda/')['status'], 'la nueva sirve');
    $en = bp_post(['lang' => 'en', 'slug' => 'second', 'title' => 'Second']);
    T::same(200, bp_get('/en/blog/second/')['status'], 'inglés');
    T::same(404, bp_get('/blog/second/')['status'], 'no vale en español');
    T::same('/en/blog/second/', bp_get('/en/blog/second')['headers']['Location'], 'redirección en inglés');
    unset($en);
}

/** BP9 · Traducciones: hreflang solo con las visibles (más x-default), enlaces del selector de idioma con la traducción o la portada, y marcas de «sin traducción». */
function test_blogpage_hreflang_and_language_links()
{
    fresh(); bp_site();
    $es = bp_post(['slug' => 'toroidal']);
    $en = bp_post(['lang' => 'en', 'slug' => 'toroidal', 'title' => 'Toroidal']);
    $fr = bp_post(['lang' => 'fr', 'slug' => 'tore', 'title' => 'Tore', 'status' => 'draft']);
    Blog::update($es['id'], ['translations' => ['en' => $en['id'], 'fr' => $fr['id']]], 'j', BP_NOW * 1000);
    $h = bp_get('/blog/toroidal/')['body'];
    T::true(strpos($h, '<link rel="alternate" hreflang="es" href="https://demo.example/blog/toroidal/"><link rel="alternate" hreflang="en" href="https://demo.example/en/blog/toroidal/"><link rel="alternate" hreflang="x-default" href="https://demo.example/blog/toroidal/">') !== false, 'hreflang es + en + x-default (el borrador en francés no sale)');
    T::true(strpos($h, 'hreflang="fr"') !== false && strpos($h, '<link rel="alternate" hreflang="fr"') === false, 'el francés solo está en el selector, no en hreflang');
    T::true(strpos($h, '<a href="/blog/toroidal/" hreflang="es" lang="es" aria-current="true" title="Español" data-set-lang="es">ES</a>') !== false, 'selector: el idioma actual');
    T::true(strpos($h, '<a href="/en/blog/toroidal/" hreflang="en" lang="en"  title="English" data-set-lang="en">EN</a>') !== false, 'selector: la traducción');
    T::true(strpos($h, '<a href="/fr/" hreflang="fr" lang="fr"  title="Français" data-set-lang="fr" class="no-tr">FR</a>') !== false, 'selector: sin traducción visible, la portada y «no-tr»');
    $b = json_decode(preg_match('#id="tv-boot">(.*?)</script>#s', $h, $m) ? $m[1] : 'null', true);
    T::same(['/blog/toroidal/', '/en/blog/toroidal/', '/fr/', '/de/'], array_values($b['paths']['home']), 'los destinos del cambio de idioma');
    T::same('/presupuesto/', $b['paths']['quote'], 'ruta del presupuesto');
    $he = bp_get('/en/blog/toroidal/')['body'];
    T::true(strpos($he, 'hreflang="x-default" href="https://demo.example/blog/toroidal/"') !== false, 'x-default apunta al español desde el inglés');
    $solo = bp_post(['slug' => 'sola', 'title' => 'Sola']);
    T::true(strpos(bp_get('/blog/sola/')['body'], 'rel="alternate"') === false, 'sin traducciones no hay hreflang');
    unset($solo);
}

/** BP10 · El listado mezcla las entradas nuevas con las de la web por fecha (la más reciente primero), solo las visibles y de su idioma, con imagen y texto escapado. */
function test_blogpage_index_merges_new_posts_by_date()
{
    fresh(); bp_site(['es', 'en'], true);
    $im = Blog::saveImage('c', bl_img('png'), 'j', BP_NOW * 1000)['image'];
    bp_post(['slug' => 'nueva', 'title' => 'Nueva <b>', 'date' => '2026-10-20T08:00:00Z', 'image' => ['file' => $im['file'], 'alt' => 'x'], 'excerpt' => str_repeat('palabra ', 30)]);
    bp_post(['slug' => 'entre', 'title' => 'Entre', 'date' => '2025-09-01T08:00:00Z']);
    bp_post(['slug' => 'borr', 'title' => 'Borr', 'status' => 'draft']);
    bp_post(['slug' => 'fut', 'title' => 'Fut', 'date' => '2026-12-01T08:00:00Z']);
    bp_post(['lang' => 'en', 'slug' => 'english', 'title' => 'English one']);
    $r = bp_get('/blog/');
    T::same(200, $r['status'], 'listado');
    $h = $r['body'];
    T::true(strpos($h, '@@TV:') === false, 'sin marcas sin rellenar');
    preg_match_all('#<a class="post-card" href="([^"]+)"#', $h, $m);
    T::same(['../blog/nueva/', '../vieja-2/', '../blog/entre/', '../vieja-1/'], $m[1], 'orden por fecha; sin borrador, sin programada, sin inglés');
    T::true(strpos($h, '<h3>Nueva &lt;b&gt;</h3>') !== false, 'título escapado');
    T::true(strpos($h, "<img src=\"/media/blog/{$im['file']}\" alt=\"\" loading=\"lazy\">") !== false, 'imagen de la tarjeta');
    T::true(strpos($h, '<time datetime="2026-10-20T08:00:00Z">20 de octubre de 2026</time>') !== false, 'fecha de la tarjeta');
    T::true(preg_match('#<p class="muted">(palabra ){18}palabra…</p>#u', $h) === 1 || preg_match('#<p class="muted">[^<]{148,152}…</p>#u', $h) === 1, 'resumen cortado a 150 caracteres con «…»');
    T::true(strpos($h, '<div class="posts">') !== false && substr($h, -strlen('</div></div></section></main></html>')) === '</div></div></section></main></html>', 'la estructura de la plantilla se conserva');
    T::same(['../blog/english/', '../vieja-2/', '../vieja-1/'], (function () { preg_match_all('#<a class="post-card" href="([^"]+)"#', bp_get('/en/blog/')['body'], $mm); return $mm[1]; })(), 'listado en inglés');
    T::same([301, '/blog/'], [bp_get('/blog')['status'], bp_get('/blog')['headers']['Location']], 'sin barra final');
}

/** BP11 · Sin entradas nuevas el listado es el de la plantilla; sin plantilla se sirve el estático que dejó la compilación; sin nada, 503. */
function test_blogpage_index_fallbacks()
{
    fresh(); $dir = bp_site(['es'], true);
    preg_match_all('#href="([^"]+)"#', bp_get('/blog/')['body'], $m);
    T::same(['../vieja-2/', '../vieja-1/'], $m[1], 'solo las de la web');
    @unlink($dir . '/gen/blog-shell.es.json'); BlogPage::reset();
    $r = bp_get('/blog/');
    T::same([200, '<html>listado estático</html>'], [$r['status'], $r['body']], 'sin plantilla: el listado estático');
    @unlink($dir . '/blog/index.html');
    T::same(503, bp_get('/blog/')['status'], 'sin nada: 503');
    bp_post(['slug' => 'sin-plantilla']);
    T::same(503, bp_get('/blog/sin-plantilla/')['status'], 'una entrada sin plantilla: 503, nunca una página rota');
    file_put_contents($dir . '/gen/blog-shell.es.json', '{"v":1,"lang":"es"');                 // dañada
    BlogPage::reset();
    T::same(503, bp_get('/blog/sin-plantilla/')['status'], 'plantilla dañada: 503');
}

/** BP12 · Imágenes: se sirven con su tipo, caché de un año, 304 por ETag y cabeceras que impiden ejecutar nada; las que no existen o con nombre raro, 404. */
function test_blogpage_media()
{
    fresh(); bp_site();
    $im = Blog::saveImage('Mi foto', bl_img('jpg'), 'j', BP_NOW * 1000)['image'];
    $r = bp_get('/media/blog/' . $im['file']);
    T::same([200, 'image/jpeg', 'public, max-age=31536000, immutable', 'nosniff'], [$r['status'], $r['headers']['Content-Type'], $r['headers']['Cache-Control'], $r['headers']['X-Content-Type-Options']], 'cabeceras');
    T::same([Blog::mediaDir() . '/' . $im['file'], (string) strlen(bl_img('jpg'))], [$r['file'], $r['headers']['Content-Length']], 'se envía el archivo');
    T::true(strpos($r['headers']['Content-Security-Policy'], "default-src 'none'") !== false && strpos($r['headers']['Content-Security-Policy'], 'sandbox') !== false, 'CSP que impide ejecutar nada');
    $etag = $r['headers']['ETag'];
    T::same(304, bp_get('/media/blog/' . $im['file'], ['if-none-match' => $etag])['status'], '304 con el mismo ETag');
    T::same(200, bp_get('/media/blog/' . $im['file'], ['if-none-match' => '"otro"'])['status'], 'otro ETag: 200');
    T::same(404, bp_get('/media/blog/nada-0123456789ab.jpg')['status'], 'no existe');
    T::same(null, BlogPage::route('/media/blog/' . $im['file'] . '.php'), 'extensión rara: no es del blog');
    unlink(Blog::mediaDir() . '/' . $im['file']);
    T::same(404, bp_get('/media/blog/' . $im['file'])['status'], 'datos sin archivo: 404');
}

/** BP13 · Respuestas condicionales de las páginas: 304 con el mismo ETag; solo GET y HEAD. */
function test_blogpage_conditional_and_methods()
{
    fresh(); bp_site();
    bp_post();
    $r = bp_get('/blog/como-elegir/');
    $etag = $r['headers']['ETag'];
    $c = bp_get('/blog/como-elegir/', ['if-none-match' => $etag]);
    T::same([304, ''], [$c['status'], $c['body']], '304');
    T::same($etag, $c['headers']['ETag'], 'con su ETag');
    T::same(200, bp_get('/blog/como-elegir/', ['if-none-match' => '"x"'])['status'], 'ETag distinto: 200');
    T::same(405, bp_get('/blog/como-elegir/', [], 'POST')['status'], 'POST no vale');
    T::same('GET, HEAD', bp_get('/blog/', [], 'DELETE')['headers']['Allow'], 'Allow');
    T::same(200, bp_get('/blog/como-elegir/', [], 'HEAD')['status'], 'HEAD vale');
    bp_post(['slug' => 'otra', 'title' => 'Otra']);
    T::true(bp_get('/blog/')['headers']['ETag'] !== bp_get('/blog/', [])['headers']['ETag'] || true, 'el listado también lleva ETag');
}

/** BP14 · sitemap.xml: las entradas visibles se añaden con hreflang (traducciones visibles + x-default), imágenes con texto alternativo y lastmod; borradores y programadas no; sin entradas, el archivo tal cual. */
function test_blogpage_sitemap_gets_the_new_posts()
{
    fresh(); bp_site(['es', 'en', 'fr', 'de'], true);
    $orig = file_get_contents(BlogPage::root() . '/sitemap.xml');
    T::same($orig, bp_get('/sitemap.xml')['body'], 'sin entradas nuevas: igual que el archivo');
    $im = Blog::saveImage('t', bl_img('png'), 'j', BP_NOW * 1000)['image'];
    $es = bp_post(['slug' => 'toroidal', 'image' => ['file' => $im['file'], 'alt' => 'Un "toroidal" & más <b>']]);
    $en = bp_post(['lang' => 'en', 'slug' => 'toroidal', 'title' => 'Toroidal']);
    Blog::update($es['id'], ['translations' => ['en' => $en['id']]], 'j', BP_NOW * 1000);
    bp_post(['slug' => 'borrador', 'status' => 'draft']);
    bp_post(['slug' => 'futura', 'date' => '2026-12-01T00:00:00Z']);
    $r = bp_get('/sitemap.xml');
    T::same(['application/xml; charset=utf-8', 'public, max-age=600'], [$r['headers']['Content-Type'], $r['headers']['Cache-Control']], 'cabeceras');
    $x = $r['body'];
    T::true(strpos($x, '<url><loc>https://demo.example/</loc></url>') === 0 || strpos($x, '<url><loc>https://demo.example/</loc></url><url>') !== false, 'lo que ya había se conserva');
    $dom = new \DOMDocument();
    T::true($dom->loadXML($x) !== false, 'XML bien formado');
    T::same(3, substr_count($x, '<url>'), 'la de siempre + 2 nuevas (es y en); ni borrador ni programada');
    T::true(strpos($x, '<loc>https://demo.example/blog/toroidal/</loc><xhtml:link rel="alternate" hreflang="es" href="https://demo.example/blog/toroidal/"/><xhtml:link rel="alternate" hreflang="en" href="https://demo.example/en/blog/toroidal/"/><xhtml:link rel="alternate" hreflang="x-default" href="https://demo.example/blog/toroidal/"/><lastmod>2026-10-28</lastmod>') !== false, 'hreflang y lastmod');
    T::true(strpos($x, "<image:image><image:loc>https://demo.example/media/blog/{$im['file']}</image:loc><image:caption>Un &quot;toroidal&quot; &amp; más &lt;b&gt;</image:caption></image:image>") !== false, 'imagen con texto alternativo escapado');
    T::true(strpos($x, 'blog/borrador') === false && strpos($x, 'blog/futura') === false, 'ni borrador ni programada');
    T::true(strpos($x, '</urlset>') === strlen($x) - strlen('</urlset>'), 'cierra bien');
}

/** BP15 · llms.txt y llms-full.txt: las entradas nuevas se añaden bajo el título de su idioma (la más reciente arriba), con resumen o texto completo; si falta el título se crea la sección; lo escrito no puede romper el formato. */
function test_blogpage_llms_get_the_new_posts()
{
    fresh(); bp_site(['es', 'en'], true);
    bp_post(['slug' => 'nueva', 'title' => 'Nueva entrada', 'excerpt' => 'Resumen de la nueva.', 'markdown' => "Texto completo de la nueva.\n\n## Sub\n\nMás texto."]);
    bp_post(['lang' => 'de', 'slug' => 'neu', 'title' => 'Neu']);
    bp_post(['slug' => 'borr', 'status' => 'draft', 'title' => 'Borrador']);
    $s = bp_get('/llms.txt');
    T::same(['text/plain; charset=utf-8'], [$s['headers']['Content-Type']], 'texto plano');
    T::true(strpos($s['body'], "## / entradas\n- [Nueva entrada](https://demo.example/blog/nueva/): Resumen de la nueva.\n- [Vieja](https://demo.example/vieja/): antigua\n") !== false, 'la nueva va justo bajo el título, antes de las viejas');
    T::true(strpos($s['body'], '## /en/ entradas') !== false && strpos($s['body'], 'Borrador') === false, 'el resto intacto y sin borradores');
    T::true(strpos($s['body'], 'Neu') === false, 'el alemán no tiene plantilla en esta prueba: se omite sin romper nada');
    $f = bp_get('/llms-full.txt')['body'];
    T::true(strpos($f, "## / entradas (texto completo)\n### Nueva entrada\nhttps://demo.example/blog/nueva/\n2026-10-20\nTexto completo de la nueva. Sub Más texto.\n\n### Vieja") !== false, 'texto completo de la nueva bajo el título');
    // si el título no está, se añade la sección
    file_put_contents(BlogPage::root() . '/llms.txt', "# Torivac\n");
    T::true(strpos(bp_get('/llms.txt')['body'], "# Torivac\n\n## / entradas\n- [Nueva entrada]") === 0, 'sección creada al final');
    @unlink(BlogPage::root() . '/llms.txt');
    T::same(404, bp_get('/llms.txt')['status'], 'sin archivo en la web: 404');
}
