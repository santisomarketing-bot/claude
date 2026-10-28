<?php
/**
 * Pruebas del blog del panel (Blog.php y las rutas /api/blog/… de BlogApi.php): entradas (borrador, publicada, programada), direcciones únicas por idioma con redirección de las antiguas,
 * traducciones enlazadas, imágenes de verdad (JPEG, PNG, WebP), vista previa firmada, permisos y límites.
 */
namespace Torivac\Tests;

use Torivac\Blog;
use Torivac\Router;
use Torivac\Store;
use Torivac\Users;

require_once __DIR__ . '/harness.php';
require_once __DIR__ . '/support.php';

/** Instante fijo de las pruebas (2026-10-28 10:00:00 UTC) en milisegundos. */
const BL_NOW_MS = 1793181600000;

/** Entrada mínima válida (se puede sobrescribir cualquier campo). */
function bl_post(array $over = []): array { return $over + ['lang' => 'es', 'title' => 'Cómo elegir un transformador toroidal', 'markdown' => "## Potencia\n\nElige la potencia con un **20 %** de margen."]; }

/** Crea una entrada y devuelve la entrada (falla la prueba si da error). */
function bl_make(array $over = [], int $ms = BL_NOW_MS): array
{
    $r = Blog::create(bl_post($over), 'jefa@torivac.test', $ms);
    T::true(isset($r['post']), 'crear: ' . ($r['error'] ?? ''));
    return $r['post'] ?? [];
}

/** Manager y cliente con sesión → [token del manager, token del cliente]. */
function bl_tokens(): array
{
    Users::create(['email' => 'jefa@torivac.test', 'name' => 'Jefa', 'role' => 'manager', 'password' => PW_JEFE]);
    Users::create(['email' => 'ana.compras@acme.test', 'name' => 'Ana', 'role' => 'client', 'password' => PW_ANA]);
    return [login_token('jefa@torivac.test', PW_JEFE, '10.8.9.1'), login_token('ana.compras@acme.test', PW_ANA, '10.8.9.2')];
}

/** Llamada al API con token → Response. */
function bl_api(string $method, string $path, $body, ?string $tok): \Torivac\Response { return Router::handle(req($method, $path, $body, $tok ? bearer($tok) : [])); }

/** B1 · slugify da lo mismo que la versión de JavaScript (casos compartidos). */
function test_blog_slugify_matches_javascript()
{
    $fx = json_decode((string) file_get_contents(is_file(__DIR__ . '/../../../shared/blog-markdown.fixtures.json') ? __DIR__ . '/../../../shared/blog-markdown.fixtures.json' : __DIR__ . '/blog-markdown.fixtures.json'), true);
    foreach ($fx['slug'] as $c) T::same($c['slug'], Blog::slugify($c['title']), 'slugify ' . json_encode($c['title'], JSON_UNESCAPED_UNICODE));
}

/** B2 · Crear un borrador: id con su forma, campos por defecto, nada visible, y aparece en el listado de su idioma. */
function test_blog_create_draft_defaults()
{
    fresh();
    $p = bl_make();
    T::true(preg_match(Blog::ID_RE, $p['id']) === 1, 'id con forma bp-<12 hex>');
    T::same(['draft', null, 'como-elegir-un-transformador-toroidal', 'es', false], [$p['status'], $p['date'], $p['slug'], $p['lang'], $p['pub_once']], 'estado, fecha, dirección derivada del título');
    T::same(['', '', '', null, []], [$p['excerpt'], $p['seo_title'], $p['seo_description'], $p['image'], $p['old_slugs']], 'campos vacíos por defecto');
    T::same('2026-10-28T10:00:00Z', $p['created'], 'creada en la hora de la prueba');
    T::same([$p['id']], array_keys(Blog::index('es')), 'en el resumen de su idioma');
    T::same([], Blog::index('en'), 'no en otro idioma');
    T::same([], Blog::liveEntries('es', BL_NOW_MS / 1000), 'un borrador no se ve');
    T::same($p, Blog::get($p['id']), 'se lee igual que se guardó');
    T::same('/blog/como-elegir-un-transformador-toroidal/', Blog::path('es', $p['slug']), 'ruta en español');
    T::same('/en/blog/x-y/', Blog::path('en', 'x-y'), 'ruta en inglés');
    T::same(['id', 'grp', 'lang', 'slug', 'title', 'excerpt', 'status', 'date', 'updated', 'image', 'path'], array_keys(Blog::index('es')[$p['id']]), 'forma del resumen');
    T::same('Elige la potencia con un 20 % de margen.', Blog::index('es')[$p['id']]['excerpt'], 'sin resumen escrito, sale el primer párrafo del texto');
}

