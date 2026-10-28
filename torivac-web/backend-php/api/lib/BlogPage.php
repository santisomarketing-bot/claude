<?php
/**
 * [BLOG-PAGE] Páginas públicas del blog que pinta el servidor (api/page.php): las entradas escritas en el panel (/blog/<slug>/ y /en|fr|de/blog/<slug>/), el listado del blog con las entradas nuevas mezcladas
 * con las de la web original, las imágenes subidas (/media/blog/<archivo>) y el mapa del sitio (sitemap.xml, llms.txt, llms-full.txt) con las entradas nuevas añadidas. El resto de la web es estático.
 *
 * Cómo se pinta: la compilación deja en api/generated/blog-shell.<idioma>.json la página COMPLETA (cabecera, menú, pie, estilos y scripts del sitio) con marcas @@TV:…@@ en lo variable
 * (site/lib/blog-shell.mjs); aquí solo se rellenan las marcas, ESCAPANDO todo (un solo paso: lo escrito en una entrada nunca se vuelve a interpretar como marca). El cuerpo sale de BlogMarkdown
 * (solo etiquetas permitidas). Lo que se ve y cuándo: solo entradas publicadas con fecha ya llegada; un borrador se ve con la dirección firmada del panel («Ver como saldrá»), sin indexar.
 *
 * SEO: título, descripción, canonical, hreflang (solo traducciones visibles, con x-default), Open Graph (+ fechas del artículo), JSON-LD (Organization, WebSite, WebPage, BreadcrumbList y BlogPosting, igual
 * que las entradas estáticas), una sola h1, sitemap con imágenes y lastmod, llms.txt y llms-full.txt. Un cambio de dirección redirige (301) desde la antigua; sin barra final, también.
 * Enrutado por la URL original (REQUEST_URI), no por parámetros: api/page.php llamado a pelo no sirve nada.
 *
 *   BlogPage::handle(método, uri, cabeceras, ahora) → ['status' => …, 'headers' => […], 'body' => …, 'file' => ruta|null]    BlogPage::send($respuesta)
 */
namespace Torivac;

final class BlogPage
{
    /** Segundos que una página (entrada o listado) puede guardarse en la caché del navegador o de un CDN: poco, para que un cambio publicado en el panel se vea enseguida; después se revalida con el ETag. */
    const PAGE_TTL = 60;
    /** Lo mismo para el mapa del sitio y los llms.txt. */
    const MAP_TTL = 600;

    /** Carpeta de la web (donde están sitemap.xml, llms.txt y blog/index.html): por defecto, la que contiene api/. Las pruebas la cambian. */
    public static $root = '';
    /** Carpeta de las plantillas generadas (api/generated). Las pruebas la cambian. */
    public static $shellDir = '';
    /** Plantillas ya leídas, por idioma. */
    private static $shells = [];

    /** Carpeta de la web. */
    public static function root(): string { return self::$root !== '' ? self::$root : dirname(__DIR__, 2); }

    /** Carpeta de las plantillas generadas. */
    public static function shellDir(): string { return self::$shellDir !== '' ? self::$shellDir : dirname(__DIR__) . '/generated'; }

    /** Olvida las plantillas leídas (las pruebas cambian de carpeta). */
    public static function reset(): void { self::$shells = []; }

    // ───────────────────────────────────────── [PIEZAS]
    /** Escapa & < > " (igual que la compilación). */
    private static function esc($s): string { return BlogMarkdown::escapeHtml((string) $s); }

    /** Texto recortado a `$max` caracteres sin partir palabras y con «…» si se cortó (igual que clip() de site/lib/seo.mjs). */
    public static function clip($s, int $max): string
    {
        $t = trim((string) preg_replace('/\s+/u', ' ', (string) $s));
        if (mb_strlen($t, 'UTF-8') <= $max) return $t;
        $cut = mb_substr($t, 0, $max - 1, 'UTF-8');
        $sp = mb_strrpos($cut, ' ', 0, 'UTF-8');
        if ($sp !== false && $sp > $max * 0.6) $cut = mb_substr($cut, 0, $sp, 'UTF-8');
        return (string) preg_replace('/[\s,;:.\-–]+$/u', '', $cut) . '…';
    }

