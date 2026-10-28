<?php
/**
 * [BLOG-API] Rutas del blog para el panel (solo managers; Router::route las despacha aquí). Cuerpo y respuestas en JSON; los errores de validación llevan { error, code, field } y el código HTTP que toca
 * (400 datos no válidos · 404 no existe · 409 dirección repetida, traducción ya enlazada, imagen en uso o límite · 429 demasiadas peticiones).
 *   GET    /api/blog/posts                  listado de todas las entradas (resumidas) de todos los idiomas, con la hora del servidor para saber cuáles están programadas
 *   GET    /api/blog/posts/:id              la entrada completa (con sus traducciones { idioma: id } y su ruta pública)
 *   POST   /api/blog/posts                  crea (201)
 *   POST   /api/blog/posts/:id              actualiza solo los campos que se envían
 *   DELETE /api/blog/posts/:id              borra
 *   POST   /api/blog/posts/:id/preview      dirección firmada (1 h) para ver la entrada tal como saldrá, aunque sea un borrador: { path, query }
 *   GET    /api/blog/images                 imágenes subidas
 *   POST   /api/blog/images                 { name, data: base64 } → sube una imagen (JPEG, PNG o WebP de hasta 2,5 MB; el panel la comprime antes)
 *   DELETE /api/blog/images/:archivo        borra una imagen que ninguna entrada use
 *   POST   /api/blog/reindex                reconstruye los resúmenes desde las entradas guardadas
 */
namespace Torivac;

final class BlogApi
{
    /** Guardados de entradas y subidas de imágenes por hora y manager. */
    const SAVES_PER_HOUR = 600, UPLOADS_PER_HOUR = 120;
    /** Tamaño máximo del cuerpo de una entrada y de una imagen en base64 (bytes). */
    const MAX_POST_BODY = 600000, MAX_UPLOAD_BODY = 4000000;

    /** Despacha una ruta /blog/… (el que llama ya comprobó que es un manager). */
    public static function handle(Request $req, array $who): Response
    {
        $path = $req->path;
        $m = $req->method;
        if ($path === '/blog/posts' && $m === 'GET') return new Response(['ok' => true, 'posts' => Blog::listing(), 'now' => Util::iso(), 'limits' => self::limits()]);
        if ($path === '/blog/posts' && $m === 'POST') return self::save(null, $req, $who);
        if (preg_match('#^/blog/posts/(bp-[0-9a-f]{12})$#D', $path, $mm)) {
            if ($m === 'GET') return self::one($mm[1]);
            if ($m === 'POST') return self::save($mm[1], $req, $who);
            if ($m === 'DELETE') return Blog::delete($mm[1]) ? new Response(['ok' => true]) : new Response(['ok' => false, 'error' => 'No existe esa entrada', 'code' => 'not_found'], 404);
        }
        if ($m === 'POST' && preg_match('#^/blog/posts/(bp-[0-9a-f]{12})/preview$#D', $path, $mm)) return self::preview($mm[1]);
        if ($path === '/blog/images' && $m === 'GET') return new Response(['ok' => true, 'images' => Blog::images()]);
        if ($path === '/blog/images' && $m === 'POST') return self::upload($req, $who);
        if ($m === 'DELETE' && preg_match('#^/blog/images/([a-z0-9][a-z0-9-]{0,50}-[0-9a-f]{12}\.(?:jpg|png|webp))$#D', $path, $mm)) return self::result(Blog::deleteImage($mm[1]));
        if ($path === '/blog/reindex' && $m === 'POST') return new Response(['ok' => true, 'posts' => Blog::reindex()]);
        return new Response(['ok' => false, 'error' => 'No encontrado'], 404);
    }

    /** Límites que el panel enseña junto a cada campo. */
    private static function limits(): array
    {
        return ['title' => Blog::MAX_TITLE, 'excerpt' => Blog::MAX_EXCERPT, 'seo_title' => Blog::MAX_SEO_TITLE, 'seo_description' => Blog::MAX_SEO_DESC, 'alt' => Blog::MAX_ALT, 'markdown' => Blog::MAX_MD, 'slug' => Blog::MAX_SLUG,
            'posts' => Blog::MAX_POSTS, 'image_bytes' => Blog::MAX_IMAGE_BYTES, 'image_side' => Blog::MAX_IMAGE_SIDE];
    }