/** B3 · Validación de los campos: obligatorios, límites en caracteres (no bytes), tipos y limpieza de controles. */
function test_blog_create_validates_fields()
{
    fresh();
    foreach ([[['lang' => 'xx'], 'lang'], [['lang' => null], 'lang'], [['title' => ''], 'title'], [['title' => 12], 'title'], [['title' => str_repeat('é', 121)], 'title'], [['excerpt' => str_repeat('a', 301)], 'excerpt'],
        [['seo_title' => str_repeat('a', 121)], 'seo_title'], [['seo_description' => str_repeat('a', 201)], 'seo_description'], [['markdown' => str_repeat('a', 60001)], 'markdown'], [['markdown' => ['a']], 'markdown'],
        [['slug' => 'a'], 'slug'], [['slug' => '--'], 'slug'], [['status' => 'oculta'], 'status'], [['date' => 'ayer'], 'date'], [['date' => '1999-12-31T23:59:59Z'], 'date'], [['date' => '2099-01-01T00:00:00Z'], 'date'], [['date' => '2026-10-28'], 'date'],
        [['image' => ['file' => 'no-existe-0123456789ab.png', 'alt' => 'x']], 'image'], [['image' => 'foto.png'], 'image']] as [$over, $field]) {
        $r = Blog::create(bl_post($over), 'jefa@torivac.test', BL_NOW_MS);
        T::same($field, $r['field'] ?? 'ninguno', 'campo con error: ' . json_encode($over, JSON_UNESCAPED_UNICODE));
        T::same(400, $r['status'] ?? 0, 'es un 400');
    }
    T::same([], Blog::listing(), 'nada se guardó');
    $p = bl_make(['title' => "  Título\tcon\r\ncontroles\x07 y   espacios  ", 'markdown' => "Hola\x00\x07 mundo\u{202E}\r\n\r\n\r\nfin   \n\n"]);
    T::same('Título con controles y espacios', $p['title'], 'el título queda en una línea y sin controles');
    T::same("Hola mundo\n\n\nfin", $p['markdown'], 'el texto queda sin controles ni marcas de dirección y sin saltos finales');
    $ok = bl_make(['title' => str_repeat('é', 120), 'slug' => 'a-b', 'markdown' => str_repeat('é', 60000)]);
    T::same(120, mb_strlen($ok['title']), '120 caracteres caben aunque sean más bytes');
}

/** B4 · Publicar exige título y texto; sin fecha se pone la de ahora; con fecha futura queda programada y no se ve hasta entonces. */
function test_blog_publish_schedule_and_visibility()
{
    fresh();
    $r = Blog::create(bl_post(['status' => 'published', 'markdown' => '   ']), 'j', BL_NOW_MS);
    T::same(['required', 'markdown'], [$r['code'] ?? '', $r['field'] ?? ''], 'publicar sin texto no vale');
    $p = bl_make(['status' => 'published']);
    T::same(['published', '2026-10-28T10:00:00Z', true], [$p['status'], $p['date'], $p['pub_once']], 'publicada: fecha de ahora');
    T::true(Blog::isLive($p, 1793181600), 'se ve en su fecha');
    T::true(!Blog::isLive($p, 1793181599), 'no se ve un segundo antes');
    $fut = bl_make(['title' => 'Programada', 'status' => 'published', 'date' => '2026-11-15T08:30:00+01:00']);
    T::same('2026-11-15T07:30:00Z', $fut['date'], 'la fecha con zona se guarda en UTC');
    $live = array_column(Blog::liveEntries('es', 1793181600), 'id');
    T::same([$p['id']], $live, 'la programada no sale en el listado público');
    $live = array_column(Blog::liveEntries('es', strtotime('2026-11-15T07:30:00Z')), 'id');
    T::same([$fut['id'], $p['id']], $live, 'llegada su fecha, sale la primera (la más reciente arriba)');
    // despublicar y volver a publicar conserva la fecha original
    $u = Blog::update($p['id'], ['status' => 'draft'], 'j', BL_NOW_MS + 5000);
    T::same(['draft', '2026-10-28T10:00:00Z'], [$u['post']['status'], $u['post']['date']], 'pasar a borrador conserva la fecha');
    T::same([], array_column(Blog::liveEntries('es', 1793181600 + 100), 'id') === [$p['id']] ? [$p['id']] : [], 'y deja de verse');
    $u = Blog::update($p['id'], ['status' => 'published'], 'j', BL_NOW_MS + 9000);
    T::same('2026-10-28T10:00:00Z', $u['post']['date'], 'volver a publicar conserva la fecha');
}