    /** JSON para incrustar en una página: sin < ni > literales, sin separadores de línea Unicode. */
    private static function json($v): string
    {
        return str_replace(["\u{2028}", "\u{2029}"], [' ', ' '], (string) json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_INVALID_UTF8_SUBSTITUTE));
    }

    /** Plantilla de un idioma (o null si falta o está dañada). */
    public static function shell(string $lang): ?array
    {
        if (array_key_exists($lang, self::$shells)) return self::$shells[$lang];
        $sh = null;
        $f = self::shellDir() . '/blog-shell.' . $lang . '.json';
        if (in_array($lang, Blog::LANGS, true) && is_file($f)) {
            $j = json_decode((string) @file_get_contents($f), true);
            if (is_array($j) && ($j['v'] ?? 0) === 1 && is_string($j['post'] ?? null) && is_array($j['index'] ?? null) && is_string($j['base'] ?? null)) $sh = $j;
        }
        return self::$shells[$lang] = $sh;
    }

    /** Ruta base del sitio dentro del dominio («» o «/prueba»), sacada de la dirección base de la plantilla. */
    private static function bp(array $sh): string { return rtrim((string) parse_url($sh['base'], PHP_URL_PATH), '/'); }

    /** Fecha larga en el idioma de la plantilla y en la zona horaria del sitio (igual que las fechas de las entradas estáticas). */
    public static function fmtDate(array $sh, string $iso): string
    {
        try { $d = (new \DateTimeImmutable($iso))->setTimezone(new \DateTimeZone(Blog::TZ)); } catch (\Throwable $e) { return ''; }
        return strtr((string) $sh['datePattern'], ['{d}' => $d->format('j'), '{m}' => (string) ($sh['month'][(int) $d->format('n') - 1] ?? ''), '{y}' => $d->format('Y')]);
    }

    /** Fecha y hora local naive «AAAA-MM-DDTHH:MM:SS» (la de las tarjetas estáticas) de un instante UTC: sirve para ordenar las tarjetas nuevas entre las viejas. */
    private static function localNaive(string $iso): string
    {
        try { return (new \DateTimeImmutable($iso))->setTimezone(new \DateTimeZone(Blog::TZ))->format('Y-m-d\TH:i:s'); } catch (\Throwable $e) { return ''; }
    }

    /** Antepone la ruta base del sitio a los enlaces e imágenes que empiezan por «/» (solo si el sitio vive en una subcarpeta). */
    private static function withBase(string $html, string $bp): string
    {
        return $bp === '' ? $html : str_replace(['href="/', 'src="/'], ['href="' . $bp . '/', 'src="' . $bp . '/'], $html);
    }

    /** width/height de una imagen de /media/blog/ que el servidor conoce (evita saltos de maquetación). */
    private static function imgAttrs($src): string
    {
        if (preg_match('#^/media/blog/([^/?\#]+)$#', (string) $src, $m) !== 1) return '';
        $meta = Blog::mediaMeta($m[1]);
        return $meta ? ' width="' . (int) $meta['w'] . '" height="' . (int) $meta['h'] . '"' : '';
    }

    /**
     * Cabeceras de caché: `$seconds` > 0 = pública durante ese tiempo; 0 = nada de caché. Se manda también Expires: sin él, el mod_expires del .htaccess de la web (que da «max-age=0» al HTML) añade su propia
     * cabecera Cache-Control a la nuestra y las dos se contradicen.
     */
    private static function cache(int $seconds): array
    {
        return $seconds > 0 ? ['Cache-Control' => 'public, max-age=' . $seconds . ($seconds >= 31536000 ? ', immutable' : ''), 'Expires' => gmdate('D, d M Y H:i:s', time() + $seconds) . ' GMT']
            : ['Cache-Control' => 'no-store', 'Expires' => 'Thu, 01 Jan 1970 00:00:00 GMT'];
    }

    /** Respuesta HTML/texto con estas cabeceras. */
    private static function out(int $status, string $body, array $headers = []): array { return ['status' => $status, 'headers' => $headers, 'body' => $body, 'file' => null]; }

    /** Respuesta de error corta (sin plantilla: no depende de nada que pueda estar roto). */
    private static function plain(int $status, string $msg): array
    {
        return self::out($status, $msg . "\n", ['Content-Type' => 'text/plain; charset=utf-8', 'X-Robots-Tag' => 'noindex'] + self::cache(0));
    }

    /** Redirección 301 a una ruta del mismo sitio, conservando los parámetros de la dirección. */
    private static function moved(string $to, string $query): array
    {
        return self::out(301, '', ['Location' => $to . ($query !== '' ? '?' . $query : '')] + self::cache(3600));
    }

    /** Añade ETag y devuelve 304 si el navegador ya tiene esta versión. */
    private static function cacheable(array $r, array $reqHeaders): array
    {
        if ($r['status'] !== 200) return $r;
        $etag = '"' . substr(md5($r['body']), 0, 24) . '"';
        $r['headers']['ETag'] = $etag;
        if (($reqHeaders['if-none-match'] ?? '') === $etag) return self::out(304, '', array_diff_key($r['headers'], ['Content-Length' => 1]));
        return $r;
    }

    // ───────────────────────────────────────── [RUTAS]
    /**
     * Qué pide la dirección (solo la cola de la ruta cuenta, así vale también en una subcarpeta): ['kind' => post|index|media|file, …] o null.
     * @return array<string,mixed>|null
     */
    public static function route(string $uri): ?array
    {
        $path = (string) parse_url($uri, PHP_URL_PATH);
        $query = (string) parse_url($uri, PHP_URL_QUERY);
        if (preg_match('#(?:^|/)media/blog/([a-z0-9][a-z0-9-]{0,50}-[0-9a-f]{12}\.(?:jpg|png|webp))$#D', $path, $m) === 1) return ['kind' => 'media', 'file' => $m[1]];
        if (preg_match('#(?:^|/)(sitemap\.xml|llms\.txt|llms-full\.txt)$#D', $path, $m) === 1) return ['kind' => 'file', 'name' => $m[1]];
        if (preg_match('#^(.*?)(?:/(en|fr|de))?/blog/([a-z0-9][a-z0-9-]{1,78}[a-z0-9])(/?)$#D', $path, $m) === 1) return ['kind' => 'post', 'lang' => $m[2] !== '' ? $m[2] : 'es', 'slug' => $m[3], 'slash' => $m[4] === '/', 'prefix' => $m[1], 'query' => $query];
        if (preg_match('#^(.*?)(?:/(en|fr|de))?/blog(/?)$#D', $path, $m) === 1) return ['kind' => 'index', 'lang' => $m[2] !== '' ? $m[2] : 'es', 'slash' => $m[3] === '/', 'prefix' => $m[1], 'query' => $query];
        return null;
    }

    /**
     * Atiende una petición. `$reqHeaders` lleva los nombres en minúsculas. Solo GET y HEAD. Nunca lanza para una petición normal; api/page.php recoge cualquier excepción inesperada.
     * @return array{status:int,headers:array,body:string,file:?string}
     */
    public static function handle(string $method, string $uri, array $reqHeaders = [], ?int $now = null): array
    {
        $now = $now ?? time();
        if ($method !== 'GET' && $method !== 'HEAD') return self::out(405, '', ['Allow' => 'GET, HEAD'] + self::cache(0));
        $r = self::route($uri);
        if ($r === null) return self::plain(404, 'Not Found');
        switch ($r['kind']) {
            case 'media': return self::media($r['file'], $reqHeaders);
            case 'file': return self::cacheable(self::siteFile($r['name'], $now), $reqHeaders);
            case 'index': return self::cacheable(self::index($r, $now), $reqHeaders);
            default: return self::cacheable(self::post($r, $now), $reqHeaders);
        }
    }

    // ───────────────────────────────────────── [LISTADO]
    /** Imagen de la tarjeta de una entrada sin imagen destacada: el logotipo de la web (así el listado no tiene huecos vacíos). */
    private static function placeholder(array $sh): string
    {
        $src = (string) parse_url((string) ($sh['logo'] ?? ''), PHP_URL_PATH);
        return $src === '' ? '' : '<img class="im-ph" src="' . self::esc($src) . '" alt="" loading="lazy" width="120" height="120">';
    }

    /** Tarjeta de una entrada nueva, rellenando la plantilla de tarjeta. */
    private static function card(array $sh, array $e): string
    {
        $img = $e['image'] ?? null;
        $ex = (string) ($e['excerpt'] ?? '');
        $cut = mb_strlen($ex, 'UTF-8') > 150 ? mb_substr($ex, 0, 150, 'UTF-8') . '…' : $ex;
        return strtr((string) $sh['card'], [
            '@@TV:slug@@' => $e['slug'], '@@TV:date@@' => self::esc($e['date']), '@@TV:datefmt@@' => self::esc(self::fmtDate($sh, $e['date'])), '@@TV:title@@' => self::esc($e['title']), '@@TV:excerpt@@' => self::esc($cut),
            '@@TV:cardimg@@' => $img ? strtr((string) $sh['parts']['cardimg'], ['@@TV:imgsrc@@' => self::esc(self::bp($sh) . '/media/blog/' . $img['file'])]) : self::placeholder($sh),
        ]);
    }

    /** /blog/ (y /en|fr|de/blog/): el listado de la web con las entradas nuevas mezcladas por fecha. */
    private static function index(array $r, int $now): array
    {
        $sh = self::shell($r['lang']);
        if ($sh === null) return self::staticFallback($r['lang'], $r);
        if (!$r['slash']) return self::moved($r['prefix'] . ($r['lang'] === 'es' ? '' : '/' . $r['lang']) . '/blog/', $r['query']);
        $cards = [];
        foreach ($sh['cards'] as $c) $cards[] = ['d' => (string) $c['d'], 'h' => (string) $c['h']];
        foreach (Blog::liveEntries($r['lang'], $now) as $e) $cards[] = ['d' => self::localNaive($e['date']), 'h' => self::card($sh, $e)];
        usort($cards, function ($a, $b) { return strcmp($b['d'], $a['d']); });
        $html = $sh['index']['pre'] . implode('', array_column($cards, 'h')) . $sh['index']['post'];
        return self::out(200, $html, ['Content-Type' => 'text/html; charset=utf-8'] + self::cache(self::PAGE_TTL));
    }

    /** Sin plantilla (una compilación sin --php-api o un paquete a medias): se sirve el listado estático que haya, para no dejar el blog roto. */
    private static function staticFallback(string $lang, array $r): array
    {
        $f = self::root() . ($lang === 'es' ? '' : '/' . $lang) . '/blog/index.html';
        if (is_file($f)) return self::out(200, (string) file_get_contents($f), ['Content-Type' => 'text/html; charset=utf-8'] + self::cache(0));
        return self::plain(503, 'Service Unavailable');
    }

    // ───────────────────────────────────────── [ENTRADA]
    /** Marcas y enlaces de idioma de una entrada: canonical + hreflang, y los cuatro enlaces del selector de idioma. */
    private static function languageLinks(array $sh, array $p, array $trans, bool $preview): array
    {
        $bp = self::bp($sh);
        $abs = rtrim($sh['base'], '/');
        $own = Blog::path($p['lang'], $p['slug']);
        $canonical = '<link rel="canonical" href="' . self::esc($abs . $own) . '">';
        $alts = [$p['lang'] => $own];
        foreach ($trans as $l => $e) $alts[$l] = $e['path'];
        $alternates = '';
        $ordered = array_values(array_filter(Blog::LANGS, function ($l) use ($alts) { return isset($alts[$l]); }));
        if (!$preview && count($ordered) > 1) {
            foreach ($ordered as $l) $alternates .= '<link rel="alternate" hreflang="' . $l . '" href="' . self::esc($abs . $alts[$l]) . '">';
            $alternates .= '<link rel="alternate" hreflang="x-default" href="' . self::esc($abs . (isset($alts['es']) ? $alts['es'] : $alts[$ordered[0]])) . '">';
        }
        $links = '';
        $home = [];
        foreach (Blog::LANGS as $l) {
            $target = isset($alts[$l]) ? $alts[$l] : $sh['home'][$l];
            $home[$l] = $bp . $target;
            $links .= '<a href="' . self::esc($bp . $target) . '" hreflang="' . $l . '" lang="' . $l . '" ' . ($l === $p['lang'] ? 'aria-current="true"' : '') . ' title="' . self::esc($sh['names'][$l]) . '" data-set-lang="' . $l . '"' . ($l !== $p['lang'] && !isset($alts[$l]) ? ' class="no-tr"' : '') . '>' . strtoupper($l) . '</a>';
        }
        return ['links' => $canonical . $alternates, 'langlinks' => $links, 'home' => $home];
    }

    /** JSON-LD de la entrada (mismos tipos y campos que las entradas estáticas: ver pageGraph y postNode de site/lib/seo.mjs). */
    private static function structuredData(array $sh, array $p, string $title, string $desc, ?string $imgAbs): string
    {
        $abs = rtrim($sh['base'], '/');
        $url = $abs . Blog::path($p['lang'], $p['slug']);
        $org = $sh['ld']['org'];
        $site = $sh['ld']['website'];
        $webpage = ['@type' => 'WebPage', '@id' => $url . '#webpage', 'url' => $url, 'name' => self::clip($title, 110), 'inLanguage' => $p['lang'], 'isPartOf' => ['@id' => $site['@id']], 'about' => ['@id' => $org['@id']]];
        if ($desc !== '') $webpage['description'] = self::clip($desc, 300);
        $webpage['primaryImageOfPage'] = ['@type' => 'ImageObject', 'url' => $imgAbs ?: $sh['logo']];
        $webpage['breadcrumb'] = ['@id' => $url . '#breadcrumb'];
        $crumbs = ['@type' => 'BreadcrumbList', '@id' => $url . '#breadcrumb', 'itemListElement' => [
            ['@type' => 'ListItem', 'position' => 1, 'name' => $sh['crumb']['home'], 'item' => $abs . $sh['home'][$p['lang']]],
            ['@type' => 'ListItem', 'position' => 2, 'name' => $sh['crumb']['blog'], 'item' => $abs . $sh['blog'][$p['lang']]],
            ['@type' => 'ListItem', 'position' => 3, 'name' => $p['title'], 'item' => $url]]];
        $date = $p['date'] ?: $p['created'];
        $post = ['@type' => 'BlogPosting', '@id' => $url . '#post', 'mainEntityOfPage' => ['@id' => $url . '#webpage'], 'headline' => self::clip($p['title'], 110), 'inLanguage' => $p['lang']];
        if ($desc !== '') $post['description'] = self::clip($desc, 300);
        $post['datePublished'] = $date;
        $post['dateModified'] = $p['updated'] ?: $date;
        if ($imgAbs) $post['image'] = $imgAbs;
        $post['author'] = ['@id' => $org['@id']];
        $post['publisher'] = ['@id' => $org['@id']];
        return '<script type="application/ld+json">' . self::json(['@context' => 'https://schema.org', '@graph' => [$org, $site, $webpage, $crumbs, $post]]) . '</script>';
    }

    /** La página de una entrada, o 404/301. */
    private static function post(array $r, int $now): array
    {
        $hit = Blog::resolve($r['lang'], $r['slug']);
        $p = $hit ? Blog::get($hit['id']) : null;
        if ($p === null) return self::notFound($r['lang']);
        $preview = false;
        $tvp = [];
        parse_str((string) $r['query'], $tvp);
        if (!Blog::isLive($p, $now)) {                                                          // borrador o programada: solo con la dirección firmada del panel
            $tok = is_string($tvp['tvp'] ?? null) ? $tvp['tvp'] : '';
            if (strpos($tok, $p['id'] . '.') !== 0 || !Blog::verifyPreview($p['id'], substr($tok, strlen($p['id']) + 1), $now)) return self::notFound($r['lang']);
            $preview = true;
        }
        $sh = self::shell($r['lang']);
        if ($sh === null) return self::plain(503, 'Service Unavailable');
        $canonicalPath = Blog::path($p['lang'], $p['slug']);
        if (!empty($hit['alias']) || !$r['slash']) return self::moved($r['prefix'] . $canonicalPath, (string) $r['query']);
        $bp = self::bp($sh);
        $abs = rtrim($sh['base'], '/');
        $img = $p['image'] ?? null;
        $imgPath = $img ? $bp . '/media/blog/' . $img['file'] : '';
        $imgAbs = $img ? $abs . '/media/blog/' . $img['file'] : null;
        $seoTitle = $p['seo_title'] !== '' ? $p['seo_title'] : $p['title'];
        $lead = BlogMarkdown::lead($p['markdown'], 160);
        $desc = self::clip($p['seo_description'] !== '' ? $p['seo_description'] : ($p['excerpt'] !== '' ? $p['excerpt'] : $lead), 158);
        $date = $p['date'] ?: $p['created'];
        $trans = $preview ? [] : Blog::translationsOf(Blog::index($p['lang'])[$p['id']] ?? ['lang' => $p['lang'], 'grp' => $p['grp']], true, $now);
        $ll = self::languageLinks($sh, $p, $trans, $preview);
        $robots = $preview && empty($sh['staging']) ? '<meta name="robots" content="noindex,nofollow">' : '';          // en el dominio de pruebas la plantilla ya lo lleva
        $social = '<meta property="og:title" content="' . self::esc($seoTitle) . '"><meta property="og:description" content="' . self::esc(self::clip($desc ?: $seoTitle, 200)) . '"><meta property="og:type" content="article"><meta property="og:site_name" content="Torivac">'
            . '<meta property="og:locale" content="' . self::esc($sh['locale']) . '"><meta property="og:url" content="' . self::esc($abs . $canonicalPath) . '"><meta property="og:image" content="' . self::esc($imgAbs ?: $sh['logo']) . '">'
            . ($img ? '<meta property="og:image:alt" content="' . self::esc($img['alt']) . '">' : '')
            . '<meta property="article:published_time" content="' . self::esc($date) . '"><meta property="article:modified_time" content="' . self::esc($p['updated'] ?: $date) . '"><meta name="twitter:card" content="summary_large_image">';
        $boot = self::json(['lang' => $p['lang'], 'paths' => ['quote' => $bp . $sh['quote'][$p['lang']], 'home' => $ll['home']]]);
        $content = self::withBase(BlogMarkdown::render($p['markdown'], ['tableLabel' => (string) ($sh['tableLabel'] ?? 'Tabla'), 'imgAttrs' => function ($src) { return self::imgAttrs($src); }]), $bp);
        $map = [
            '@@TV:seotitle@@' => self::esc($seoTitle), '@@TV:description@@' => self::esc($desc), '@@TV:links@@' => $robots . $ll['links'], '@@TV:social@@' => $social,
            '@@TV:ld@@' => self::structuredData($sh, $p, $seoTitle, $desc, $imgAbs), '@@TV:path@@' => self::esc($canonicalPath), '@@TV:langlinks@@' => $ll['langlinks'], '@@TV:boot@@' => $boot,
            '@@TV:title@@' => self::esc($p['title']), '@@TV:date@@' => self::esc($date), '@@TV:datefmt@@' => self::esc(self::fmtDate($sh, $date)),
            '@@TV:herostyle@@' => $img && $sh['parts']['herostyle'] !== '' ? strtr($sh['parts']['herostyle'], ['@@TV:imgsrc@@' => self::esc($imgPath)]) : '',
            '@@TV:banner@@' => $img && $sh['parts']['banner'] !== '' ? strtr($sh['parts']['banner'], ['@@TV:imgsrc@@' => self::esc($imgPath)]) : '',
            '@@TV:cover@@' => $img && ($sh['parts']['cover'] ?? '') !== '' ? strtr($sh['parts']['cover'], ['@@TV:imgsrc@@' => self::esc($imgPath), '@@TV:imgalt@@' => self::esc($img['alt']), '@@TV:imgw@@' => (string) (int) $img['w'], '@@TV:imgh@@' => (string) (int) $img['h']]) : '',
            '@@TV:content@@' => $content,
        ];
        $headers = ['Content-Type' => 'text/html; charset=utf-8', 'Last-Modified' => gmdate('D, d M Y H:i:s', Blog::ts($p['updated'])) . ' GMT'] + self::cache($preview ? 0 : self::PAGE_TTL);
        if ($preview) $headers['X-Robots-Tag'] = 'noindex, nofollow';
        return self::out(200, strtr((string) $sh['post'], $map), $headers);
    }

    /** 404 con la página «no encontrado» del idioma (la que ya tiene la web), o un texto corto si no está. */
    private static function notFound(string $lang): array
    {
        $f = self::root() . ($lang === 'es' ? '' : '/' . $lang) . '/404.html';
        if (is_file($f)) return self::out(404, (string) file_get_contents($f), ['Content-Type' => 'text/html; charset=utf-8'] + self::cache(0));
        return self::plain(404, 'Not Found');
    }

    // ───────────────────────────────────────── [IMÁGENES]
    /** /media/blog/<archivo>: el contenido de la imagen subida, con caché de un año (el nombre lleva la huella del contenido, así que nunca cambia). */
    private static function media(string $file, array $reqHeaders): array
    {
        $meta = Blog::mediaMeta($file);
        $path = Blog::mediaDir() . '/' . $file;
        if ($meta === null || !is_file($path)) return self::plain(404, 'Not Found');
        $etag = '"' . substr($file, strrpos($file, '-') + 1, 12) . '"';
        $h = ['Content-Type' => (string) $meta['mime'], 'ETag' => $etag, 'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'; sandbox", 'Cross-Origin-Resource-Policy' => 'same-site'] + self::cache(31536000);
        if (($reqHeaders['if-none-match'] ?? '') === $etag) return self::out(304, '', $h);
        $h['Content-Length'] = (string) filesize($path);
        return ['status' => 200, 'headers' => $h, 'body' => '', 'file' => $path];
    }

    // ───────────────────────────────────────── [MAPA DEL SITIO]
    /** Escapa para XML. */
    private static function xml($s): string { return str_replace(['&', '<', '>', '"'], ['&amp;', '&lt;', '&gt;', '&quot;'], (string) $s); }

    /** sitemap.xml, llms.txt o llms-full.txt: el archivo de la compilación con las entradas nuevas añadidas. */
    private static function siteFile(string $name, int $now): array
    {
        $f = self::root() . '/' . $name;
        if (!is_file($f)) return self::plain(404, 'Not Found');
        $base = (string) file_get_contents($f);
        $live = [];
        foreach (Blog::LANGS as $l) foreach (Blog::liveEntries($l, $now) as $e) $live[$l][] = $e;
        $sh = null;
        foreach (Blog::LANGS as $l) if (($sh = self::shell($l)) !== null) break;
        $type = $name === 'sitemap.xml' ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8';
        $h = ['Content-Type' => $type] + self::cache(self::MAP_TTL);
        if (!$live || $sh === null) return self::out(200, $base, $h);
        $abs = rtrim($sh['base'], '/');
        if ($name === 'sitemap.xml') {
            $urls = '';
            foreach ($live as $l => $list) foreach ($list as $e) {
                $alts = [$l => $e['path']];
                foreach (Blog::translationsOf($e, true, $now) as $tl => $te) $alts[$tl] = $te['path'];
                $links = '';
                if (count($alts) > 1) {
                    foreach (Blog::LANGS as $al) if (isset($alts[$al])) $links .= '<xhtml:link rel="alternate" hreflang="' . $al . '" href="' . self::xml($abs . $alts[$al]) . '"/>';
                    if (isset($alts['es'])) $links .= '<xhtml:link rel="alternate" hreflang="x-default" href="' . self::xml($abs . $alts['es']) . '"/>';
                }
                $img = !empty($e['image']) ? '<image:image><image:loc>' . self::xml($abs . '/media/blog/' . $e['image']['file']) . '</image:loc>' . ($e['image']['alt'] !== '' ? '<image:caption>' . self::xml(mb_substr($e['image']['alt'], 0, 250, 'UTF-8')) . '</image:caption>' : '') . '</image:image>' : '';
                $urls .= '<url><loc>' . self::xml($abs . $e['path']) . '</loc>' . $links . '<lastmod>' . substr((string) ($e['updated'] ?: $e['date']), 0, 10) . '</lastmod>' . $img . '</url>';
            }
            $pos = strrpos($base, '</urlset>');
            return self::out(200, $pos === false ? $base : substr($base, 0, $pos) . $urls . substr($base, $pos), $h);
        }
        $full = $name === 'llms-full.txt';
        foreach (Blog::LANGS as $l) {
            if (empty($live[$l])) continue;
            $lsh = self::shell($l);
            if ($lsh === null) continue;
            $head = $full ? $lsh['llms']['full'] : $lsh['llms']['short'];
            $rows = '';
            foreach ($live[$l] as $e) {
                $p = $full ? Blog::get($e['id']) : null;
                $url = $abs . $e['path'];
                $d = self::clip($e['excerpt'], 160);
                $rows .= $full ? '### ' . $e['title'] . "\n" . $url . "\n" . substr((string) $e['date'], 0, 10) . "\n" . BlogMarkdown::toPlain((string) ($p['markdown'] ?? '')) . "\n\n" : '- [' . $e['title'] . '](' . $url . ')' . ($d !== '' ? ': ' . $d : '') . "\n";
            }
            $at = strpos($base, $head . "\n");
            if ($at !== false) { $ins = $at + strlen($head) + 1; $base = substr($base, 0, $ins) . $rows . substr($base, $ins); }
            else $base = rtrim($base, "\n") . "\n\n" . $head . "\n" . $rows;
        }
        return self::out(200, $base, $h);
    }

    // ───────────────────────────────────────── [SALIDA]
    /** Envía la respuesta al navegador (para api/page.php). Una respuesta con `file` envía el archivo tal cual. */
    public static function send(array $r, string $method = 'GET'): void
    {
        http_response_code($r['status']);
        foreach ($r['headers'] as $k => $v) header($k . ': ' . $v);
        if ($method === 'HEAD' || $r['status'] === 304) return;
        if ($r['file'] !== null) { readfile($r['file']); return; }
        echo $r['body'];
    }
}
