<?php
/**
 * [BLOG] Entradas de blog que se escriben en el panel (solo managers) y viven en la carpeta de datos, no en los archivos de la web: una actualización de la web (borrar y volver a subir) no las toca.
 * Se publican en /blog/<slug>/ (y /en/blog/…, /fr/blog/…, /de/blog/…) a través de api/page.php (BlogPage.php); las 21 entradas por idioma de la web original siguen siendo páginas estáticas.
 *
 * Claves del almacén (Store):
 *   blog:post:<id>         la entrada completa (id bp-<12 hex>)
 *   blog:slug:<idioma>:<slug>   → { id, alias } (alias = true si es una dirección antigua que redirige con 301 a la actual)
 *   blog:ix:<idioma>       → { <id>: entrada resumida } (lo que leen el listado, el mapa del sitio y llms.txt: un solo fichero por idioma)
 *   blog:media:<archivo>   → { file, mime, w, h, bytes, at, by } de cada imagen subida (los bytes están en <datos>/media/<archivo>)
 * Todas las escrituras van dentro de Store::locked('blog'): dos managers a la vez no se pisan ni repiten dirección.
 *
 * Una entrada: { id, grp, lang, slug, old_slugs[], title, excerpt, seo_title, seo_description, markdown, image:{file,alt}|null, status: draft|published, date: ISO UTC|null, pub_once, created, updated, by }
 *   · «Programada» no es un estado: es una entrada publicada con fecha futura (no se ve hasta esa fecha, sin tareas programadas).
 *   · Traducciones: las entradas de un mismo grupo (`grp`) son traducciones entre sí, como mucho una por idioma; el panel las enlaza y la página saca de ahí los hreflang.
 *   · Todo texto se escapa al publicar y el cuerpo pasa por BlogMarkdown (solo etiquetas permitidas): nada de lo que se escriba puede ejecutarse.
 *
 *   Blog::create(datos, quién) · update(id, datos, quién) · delete(id) · get(id) · listing() · saveImage(nombre, bytes, quién) · images() · deleteImage(archivo) · previewToken(id) · verifyPreview(id, token)
 *   Blog::resolve(idioma, slug) · liveEntries(idioma) · translationsOf(entrada) · reindex() · slugify(texto) · path(idioma, slug)
 */
namespace Torivac;

final class Blog
{
    const LANGS = ['es', 'en', 'fr', 'de'];
    /** Límites de cada campo (en caracteres). */
    const MAX_TITLE = 120, MAX_EXCERPT = 300, MAX_SEO_TITLE = 120, MAX_SEO_DESC = 200, MAX_ALT = 200, MAX_MD = 60000, MAX_SLUG = 80, MIN_SLUG = 3;
    /** Entradas en total, imágenes subidas y bytes de una imagen. */
    const MAX_POSTS = 600, MAX_IMAGES = 1500, MAX_IMAGE_BYTES = 2500000, MAX_IMAGE_SIDE = 6000, MAX_IMAGE_PIXELS = 24000000;
    /** Direcciones antiguas que se recuerdan por entrada (redirigen con 301). */
    const MAX_OLD_SLUGS = 10;
    const ID_RE = '/^bp-[0-9a-f]{12}$/D';
    const SLUG_RE = '/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/D';
    const MEDIA_RE = '/^[a-z0-9][a-z0-9-]{0,50}-[0-9a-f]{12}\.(?:jpg|png|webp)$/D';
    /** Zona horaria en la que se enseñan las fechas. */
    const TZ = 'Europe/Madrid';

    /** Letras con tilde → letra simple, igual que `slugify` de shared/blog-markdown.mjs. */
    const FOLD = ['á' => 'a', 'à' => 'a', 'ä' => 'a', 'â' => 'a', 'ã' => 'a', 'å' => 'a', 'é' => 'e', 'è' => 'e', 'ë' => 'e', 'ê' => 'e', 'í' => 'i', 'ì' => 'i', 'ï' => 'i', 'î' => 'i', 'ó' => 'o', 'ò' => 'o', 'ö' => 'o', 'ô' => 'o', 'õ' => 'o', 'ú' => 'u', 'ù' => 'u', 'ü' => 'u', 'û' => 'u', 'ñ' => 'n', 'ç' => 'c', 'ß' => 'ss', 'œ' => 'oe', 'æ' => 'ae'];