/** B5 · La dirección es única POR IDIOMA: repetida en el mismo idioma da 409; en otro idioma vale; las inválidas se rechazan; vacía se deriva del título. */
function test_blog_slug_unique_per_language()
{
    fresh();
    $a = bl_make(['slug' => 'toroidal']);
    $r = Blog::create(bl_post(['slug' => 'toroidal']), 'j', BL_NOW_MS);
    T::same([409, 'exists', 'slug'], [$r['status'] ?? 0, $r['code'] ?? '', $r['field'] ?? ''], 'repetida en el mismo idioma');
    $en = bl_make(['lang' => 'en', 'slug' => 'toroidal', 'title' => 'Toroidal']);
    T::same('/en/blog/toroidal/', Blog::path($en['lang'], $en['slug']), 'misma dirección en inglés');
    $d = bl_make(['title' => 'Año nuevo: ¿qué ñoño?', 'slug' => '']);
    T::same('ano-nuevo-que-nono', $d['slug'], 'dirección derivada del título');
    foreach (['Mayúsculas' => 'mayusculas', 'con espacios' => 'con-espacios', 'barra/x' => 'barra-x', '-guion1' => 'guion1', 'guion2-' => 'guion2', str_repeat('a', 81) => str_repeat('a', 80)] as $in => $want) {
        $r = Blog::create(bl_post(['slug' => $in, 'title' => 'T ' . $want]), 'j', BL_NOW_MS);
        T::same($want, $r['post']['slug'] ?? ('error: ' . ($r['error'] ?? '')), 'la dirección «' . substr($in, 0, 20) . '» se normaliza');
    }
    foreach (['ab', '--', '', 'ñ'] as $in) {
        $r = Blog::create(bl_post(['slug' => $in, 'title' => '']), 'j', BL_NOW_MS);
        T::true(isset($r['error']), 'sin título y con dirección «' . $in . '» no se crea');
        $r = Blog::create(bl_post(['slug' => $in, 'title' => $in === '' ? '12' : 'ab']), 'j', BL_NOW_MS);
        T::same('slug', $r['field'] ?? 'ninguno', 'dirección demasiado corta o vacía tras limpiarla: «' . $in . '»');
    }
    T::true(Blog::resolve('es', 'toroidal')['id'] === $a['id'], 'resolve encuentra la entrada');
    T::same(null, Blog::resolve('fr', 'toroidal'), 'y no en otro idioma');
    T::same(null, Blog::resolve('es', '../etc'), 'dirección con barras: nada');
    T::same(null, Blog::resolve('es', 'x'), 'dirección demasiado corta: nada');
}

/** B6 · Cambiar la dirección de una entrada ya publicada deja la antigua como redirección; la de un borrador nunca publicado se libera; no se puede coger la dirección antigua de otra entrada. */
function test_blog_slug_change_keeps_redirects_for_published_posts()
{
    fresh();
    $a = bl_make(['slug' => 'primera', 'status' => 'published']);
    $u = Blog::update($a['id'], ['slug' => 'segunda'], 'j', BL_NOW_MS + 1000);
    T::same(['segunda', ['primera']], [$u['post']['slug'], $u['post']['old_slugs']], 'la antigua se recuerda');
    T::same(['id' => $a['id'], 'alias' => false], Blog::resolve('es', 'segunda'), 'la nueva es la buena');
    T::same(['id' => $a['id'], 'alias' => true], Blog::resolve('es', 'primera'), 'la antigua es un alias (redirige)');
    $b = bl_make(['title' => 'Otra', 'slug' => 'tercera']);
    $r = Blog::update($b['id'], ['slug' => 'primera'], 'j', BL_NOW_MS + 2000);
    T::same([409, 'slug'], [$r['status'] ?? 0, $r['field'] ?? ''], 'la dirección antigua de otra entrada está ocupada');
    $r = Blog::update($b['id'], ['slug' => 'cuarta'], 'j', BL_NOW_MS + 3000);
    T::same(null, Blog::resolve('es', 'tercera'), 'un borrador nunca publicado libera su dirección antigua');
    T::same(['cuarta', []], [$r['post']['slug'], $r['post']['old_slugs']], 'y no deja redirección');
    $u = Blog::update($a['id'], ['slug' => 'primera'], 'j', BL_NOW_MS + 4000);
    T::same(['primera', ['segunda']], [$u['post']['slug'], $u['post']['old_slugs']], 'volver a una dirección antigua propia: vale y la que se deja pasa a ser alias');
    T::same(['id' => $a['id'], 'alias' => false], Blog::resolve('es', 'primera'), 'ya no es alias');
    $u = Blog::update($a['id'], ['slug' => ''], 'j', BL_NOW_MS + 5000);
    T::same('primera', $u['post']['slug'], 'una dirección vacía al actualizar deja la que hay');
}