    /** Un resultado de Blog::* → respuesta: los errores llevan su código HTTP; lo demás sale con ok. */
    private static function result(array $r): Response
    {
        if (isset($r['error'])) {
            $status = (int) ($r['status'] ?? 400);
            unset($r['status']);
            return new Response(['ok' => false] + $r, $status);
        }
        return new Response(['ok' => true] + $r);
    }

    /** La entrada tal como la ve el panel: completa, con sus traducciones, su ruta y si ya se ve en la web. */
    private static function view(array $p): array
    {
        $tr = [];
        foreach (Blog::translationsOf($p, false) as $l => $e) $tr[$l] = $e['id'];
        return $p + ['translations' => Util::obj($tr), 'path' => Blog::path($p['lang'], $p['slug']), 'live' => Blog::isLive($p)];
    }

    /** GET /blog/posts/:id */
    private static function one(string $id): Response
    {
        $p = Blog::get($id);
        return $p === null ? new Response(['ok' => false, 'error' => 'No existe esa entrada', 'code' => 'not_found'], 404) : new Response(['ok' => true, 'post' => self::view($p), 'now' => Util::iso()]);
    }

    /** POST /blog/posts (crear) y POST /blog/posts/:id (actualizar). */
    private static function save(?string $id, Request $req, array $who): Response
    {
        $b = $req->json(self::MAX_POST_BODY);
        if ($b === null || Util::isList($b)) return new Response(['ok' => false, 'error' => 'Petición no válida (¿el texto es demasiado largo?)', 'code' => 'invalid'], 400);
        if (!RateLimit::hit('blogsave', (string) $who['sub'], self::SAVES_PER_HOUR, 3600000)['allowed']) return new Response(['ok' => false, 'error' => 'Demasiados guardados seguidos. Espera unos minutos.'], 429);
        $r = $id === null ? Blog::create($b, (string) $who['sub']) : Blog::update($id, $b, (string) $who['sub']);
        if (isset($r['error'])) return self::result($r);
        return new Response(['ok' => true, 'post' => self::view($r['post']), 'now' => Util::iso()], $id === null ? 201 : 200);
    }

    /** POST /blog/posts/:id/preview */
    private static function preview(string $id): Response
    {
        $p = Blog::get($id);
        if ($p === null) return new Response(['ok' => false, 'error' => 'No existe esa entrada', 'code' => 'not_found'], 404);
        $tok = Blog::previewToken($id, 3600);
        if ($tok === null) return new Response(['ok' => false, 'error' => 'Falta un session_secret válido en api/config.php', 'code' => 'config'], 503);
        return new Response(['ok' => true, 'path' => Blog::path($p['lang'], $p['slug']), 'query' => 'tvp=' . $id . '.' . $tok, 'expires' => gmdate('Y-m-d\TH:i:s\Z', time() + 3600)]);
    }

    /** POST /blog/images { name, data } */
    private static function upload(Request $req, array $who): Response
    {
        $b = $req->json(self::MAX_UPLOAD_BODY);
        if ($b === null || !is_string($b['data'] ?? null)) return new Response(['ok' => false, 'error' => 'Envía { name, data } con la imagen en base64 (de hasta ' . round(Blog::MAX_IMAGE_BYTES / 1000000, 1) . ' MB)', 'code' => 'invalid'], 400);
        if (!RateLimit::hit('blogimg', (string) $who['sub'], self::UPLOADS_PER_HOUR, 3600000)['allowed']) return new Response(['ok' => false, 'error' => 'Demasiadas imágenes seguidas. Espera unos minutos.'], 429);
        $data = preg_replace('#^data:image/[a-z+]+;base64,#', '', trim($b['data']));
        $bytes = base64_decode((string) $data, true);
        if ($bytes === false) return new Response(['ok' => false, 'error' => 'La imagen no es base64 válido', 'code' => 'image', 'field' => 'image'], 400);
        $name = is_string($b['name'] ?? null) ? Util::line($b['name'], 120) : '';
        $r = Blog::saveImage($name, $bytes, (string) $who['sub']);
        return isset($r['error']) ? self::result($r) : new Response(['ok' => true, 'image' => $r['image']], 201);
    }
}