    // ───────────────────────────────────────── [PIEZAS] claves, rutas y textos
    /** Título → dirección: minúsculas, sin acentos, letras y cifras separadas por guiones, hasta 80 caracteres (cortado en un guion). Igual que slugify de shared/blog-markdown.mjs. */
    public static function slugify(string $title): string
    {
        $s = strtr(mb_strtolower($title, 'UTF-8'), self::FOLD);
        $s = trim((string) preg_replace('/[^a-z0-9]+/', '-', $s), '-');
        if (strlen($s) > self::MAX_SLUG) {
            $cut = substr($s, 0, self::MAX_SLUG);
            $c2 = preg_replace('/-[^-]*$/', '', $cut);
            $s = ($c2 !== null && $c2 !== '' && $c2 !== $cut) ? $c2 : $cut;
        }
        return rtrim($s, '-');
    }

    /** Ruta pública de una entrada: /blog/<slug>/ en español y /<idioma>/blog/<slug>/ en los demás. */
    public static function path(string $lang, string $slug): string { return ($lang === 'es' ? '' : '/' . $lang) . '/blog/' . $slug . '/'; }

    /** Clave del almacén de una entrada. */
    private static function kPost(string $id): string { return 'blog:post:' . $id; }
    /** Clave de una dirección (slug) de un idioma. */
    private static function kSlug(string $lang, string $slug): string { return 'blog:slug:' . $lang . ':' . $slug; }
    /** Clave del resumen de un idioma. */
    private static function kIx(string $lang): string { return 'blog:ix:' . $lang; }
    /** Clave de los datos de una imagen. */
    private static function kMedia(string $file): string { return 'blog:media:' . $file; }

    /** true mientras este proceso tiene el bloqueo del blog (flock no se puede pedir dos veces desde el mismo proceso sin quedarse esperando a sí mismo). */
    private static $held = false;

    /** Ejecuta `$fn` con el bloqueo del blog (o directamente, si ya se tiene). */
    private static function withLock(callable $fn)
    {
        if (self::$held) return $fn();
        return Store::locked('blog', function () use ($fn) {
            self::$held = true;
            try { return $fn(); } finally { self::$held = false; }
        });
    }

    /** Error de validación: ['error' => mensaje para quien edita, 'code' => …, 'field' => campo]. */
    private static function err(string $msg, string $code, string $field = '', int $status = 400): array { return ['error' => $msg, 'code' => $code, 'field' => $field, 'status' => $status]; }

    /** Número de caracteres (códigos de punto). */
    private static function len(string $s): int { return mb_strlen($s, 'UTF-8'); }

    /** Texto de una línea de un campo: limpio de controles y recortado de espacios; ['ok' => texto] o ['error' => …]. */
    private static function oneLine($v, string $field, string $label, int $max, bool $required = false): array
    {
        if ($v !== null && !is_string($v)) return ['err' => self::err("$label no es un texto", 'invalid', $field)];
        $t = Util::line((string) ($v ?? ''), $max + 1);
        if ($required && $t === '') return ['err' => self::err("$label es obligatorio", 'required', $field)];
        if (self::len($t) > $max) return ['err' => self::err("$label es demasiado largo (máximo $max caracteres)", 'too_long', $field)];
        return ['ok' => $t];
    }