/** B7 · Actualizar cambia solo los campos enviados, no deja cambiar el idioma y responde 404 si no existe. */
function test_blog_update_is_partial()
{
    fresh();
    $a = bl_make(['excerpt' => 'Resumen', 'seo_title' => 'Título SEO']);
    $u = Blog::update($a['id'], ['title' => 'Nuevo título'], 'otra@torivac.test', BL_NOW_MS + 60000);
    T::same(['Nuevo título', 'Resumen', 'Título SEO', $a['markdown'], 'otra@torivac.test', '2026-10-28T10:01:00Z', '2026-10-28T10:00:00Z'], [$u['post']['title'], $u['post']['excerpt'], $u['post']['seo_title'], $u['post']['markdown'], $u['post']['by'], $u['post']['updated'], $u['post']['created']], 'solo cambia lo enviado');
    T::same('Nuevo título', Blog::index('es')[$a['id']]['title'], 'el resumen del listado se actualiza');
    $u = Blog::update($a['id'], ['excerpt' => ''], 'j', BL_NOW_MS);
    T::same('', $u['post']['excerpt'], 'se puede vaciar un campo');
    $r = Blog::update($a['id'], ['lang' => 'en'], 'j', BL_NOW_MS);
    T::same(['invalid', 'lang'], [$r['code'] ?? '', $r['field'] ?? ''], 'el idioma no se cambia');
    $r = Blog::update('bp-000000000000', ['title' => 'x'], 'j', BL_NOW_MS);
    T::same([404, 'not_found'], [$r['status'] ?? 0, $r['code'] ?? ''], 'no existe');
    $r = Blog::update($a['id'], ['status' => 'published', 'markdown' => ''], 'j', BL_NOW_MS);
    T::same('markdown', $r['field'] ?? '', 'publicar con el texto vacío no vale');
    T::same('draft', Blog::get($a['id'])['status'], 'y no cambia nada');
}

/** B8 · Traducciones: se enlazan por pares y en grupo, son simétricas, se desenlazan, no se repiten por idioma ni se enlazan con sí mismas, y borrar una no borra las demás. */
function test_blog_translations_link_unlink_and_conflicts()
{
    fresh();
    $es = bl_make(['slug' => 'toroidal', 'status' => 'published']);
    $en = bl_make(['lang' => 'en', 'slug' => 'toroidal', 'title' => 'Toroidal', 'status' => 'published']);
    $fr = bl_make(['lang' => 'fr', 'slug' => 'toroidal', 'title' => 'Tore', 'status' => 'published']);
    $r = Blog::update($es['id'], ['translations' => ['en' => $en['id']]], 'j', BL_NOW_MS);
    T::true(isset($r['post']), 'enlazar es-en: ' . ($r['error'] ?? ''));
    $now = BL_NOW_MS / 1000;
    T::same(['en'], array_keys(Blog::translationsOf(Blog::index('es')[$es['id']], true, $now)), 'es ve a en');
    T::same(['es'], array_keys(Blog::translationsOf(Blog::index('en')[$en['id']], true, $now)), 'en ve a es (simétrico)');
    $r = Blog::update($fr['id'], ['translations' => ['es' => $es['id']]], 'j', BL_NOW_MS);
    T::true(isset($r['post']), 'enlazar fr-es: ' . ($r['error'] ?? ''));
    T::same(['en', 'fr'], array_keys(Blog::translationsOf(Blog::index('es')[$es['id']], true, $now)), 'es ve a en y fr');
    T::same(['es', 'fr'], array_keys(Blog::translationsOf(Blog::index('en')[$en['id']], true, $now)), 'en y fr también se ven entre sí (mismo grupo)');
    $es2 = bl_make(['slug' => 'toroidal-bis', 'title' => 'Otra']);
    $r = Blog::update($es2['id'], ['translations' => ['en' => $en['id']]], 'j', BL_NOW_MS);
    T::same([409, 'translations'], [$r['status'] ?? 0, $r['field'] ?? ''], 'una entrada que ya tiene otras traducciones no se coge');
    $r = Blog::update($es['id'], ['translations' => ['es' => $es['id']]], 'j', BL_NOW_MS);
    T::same('translations', $r['field'] ?? '', 'no se enlaza con su propio idioma');
    $r = Blog::update($es['id'], ['translations' => ['en' => $fr['id']]], 'j', BL_NOW_MS);
    T::same('translations', $r['field'] ?? '', 'la traducción tiene que estar en ese idioma');
    $r = Blog::update($es['id'], ['translations' => ['de' => 'bp-ffffffffffff']], 'j', BL_NOW_MS);
    T::same('translations', $r['field'] ?? '', 'no existe');
    $r = Blog::update($es['id'], ['translations' => ['en' => '']], 'j', BL_NOW_MS);
    T::same(['fr'], array_keys(Blog::translationsOf(Blog::index('es')[$es['id']], true, $now)), 'desenlazar en deja fr');
    T::same([], Blog::translationsOf(Blog::index('en')[$en['id']], true, $now), 'en se queda sola');
    // un borrador no cuenta como traducción visible; borrar una entrada no borra las demás
    $de = bl_make(['lang' => 'de', 'slug' => 'ringkern', 'title' => 'Ringkern']);
    Blog::update($es['id'], ['translations' => ['de' => $de['id']]], 'j', BL_NOW_MS);
    T::same(['fr'], array_keys(Blog::translationsOf(Blog::index('es')[$es['id']], true, $now)), 'el borrador en alemán no se ofrece al público');
    T::same(['fr', 'de'], array_keys(Blog::translationsOf(Blog::index('es')[$es['id']], false, $now)), 'pero el panel sí lo ve');
    T::true(Blog::delete($fr['id']), 'borrar fr');
    T::same(['de'], array_keys(Blog::translationsOf(Blog::index('es')[$es['id']], false, $now)), 'las demás siguen enlazadas');
}

/** B9 · Borrar quita la entrada, su dirección (y las antiguas) y su resumen; la dirección vuelve a estar libre. */
function test_blog_delete_frees_everything()
{
    fresh();
    $a = bl_make(['slug' => 'uno', 'status' => 'published']);
    Blog::update($a['id'], ['slug' => 'dos'], 'j', BL_NOW_MS + 1);
    T::true(Blog::delete($a['id']), 'se borra');
    T::same([null, null, null, []], [Blog::get($a['id']), Blog::resolve('es', 'uno'), Blog::resolve('es', 'dos'), Blog::index('es')], 'no queda nada');
    T::true(!Blog::delete($a['id']), 'borrar otra vez: no existía');
    T::true(!Blog::delete('no-es-un-id'), 'un id con otra forma no toca nada');
    $b = bl_make(['slug' => 'uno']);
    T::same('uno', $b['slug'], 'la dirección vuelve a estar libre');
}

/** B10 · El resumen se reconstruye solo (y a mano) si falta, sin quedarse esperando a sí mismo por el bloqueo. */
function test_blog_index_rebuilds_without_deadlock()
{
    fresh();
    $a = bl_make(['slug' => 'uno', 'status' => 'published']);
    $en = bl_make(['lang' => 'en', 'slug' => 'one', 'title' => 'One']);
    Store::delete('blog:ix:es'); Store::delete('blog:ix:en');
    $t = microtime(true);
    $b = bl_make(['slug' => 'dos', 'title' => 'Dos']);                                       // crear con el resumen perdido: reconstruye dentro del bloqueo
    T::true(microtime(true) - $t < 3, 'sin esperas');
    T::same([$b['id'], $a['id']], array_values(array_unique(array_merge([$b['id']], array_keys(Blog::index('es'))))) === [$b['id'], $a['id']] ? [$b['id'], $a['id']] : array_keys(Blog::index('es')), 'las dos entradas están');
    T::same(2, count(Blog::index('es')), 'dos entradas en español');
    Store::delete('blog:ix:fr'); Store::delete('blog:ix:de');
    T::same(3, Blog::reindex(), 'reindex cuenta las entradas');
    T::same([1, 0, 0], [count(Blog::index('en')), count(Blog::index('fr')), count(Blog::index('de'))], 'cada idioma con las suyas');
    $x = array_keys(Blog::index('en'))[0];
    T::same($en['id'], $x, 'la de inglés');
}