    /** ISO 8601 con zona → «AAAA-MM-DDTHH:MM:SSZ» en UTC; null si no es una fecha válida entre 2000 y 5 años en el futuro. */
    public static function parseDate($v, ?int $now = null): ?string
    {
        if (!is_string($v) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/D', $v)) return null;
        try { $d = new \DateTimeImmutable($v); } catch (\Throwable $e) { return null; }
        $ts = $d->getTimestamp();
        if ($ts < 946684800 || $ts > ($now ?? time()) + 5 * 366 * 86400) return null;
        return gmdate('Y-m-d\TH:i:s\Z', $ts);
    }

    /** Segundos desde 1970 de una fecha guardada («…Z»); 0 si no hay. */
    public static function ts($d): int { return is_string($d) && $d !== '' ? (int) strtotime($d) : 0; }

    /** ¿Se ve en la web? Publicada y con fecha ya llegada (una publicada con fecha futura está programada). */
    public static function isLive(array $e, ?int $now = null): bool
    {
        return ($e['status'] ?? '') === 'published' && self::ts($e['date'] ?? null) > 0 && self::ts($e['date']) <= ($now ?? time());
    }

    // ───────────────────────────────────────── [LECTURA]
    /** La entrada completa o null. */
    public static function get(string $id): ?array
    {
        if (preg_match(self::ID_RE, $id) !== 1) return null;
        $p = Store::get(self::kPost($id));
        return is_array($p) && ($p['id'] ?? '') === $id ? $p : null;
    }

    /** Resumen de un idioma: { id → entrada resumida }. Si no existe pero hay entradas guardadas, se reconstruye (por si se borró a mano o se copió la carpeta de datos). */
    public static function index(string $lang): array
    {
        if (!in_array($lang, self::LANGS, true)) return [];
        $ix = Store::get(self::kIx($lang));
        if (is_array($ix)) return $ix;
        if (Store::keys('blog:post:')) { self::reindex(); $ix = Store::get(self::kIx($lang)); }
        return is_array($ix) ? $ix : [];
    }

    /** Todas las entradas resumidas (de todos los idiomas), la más reciente primero (las sin fecha, al final). Para el panel. */
    public static function listing(): array
    {
        $all = [];
        foreach (self::LANGS as $l) foreach (self::index($l) as $e) $all[] = $e;
        usort($all, function ($a, $b) { return strcmp((string) ($b['date'] ?? '') ?: (string) ($b['updated'] ?? ''), (string) ($a['date'] ?? '') ?: (string) ($a['updated'] ?? '')) ?: strcmp($a['id'], $b['id']); });
        return $all;
    }

    /** Las entradas visibles de un idioma, la más reciente primero. */
    public static function liveEntries(string $lang, ?int $now = null): array
    {
        $out = array_values(array_filter(self::index($lang), function ($e) use ($now) { return self::isLive($e, $now); }));
        usort($out, function ($a, $b) { return strcmp((string) $b['date'], (string) $a['date']) ?: strcmp($a['id'], $b['id']); });
        return $out;
    }

    /** Dirección → ['id' => …, 'alias' => bool] o null (también si la entrada ya no existe). */
    public static function resolve(string $lang, string $slug): ?array
    {
        if (!in_array($lang, self::LANGS, true) || preg_match(self::SLUG_RE, $slug) !== 1) return null;
        $r = Store::get(self::kSlug($lang, $slug));
        return is_array($r) && is_string($r['id'] ?? null) && preg_match(self::ID_RE, $r['id']) === 1 ? ['id' => $r['id'], 'alias' => !empty($r['alias'])] : null;
    }

    /** Las traducciones de una entrada (mismas `grp`, otro idioma): { idioma → entrada resumida }. Con `$liveOnly` solo las visibles. */
    public static function translationsOf(array $e, bool $liveOnly = true, ?int $now = null): array
    {
        $out = [];
        if (empty($e['grp'])) return $out;
        foreach (self::LANGS as $l) {
            if ($l === $e['lang']) continue;
            foreach (self::index($l) as $x) if (($x['grp'] ?? '') === $e['grp'] && (!$liveOnly || self::isLive($x, $now))) { $out[$l] = $x; break; }
        }
        return $out;
    }

    /** Resumen de una entrada para el listado y la web. */
    private static function entry(array $p): array
    {
        $ex = (string) ($p['excerpt'] ?? '');
        if ($ex === '') $ex = BlogMarkdown::lead((string) ($p['markdown'] ?? ''), 160);
        return ['id' => $p['id'], 'grp' => $p['grp'], 'lang' => $p['lang'], 'slug' => $p['slug'], 'title' => $p['title'], 'excerpt' => $ex, 'status' => $p['status'], 'date' => $p['date'] ?? null,
            'updated' => $p['updated'], 'image' => $p['image'] ?? null, 'path' => self::path($p['lang'], $p['slug'])];
    }

    /** Vuelve a escribir los resúmenes de todos los idiomas a partir de las entradas guardadas (arregla cualquier desajuste). Devuelve cuántas entradas hay. */
    public static function reindex(): int
    {
        return (int) self::withLock(function () {
            $ix = array_fill_keys(self::LANGS, []);
            $n = 0;
            foreach (Store::keys('blog:post:') as $k) {
                $p = Store::get($k);
                if (!is_array($p) || preg_match(self::ID_RE, (string) ($p['id'] ?? '')) !== 1 || !in_array($p['lang'] ?? '', self::LANGS, true)) continue;
                $ix[$p['lang']][$p['id']] = self::entry($p);
                $n++;
            }
            foreach (self::LANGS as $l) Store::put(self::kIx($l), (object) $ix[$l]);
            return $n;
        });
    }

    // ───────────────────────────────────────── [ESCRITURA]
    /** Valida y normaliza los campos recibidos. `$cur` = la entrada actual (al actualizar); solo se miran los campos presentes. Devuelve ['set' => campos normalizados] o ['error' …]. */
    private static function fields(array $in, ?array $cur, ?int $now): array
    {
        $set = [];
        foreach (['title' => ['El título', self::MAX_TITLE, true], 'seo_title' => ['El título para buscadores', self::MAX_SEO_TITLE, false], 'seo_description' => ['La descripción para buscadores', self::MAX_SEO_DESC, false], 'excerpt' => ['El resumen', self::MAX_EXCERPT, false]] as $k => $spec) {
            if (!array_key_exists($k, $in) && ($cur !== null || $k !== 'title')) continue;
            $r = self::oneLine($in[$k] ?? null, $k, $spec[0], $spec[1], $spec[2]);
            if (isset($r['err'])) return $r['err'];
            $set[$k] = $r['ok'];
        }
        if (array_key_exists('markdown', $in)) {
            if (!is_string($in['markdown'])) return self::err('El texto no es válido', 'invalid', 'markdown');
            $md = rtrim(BlogMarkdown::clean($in['markdown']));
            if (self::len($md) > self::MAX_MD) return self::err('El texto es demasiado largo (máximo ' . self::MAX_MD . ' caracteres)', 'too_long', 'markdown');
            $set['markdown'] = $md;
        } elseif ($cur === null) $set['markdown'] = '';
        if (array_key_exists('slug', $in) || $cur === null) {
            $raw = $in['slug'] ?? '';
            if (!is_string($raw)) return self::err('La dirección no es válida', 'invalid', 'slug');
            $s = self::slugify($raw !== '' ? $raw : (string) ($set['title'] ?? ($cur['title'] ?? '')));
            if (preg_match(self::SLUG_RE, $s) !== 1) return self::err('La dirección (slug) necesita entre ' . self::MIN_SLUG . ' y ' . self::MAX_SLUG . ' letras, cifras o guiones', 'invalid', 'slug');
            $set['slug'] = $s;
        }
        if (array_key_exists('image', $in)) {
            $im = $in['image'];
            if ($im === null || $im === '' || $im === []) $set['image'] = null;
            elseif (!is_array($im) || !is_string($im['file'] ?? null)) return self::err('La imagen no es válida', 'invalid', 'image');
            else {
                $meta = preg_match(self::MEDIA_RE, $im['file']) === 1 ? Store::get(self::kMedia($im['file'])) : null;
                if (!is_array($meta)) return self::err('Esa imagen no está subida (sube la imagen otra vez)', 'invalid', 'image');
                $alt = self::oneLine($im['alt'] ?? '', 'image', 'El texto alternativo de la imagen', self::MAX_ALT, true);
                if (isset($alt['err'])) { $alt['err']['field'] = 'image_alt'; return $alt['err']; }
                $set['image'] = ['file' => $im['file'], 'alt' => $alt['ok'], 'w' => (int) $meta['w'], 'h' => (int) $meta['h']];
            }
        }
        if (array_key_exists('status', $in)) {
            if (!in_array($in['status'] ?? null, ['draft', 'published'], true)) return self::err('El estado tiene que ser borrador o publicada', 'invalid', 'status');
            $set['status'] = $in['status'];
        }
        if (array_key_exists('date', $in)) {
            if ($in['date'] === null || $in['date'] === '') $set['date'] = null;
            else {
                $d = self::parseDate($in['date'], $now);
                if ($d === null) return self::err('La fecha no es válida (usa el formato 2026-10-28T09:30:00Z, entre 2000 y 5 años en el futuro)', 'invalid', 'date');
                $set['date'] = $d;
            }
        }
        return ['set' => $set];
    }

    /** Comprobaciones para publicar: lo imprescindible (título, dirección, texto y, si hay imagen, su texto alternativo). */
    private static function publishable(array $p): ?array
    {
        if (($p['title'] ?? '') === '') return self::err('Para publicar hace falta un título', 'required', 'title');
        if (trim((string) ($p['markdown'] ?? '')) === '') return self::err('Para publicar hace falta el texto de la entrada', 'required', 'markdown');
        if (!empty($p['image']) && trim((string) ($p['image']['alt'] ?? '')) === '') return self::err('La imagen necesita un texto alternativo', 'required', 'image_alt');
        return null;
    }

    /** Miembros (id → idioma) del grupo de traducciones `$grp`, mirando los resúmenes y los cambios pendientes de esta operación (`$pending`: id → entrada ya con su grupo nuevo). */
    private static function members(string $grp, array $pending): array
    {
        $out = [];
        foreach (self::LANGS as $l) foreach (self::index($l) as $x) {
            $g = isset($pending[$x['id']]) ? $pending[$x['id']]['grp'] : ($x['grp'] ?? '');
            if ($g === $grp) $out[$x['id']] = $l;
        }
        return $out;
    }

    /**
     * Aplica los enlaces de traducción pedidos (idioma → id | '' para desenlazar) a la entrada `$p` (ya con su `grp`). Enlazar junta los dos grupos (cada uno puede traer más traducciones) siempre que no
     * quede más de una entrada por idioma. Los cambios de grupo de las demás entradas se anotan en `$others`. Devuelve un error o null.
     */
    private static function linkTranslations(array &$p, $want, array &$others): ?array
    {
        if (!is_array($want)) return self::err('Las traducciones no son válidas', 'invalid', 'translations');
        foreach ($want as $l => $target) {
            if (!in_array($l, self::LANGS, true) || $l === $p['lang']) return self::err('Idioma de traducción no válido', 'invalid', 'translations');
            $target = is_string($target) ? $target : '';
            $member = null;                                                                    // la entrada de idioma $l que hoy está en el grupo de $p
            foreach (self::members($p['grp'], $others) as $id => $ml) if ($ml === $l && $id !== $p['id']) $member = $id;
            if ($target === ($member ?? '')) continue;
            if ($member !== null) {                                                           // desenlazar la actual
                $m = $others[$member] ?? self::get($member);
                if ($m !== null) { $m['grp'] = 'bg-' . bin2hex(random_bytes(6)); $others[$member] = $m; }
            }
            if ($target === '') continue;
            $t = $others[$target] ?? self::get($target);
            if ($t === null || $t['lang'] !== $l) return self::err('La traducción elegida no existe o no está en ese idioma', 'invalid', 'translations');
            if ($t['id'] === $p['id']) return self::err('Una entrada no puede ser traducción de sí misma', 'invalid', 'translations');
            $mine = self::members($p['grp'], $others);
            $theirs = self::members($t['grp'], $others);
            $langs = array_merge(array_values($mine), array_values($theirs));
            if (count($langs) !== count(array_unique($langs))) return self::err('Esa traducción ya está enlazada con otras entradas y hay dos en el mismo idioma: desenlázala primero', 'conflict', 'translations', 409);
            foreach (array_keys($theirs) as $id) {                                             // el grupo de la traducción pasa a ser el de esta entrada
                $q = $others[$id] ?? self::get($id);
                if ($q !== null) { $q['grp'] = $p['grp']; $others[$id] = $q; }
            }
        }
        return null;
    }

    /** Guarda la entrada, las direcciones y los resúmenes (dentro del bloqueo). `$others` = otras entradas cambiadas (traducciones). */
    private static function persist(array $p, array $others): void
    {
        $ix = [];
        $touch = function (array $q) use (&$ix) {
            if (!isset($ix[$q['lang']])) $ix[$q['lang']] = self::index($q['lang']);
            $ix[$q['lang']][$q['id']] = self::entry($q);
        };
        Store::put(self::kPost($p['id']), $p);
        Store::put(self::kSlug($p['lang'], $p['slug']), ['id' => $p['id']]);
        foreach ($p['old_slugs'] as $o) Store::put(self::kSlug($p['lang'], $o), ['id' => $p['id'], 'alias' => true]);
        $touch($p);
        foreach ($others as $o) { Store::put(self::kPost($o['id']), $o); $touch($o); }
        foreach ($ix as $l => $map) Store::put(self::kIx($l), (object) $map);
    }

    /**
     * Crea una entrada. Campos: lang (obligatorio) · title (obligatorio) · slug (si falta sale del título) · excerpt · seo_title · seo_description · markdown · image {file, alt} · status (draft por defecto) · date · translations {idioma: id}.
     * @return array{post?:array,error?:string,code?:string,field?:string,status?:int}
     */
    public static function create(array $in, string $by, ?int $nowMs = null): array
    {
        $now = $nowMs === null ? time() : (int) floor($nowMs / 1000);
        $lang = $in['lang'] ?? null;
        if (!is_string($lang) || !in_array($lang, self::LANGS, true)) return self::err('El idioma tiene que ser es, en, fr o de', 'invalid', 'lang');
        $f = self::fields($in, null, $now);
        if (isset($f['error'])) return $f;
        return self::withLock(function () use ($in, $f, $lang, $by, $now) {
            $total = 0;
            foreach (self::LANGS as $l) $total += count(self::index($l));
            if ($total >= self::MAX_POSTS) return self::err('Se ha llegado al máximo de ' . self::MAX_POSTS . ' entradas: borra alguna antes de crear otra', 'limit', '', 409);
            $set = $f['set'];
            if (Store::get(self::kSlug($lang, $set['slug'])) !== null) return self::err('Ya hay una entrada en ese idioma con esa dirección (slug): cámbiala', 'exists', 'slug', 409);
            do { $id = 'bp-' . bin2hex(random_bytes(6)); } while (Store::get(self::kPost($id)) !== null);
            $iso = gmdate('Y-m-d\TH:i:s\Z', $now);
            $p = $set + ['id' => $id, 'grp' => 'bg-' . bin2hex(random_bytes(6)), 'lang' => $lang, 'old_slugs' => [], 'image' => null, 'status' => 'draft', 'date' => null, 'pub_once' => false, 'created' => $iso, 'updated' => $iso, 'by' => $by];
            $p += ['excerpt' => '', 'seo_title' => '', 'seo_description' => '', 'markdown' => ''];
            if ($p['status'] === 'published') {
                if (($e = self::publishable($p)) !== null) return $e;
                if ($p['date'] === null) $p['date'] = $iso;
                $p['pub_once'] = true;
            }
            $others = [];
            if (array_key_exists('translations', $in) && ($e = self::linkTranslations($p, $in['translations'], $others)) !== null) return $e;
            self::persist($p, $others);
            return ['post' => $p];
        });
    }

    /**
     * Actualiza una entrada (solo los campos que llegan). El idioma no se puede cambiar. Si cambia la dirección de una que ya se publicó, la antigua redirige (301) a la nueva.
     * @return array{post?:array,error?:string,code?:string,field?:string,status?:int}
     */
    public static function update(string $id, array $in, string $by, ?int $nowMs = null): array
    {
        $now = $nowMs === null ? time() : (int) floor($nowMs / 1000);
        if (array_key_exists('slug', $in) && $in['slug'] === '') unset($in['slug']);               // dirección vacía al actualizar = dejar la que hay
        $f = self::fields($in, ['title' => ''], $now);
        if (isset($f['error'])) return $f;
        return self::withLock(function () use ($id, $in, $f, $by, $now) {
            $cur = self::get($id);
            if ($cur === null) return self::err('No existe esa entrada', 'not_found', '', 404);
            if (array_key_exists('lang', $in) && $in['lang'] !== $cur['lang']) return self::err('El idioma de una entrada no se puede cambiar: crea otra en ese idioma y enlázala como traducción', 'invalid', 'lang');
            $p = $f['set'] + $cur;
            $iso = gmdate('Y-m-d\TH:i:s\Z', $now);
            if ($p['slug'] !== $cur['slug']) {
                $hit = Store::get(self::kSlug($cur['lang'], $p['slug']));
                if (is_array($hit) && ($hit['id'] ?? '') !== $id) return self::err('Ya hay una entrada en ese idioma con esa dirección (slug): cámbiala', 'exists', 'slug', 409);
                if ($cur['pub_once']) $p['old_slugs'] = array_slice(array_values(array_unique(array_merge([$cur['slug']], $cur['old_slugs']))), 0, self::MAX_OLD_SLUGS);
                else Store::delete(self::kSlug($cur['lang'], $cur['slug']));
                $p['old_slugs'] = array_values(array_filter($p['old_slugs'] ?? [], function ($o) use ($p) { return $o !== $p['slug']; }));
            }
            if ($p['status'] === 'published') {
                if (($e = self::publishable($p)) !== null) return $e;
                if (($p['date'] ?? null) === null) $p['date'] = $iso;
                $p['pub_once'] = true;
            }
            $p['updated'] = $iso;
            $p['by'] = $by;
            $others = [];
            if (array_key_exists('translations', $in) && ($e = self::linkTranslations($p, $in['translations'], $others)) !== null) return $e;
            self::persist($p, $others);
            return ['post' => $p];
        });
    }

    /** Borra una entrada y sus direcciones (la web deja de servirla); las traducciones enlazadas siguen existiendo. true si existía. */
    public static function delete(string $id): bool
    {
        return (bool) self::withLock(function () use ($id) {
            $p = self::get($id);
            if ($p === null) return false;
            Store::delete(self::kPost($id));
            Store::delete(self::kSlug($p['lang'], $p['slug']));
            foreach ($p['old_slugs'] as $o) Store::delete(self::kSlug($p['lang'], $o));
            $ix = self::index($p['lang']);
            unset($ix[$id]);
            Store::put(self::kIx($p['lang']), (object) $ix);
            return true;
        });
    }

    // ───────────────────────────────────────── [IMÁGENES]
    /** Carpeta donde están los bytes de las imágenes (dentro de la carpeta de datos, nunca servida directamente). */
    public static function mediaDir(): string { return Store::root() . '/media'; }

    /** Datos de una imagen subida (o null). */
    public static function mediaMeta(string $file): ?array
    {
        if (preg_match(self::MEDIA_RE, $file) !== 1) return null;
        $m = Store::get(self::kMedia($file));
        return is_array($m) ? $m : null;
    }

    /** Todas las imágenes subidas, la más reciente primero. */
    public static function images(): array
    {
        $out = [];
        foreach (Store::keys('blog:media:') as $k) { $m = Store::get($k); if (is_array($m) && isset($m['file'])) $out[] = $m + ['url' => '/media/blog/' . $m['file']]; }
        usort($out, function ($a, $b) { return strcmp((string) ($b['at'] ?? ''), (string) ($a['at'] ?? '')) ?: strcmp($a['file'], $b['file']); });
        return $out;
    }

    /**
     * Guarda una imagen subida: solo JPEG, PNG o WebP de verdad (se mira el contenido, no el nombre ni lo que diga el navegador), hasta 2,5 MB y 6000 px por lado. El archivo se llama
     * <nombre>-<12 hex del contenido>.<ext>: la misma imagen subida dos veces es un solo archivo y su dirección nunca cambia de contenido (caché de un año).
     * @return array{image?:array,error?:string,code?:string,field?:string,status?:int}
     */
    public static function saveImage(string $name, string $bytes, string $by, ?int $nowMs = null): array
    {
        if ($bytes === '') return self::err('La imagen está vacía', 'image', 'image');
        if (strlen($bytes) > self::MAX_IMAGE_BYTES) return self::err('La imagen pesa demasiado (máximo ' . round(self::MAX_IMAGE_BYTES / 1000000, 1) . ' MB): el panel la comprime antes de subirla', 'image', 'image');
        $info = @getimagesizefromstring($bytes);
        $types = [IMAGETYPE_JPEG => ['image/jpeg', 'jpg'], IMAGETYPE_PNG => ['image/png', 'png'], IMAGETYPE_WEBP => ['image/webp', 'webp']];
        if (!is_array($info) || !isset($types[$info[2]])) return self::err('Solo se admiten imágenes JPEG, PNG o WebP', 'image', 'image');
        [$w, $h] = [(int) $info[0], (int) $info[1]];
        if ($w < 1 || $h < 1 || $w > self::MAX_IMAGE_SIDE || $h > self::MAX_IMAGE_SIDE || $w * $h > self::MAX_IMAGE_PIXELS) return self::err('La imagen es demasiado grande (máximo ' . self::MAX_IMAGE_SIDE . ' px por lado)', 'image', 'image');
        [$mime, $ext] = $types[$info[2]];
        $hash = substr(hash('sha256', $bytes), 0, 12);
        $base = trim(substr(self::slugify((string) preg_replace('/\.[A-Za-z0-9]{2,5}$/', '', $name)), 0, 50), '-');
        if ($base === '') $base = 'imagen';
        $file = $base . '-' . $hash . '.' . $ext;
        return self::withLock(function () use ($file, $hash, $bytes, $mime, $w, $h, $by, $nowMs) {
            foreach (Store::keys('blog:media:') as $k) {                                       // la misma imagen ya subida (con otro nombre): se reutiliza
                $m = Store::get($k);
                if (is_array($m) && isset($m['file']) && strpos($m['file'], '-' . $hash . '.') !== false) return ['image' => $m + ['url' => '/media/blog/' . $m['file']]];
            }
            if (count(Store::keys('blog:media:')) >= self::MAX_IMAGES) return self::err('Se ha llegado al máximo de ' . self::MAX_IMAGES . ' imágenes: borra las que no uses', 'limit', 'image', 409);
            $dir = self::mediaDir();
            if (!is_dir($dir) && !@mkdir($dir, Store::DIR_MODE, true) && !is_dir($dir)) throw new \RuntimeException('No puedo crear la carpeta de imágenes');
            $tmp = tempnam($dir, '.tmp');
            if ($tmp === false || file_put_contents($tmp, $bytes, LOCK_EX) === false) { if ($tmp) @unlink($tmp); throw new \RuntimeException('No puedo guardar la imagen'); }
            @chmod($tmp, Store::FILE_MODE);
            if (!@rename($tmp, $dir . '/' . $file)) { @unlink($tmp); throw new \RuntimeException('No puedo guardar la imagen'); }
            $meta = ['file' => $file, 'mime' => $mime, 'w' => $w, 'h' => $h, 'bytes' => strlen($bytes), 'at' => Util::iso($nowMs === null ? null : $nowMs / 1000), 'by' => $by];
            Store::put(self::kMedia($file), $meta);
            return ['image' => $meta + ['url' => '/media/blog/' . $file]];
        });
    }

    /** ¿Alguna entrada usa esta imagen (como destacada o dentro del texto)? Devuelve los títulos. */
    public static function imageUsedBy(string $file): array
    {
        $out = [];
        foreach (Store::keys('blog:post:') as $k) {
            $p = Store::get($k);
            if (!is_array($p)) continue;
            if (($p['image']['file'] ?? '') === $file || strpos((string) ($p['markdown'] ?? ''), '/media/blog/' . $file) !== false) $out[] = (string) ($p['title'] ?? $p['id']);
        }
        return $out;
    }

    /** Borra una imagen si ninguna entrada la usa. @return array{ok?:bool,error?:string,code?:string,status?:int,used_by?:array} */
    public static function deleteImage(string $file): array
    {
        if (self::mediaMeta($file) === null) return self::err('No existe esa imagen', 'not_found', '', 404);
        $used = self::imageUsedBy($file);
        if ($used) return self::err('La imagen está en uso en: ' . implode(', ', array_slice($used, 0, 3)) . (count($used) > 3 ? '…' : ''), 'in_use', '', 409) + ['used_by' => $used];
        Store::delete(self::kMedia($file));
        @unlink(self::mediaDir() . '/' . $file);
        return ['ok' => true];
    }

    // ───────────────────────────────────────── [VISTA PREVIA] dirección firmada para ver una entrada sin publicar
    /** Código de la vista previa de una entrada, válido `$ttl` segundos: «<caducidad>.<firma>»; null si el servidor no tiene session_secret válido. */
    public static function previewToken(string $id, int $ttl = 3600, ?int $now = null): ?string
    {
        $secret = Auth::sessionSecret();
        if ($secret === null) return null;
        $exp = ($now ?? time()) + $ttl;
        return $exp . '.' . hash_hmac('sha256', 'blog-preview|' . $id . '|' . $exp, $secret);
    }

    /** ¿Es válido y vigente ese código para esa entrada? */
    public static function verifyPreview(string $id, $token, ?int $now = null): bool
    {
        $secret = Auth::sessionSecret();
        if ($secret === null || !is_string($token) || !preg_match('/^(\d{9,11})\.([0-9a-f]{64})$/D', $token, $m)) return false;
        return (int) $m[1] >= ($now ?? time()) && hash_equals(hash_hmac('sha256', 'blog-preview|' . $id . '|' . $m[1], $secret), $m[2]);
    }
}