/** B11 · Imágenes: JPEG, PNG y WebP de verdad se aceptan, se nombran por su contenido y la misma imagen no se guarda dos veces; lo demás (GIF, SVG, PHP, texto con extensión de imagen, truncadas, enormes) se rechaza. */
function test_blog_images_accept_real_images_only()
{
    fresh();
    foreach (['png' => 'image/png', 'jpg' => 'image/jpeg', 'webp' => 'image/webp'] as $ext => $mime) {
        $r = Blog::saveImage('Mi Foto.' . $ext, bl_img($ext), 'j', BL_NOW_MS);
        T::true(isset($r['image']), "$ext: " . ($r['error'] ?? ''));
        $im = $r['image'];
        T::true(preg_match(Blog::MEDIA_RE, $im['file']) === 1 && strpos($im['file'], 'mi-foto-') === 0 && substr($im['file'], -strlen($ext) - 1) === '.' . $ext, "$ext: nombre {$im['file']}");
        T::same([$mime, 1, 1, '/media/blog/' . $im['file']], [$im['mime'], $im['w'], $im['h'], $im['url']], "$ext: datos");
        T::same(bl_img($ext), (string) file_get_contents(Blog::mediaDir() . '/' . $im['file']), "$ext: los bytes se guardan tal cual");
        $again = Blog::saveImage('otro nombre', bl_img($ext), 'j', BL_NOW_MS + 1000);
        T::same($im['file'], $again['image']['file'], "$ext: la misma imagen no se guarda dos veces");
    }
    T::same(3, count(Blog::images()), 'tres imágenes');
    $bad = ['GIF' => "GIF89a\x01\x00\x01\x00\x00\x00\x00;", 'SVG' => '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>', 'PHP' => "<?php echo 'x';", 'texto como imagen' => str_repeat('hola ', 100), 'PNG truncado' => substr(bl_img('png'), 0, 20),
        'JPEG con PHP detrás' => '<?php system($_GET[0]); ?>', 'vacía' => ''];
    foreach ($bad as $name => $bytes) {
        $r = Blog::saveImage('x.png', $bytes, 'j', BL_NOW_MS);
        T::same(['image', 400], [$r['code'] ?? 'ok', $r['status'] ?? 0], "$name se rechaza");
    }
    $r = Blog::saveImage('grande.png', bl_png_dims(6001, 10), 'j', BL_NOW_MS);
    T::same('image', $r['code'] ?? '', 'más de 6000 px por lado');
    $r = Blog::saveImage('grande.png', bl_png_dims(5000, 5000), 'j', BL_NOW_MS);
    T::same('image', $r['code'] ?? '', 'más de 24 millones de píxeles');
    $r = Blog::saveImage('pesada.png', bl_img('png') . str_repeat("\0", Blog::MAX_IMAGE_BYTES), 'j', BL_NOW_MS);
    T::same('image', $r['code'] ?? '', 'pesa demasiado');
    foreach (glob(Blog::mediaDir() . '/*') ?: [] as $f) T::true(preg_match(Blog::MEDIA_RE, basename($f)) === 1, 'solo hay archivos con nombre válido: ' . basename($f));
}

/** B12 · La imagen de una entrada necesita estar subida y llevar texto alternativo; no se puede borrar mientras se use (en la imagen destacada o en el texto). */
function test_blog_post_image_needs_alt_and_cannot_be_deleted_while_used()
{
    fresh();
    $im = Blog::saveImage('toroidal', bl_img('webp'), 'j', BL_NOW_MS)['image'];
    $r = Blog::create(bl_post(['image' => ['file' => $im['file'], 'alt' => '']]), 'j', BL_NOW_MS);
    T::same(['required', 'image_alt'], [$r['code'] ?? '', $r['field'] ?? ''], 'sin texto alternativo');
    $r = Blog::create(bl_post(['image' => ['file' => $im['file'], 'alt' => str_repeat('a', 201)]]), 'j', BL_NOW_MS);
    T::same('image_alt', $r['field'] ?? '', 'texto alternativo demasiado largo');
    $p = bl_make(['image' => ['file' => $im['file'], 'alt' => 'Transformador toroidal de 300 VA sobre fondo gris']]);
    T::same([$im['file'], 'Transformador toroidal de 300 VA sobre fondo gris', 1, 1], [$p['image']['file'], $p['image']['alt'], $p['image']['w'], $p['image']['h']], 'se guarda con sus medidas');
    T::same($p['image'], Blog::index('es')[$p['id']]['image'], 'el listado la lleva');
    $d = Blog::deleteImage($im['file']);
    T::same([409, 'in_use'], [$d['status'] ?? 0, $d['code'] ?? ''], 'en uso: no se borra');
    Blog::update($p['id'], ['image' => null], 'j', BL_NOW_MS);
    $q = bl_make(['title' => 'Con imagen en el texto', 'slug' => 'con-imagen', 'markdown' => "Mira:\n\n![Toroidal](/media/blog/{$im['file']})"]);
    T::same(409, Blog::deleteImage($im['file'])['status'] ?? 0, 'usada dentro del texto: tampoco');
    Blog::delete($q['id']);
    T::same(true, Blog::deleteImage($im['file'])['ok'] ?? false, 'sin uso: se borra');
    T::same([null, false], [Blog::mediaMeta($im['file']), is_file(Blog::mediaDir() . '/' . $im['file'])], 'sin datos y sin archivo');
    T::same(404, Blog::deleteImage($im['file'])['status'] ?? 0, 'otra vez: no existe');
    T::same(null, Blog::mediaMeta('../../config.php'), 'un nombre con barras no se toca');
}

/** B13 · La vista previa lleva una firma que solo vale para esa entrada, caduca y no se puede falsear. */
function test_blog_preview_token()
{
    fresh();
    $id = 'bp-0123456789ab';
    $t = Blog::previewToken($id, 3600, 1000000000);
    T::true(Blog::verifyPreview($id, $t, 1000000000), 'vale');
    T::true(Blog::verifyPreview($id, $t, 1000003600), 'vale hasta el último segundo');
    T::true(!Blog::verifyPreview($id, $t, 1000003601), 'caduca');
    T::true(!Blog::verifyPreview('bp-ffffffffffff', $t, 1000000000), 'no vale para otra entrada');
    [$exp, $mac] = explode('.', $t);
    T::true(!Blog::verifyPreview($id, ($exp + 99999) . '.' . $mac, 1000000000), 'cambiar la caducidad la invalida');
    T::true(!Blog::verifyPreview($id, $exp . '.' . strrev($mac), 1000000000), 'cambiar la firma la invalida');
    foreach (['', '1.2', 'abc', null, 5, str_repeat('a', 300)] as $junk) T::true(!Blog::verifyPreview($id, $junk, 1000000000), 'basura: ' . json_encode($junk));
    \Torivac\Config::set(['session_secret' => 'corto']);
    T::same(null, Blog::previewToken($id, 3600, 1000000000), 'sin session_secret válido no hay firma');
    T::true(!Blog::verifyPreview($id, $t, 1000000000), 'ni se acepta');
}

/** B14 · El API: sin sesión 401, cliente 403, manager y token maestro entran; crear (201), leer, actualizar, borrar y los errores con su código y campo. */
function test_blog_api_roles_and_crud()
{
    fresh(); [$tj, $tc] = bl_tokens();
    T::same(401, bl_api('GET', '/blog/posts', null, null)->status, 'sin sesión');
    T::same(403, bl_api('GET', '/blog/posts', null, $tc)->status, 'un cliente no entra');
    T::same(403, bl_api('POST', '/blog/posts', bl_post(), $tc)->status, 'un cliente no crea');
    T::same(403, bl_api('POST', '/blog/images', ['name' => 'x', 'data' => base64_encode(bl_img())], $tc)->status, 'un cliente no sube imágenes');
    T::same(200, Router::handle(req('GET', '/blog/posts', null, master()))->status, 'el token maestro entra');
    $r = bl_api('POST', '/blog/posts', bl_post(['status' => 'published']), $tj);
    T::same(201, $r->status, 'crear');
    $post = $r->body['post'];
    T::same([true, '/blog/como-elegir-un-transformador-toroidal/', 'jefa@torivac.test'], [$post['live'], $post['path'], $post['by']], 'la respuesta lleva ruta, si se ve y quién');
    $l = bl_api('GET', '/blog/posts', null, $tj);
    T::same([1, true], [count($l->body['posts']), isset($l->body['now'], $l->body['limits'])], 'listado con hora del servidor y límites');
    T::same(['title', 'excerpt', 'seo_title', 'seo_description', 'alt', 'markdown', 'slug', 'posts', 'image_bytes', 'image_side'], array_keys($l->body['limits']), 'límites que enseña el panel');
    T::same($post['id'], bl_api('GET', '/blog/posts/' . $post['id'], null, $tj)->body['post']['id'], 'leer una');
    T::same(404, bl_api('GET', '/blog/posts/bp-000000000000', null, $tj)->status, 'leer una que no existe');
    T::same(404, bl_api('GET', '/blog/posts/otra-cosa', null, $tj)->status, 'id con otra forma: no encontrado');
    $u = bl_api('POST', '/blog/posts/' . $post['id'], ['title' => 'Título nuevo'], $tj);
    T::same([200, 'Título nuevo'], [$u->status, $u->body['post']['title']], 'actualizar');
    $e = bl_api('POST', '/blog/posts', bl_post(['slug' => $post['slug']]), $tj);
    T::same([409, 'exists', 'slug', false], [$e->status, $e->body['code'], $e->body['field'], $e->body['ok']], 'dirección repetida: 409 con código y campo');
    $e = bl_api('POST', '/blog/posts', bl_post(['title' => '']), $tj);
    T::same([400, 'required', 'title'], [$e->status, $e->body['code'], $e->body['field']], 'título vacío: 400');
    T::same(400, bl_api('POST', '/blog/posts', '[1,2]', $tj)->status, 'una lista no vale');
    T::same(400, bl_api('POST', '/blog/posts', 'no es json', $tj)->status, 'ni basura');
    T::same(400, bl_api('POST', '/blog/posts', bl_post(['markdown' => str_repeat('a', 700000)]), $tj)->status, 'ni un cuerpo enorme');
    T::same(200, bl_api('DELETE', '/blog/posts/' . $post['id'], null, $tj)->status, 'borrar');
    T::same(404, bl_api('DELETE', '/blog/posts/' . $post['id'], null, $tj)->status, 'borrar otra vez');
    T::same(404, bl_api('GET', '/blog/nada', null, $tj)->status, 'ruta desconocida');
    T::same(404, bl_api('PUT', '/blog/posts', null, $tj)->status, 'método no admitido');
}

/** B15 · API de imágenes: subir en base64 (con o sin prefijo data:), listar, borrar; rechaza lo que no es una imagen y lo que no es base64; la vista previa y el reindex funcionan. */
function test_blog_api_images_preview_and_reindex()
{
    fresh(); [$tj] = bl_tokens();
    $up = bl_api('POST', '/blog/images', ['name' => 'Mi toroidal.jpg', 'data' => 'data:image/jpeg;base64,' . base64_encode(bl_img('jpg'))], $tj);
    T::same(201, $up->status, 'subir con prefijo data:');
    $file = $up->body['image']['file'];
    T::same(201, bl_api('POST', '/blog/images', ['name' => 'otra', 'data' => base64_encode(bl_img('png'))], $tj)->status, 'subir sin prefijo');
    T::same(400, bl_api('POST', '/blog/images', ['name' => 'x', 'data' => '***no es base64***'], $tj)->status, 'base64 roto');
    T::same(400, bl_api('POST', '/blog/images', ['name' => 'x', 'data' => base64_encode('<?php echo 1;')], $tj)->status, 'no es una imagen');
    T::same(400, bl_api('POST', '/blog/images', ['name' => 'x'], $tj)->status, 'sin datos');
    T::same(2, count(bl_api('GET', '/blog/images', null, $tj)->body['images']), 'listado');
    $p = bl_api('POST', '/blog/posts', bl_post(['image' => ['file' => $file, 'alt' => 'Foto']]), $tj)->body['post'];
    T::same(409, bl_api('DELETE', '/blog/images/' . $file, null, $tj)->status, 'en uso: 409');
    T::same(404, bl_api('DELETE', '/blog/images/otra-cosa.jpg', null, $tj)->status, 'nombre que no existe');
    $pv = bl_api('POST', '/blog/posts/' . $p['id'] . '/preview', null, $tj);
    T::same([200, $p['path']], [$pv->status, $pv->body['path']], 'vista previa: ruta');
    T::true(preg_match('/^tvp=' . $p['id'] . '\.\d{10}\.[0-9a-f]{64}$/', $pv->body['query']) === 1, 'vista previa: parámetro firmado');
    [, $tok] = explode('=', $pv->body['query'], 2);
    T::true(Blog::verifyPreview($p['id'], substr($tok, strlen($p['id']) + 1)), 'la firma vale para esa entrada');
    T::same(404, bl_api('POST', '/blog/posts/bp-000000000000/preview', null, $tj)->status, 'vista previa de una que no existe');
    Store::delete('blog:ix:es');
    T::same([200, 1], [bl_api('POST', '/blog/reindex', null, $tj)->status, bl_api('POST', '/blog/reindex', null, $tj)->body['posts']], 'reindex');
    T::same(1, count(bl_api('GET', '/blog/posts', null, $tj)->body['posts']), 'y el listado vuelve');
    $h = Router::handle(req('GET', '/health'));
    T::same(true, $h->body['features']['blog'] ?? false, 'el estado del servidor dice que tiene blog');
}

/** B16 · Límites por hora: guardados y subidas se cortan con 429 sin dejar entradas a medias. */
function test_blog_api_rate_limits()
{
    fresh(); [$tj] = bl_tokens();
    \Torivac\RateLimit::hit('blogimg', 'jefa@torivac.test', 1, 3600000);
    for ($i = 0; $i < \Torivac\BlogApi::UPLOADS_PER_HOUR; $i++) \Torivac\RateLimit::hit('blogimg', 'jefa@torivac.test', \Torivac\BlogApi::UPLOADS_PER_HOUR, 3600000);
    T::same(429, bl_api('POST', '/blog/images', ['name' => 'x', 'data' => base64_encode(bl_img())], $tj)->status, 'demasiadas subidas');
    for ($i = 0; $i < \Torivac\BlogApi::SAVES_PER_HOUR; $i++) \Torivac\RateLimit::hit('blogsave', 'jefa@torivac.test', \Torivac\BlogApi::SAVES_PER_HOUR, 3600000);
    T::same(429, bl_api('POST', '/blog/posts', bl_post(), $tj)->status, 'demasiados guardados');
    T::same([], Blog::listing(), 'no se guardó nada');
}

/** B17 · Tope de entradas: al llegar al máximo no se crean más (409) hasta borrar alguna. */
function test_blog_post_limit()
{
    fresh();
    $ix = [];
    for ($i = 0; $i < Blog::MAX_POSTS; $i++) $ix['bp-' . sprintf('%012x', $i)] = ['id' => 'bp-' . sprintf('%012x', $i), 'grp' => 'g', 'lang' => 'es', 'slug' => 's' . $i, 'title' => 't', 'excerpt' => '', 'status' => 'draft', 'date' => null, 'updated' => 'x', 'image' => null, 'path' => '/'];
    Store::put('blog:ix:es', (object) $ix);
    $r = Blog::create(bl_post(), 'j', BL_NOW_MS);
    T::same([409, 'limit'], [$r['status'] ?? 0, $r['code'] ?? ''], 'tope alcanzado');
}
