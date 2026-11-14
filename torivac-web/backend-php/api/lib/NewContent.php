<?php
/**
 * [NEWCONTENT] Páginas nuevas del plan 2027 en el panel («Contenido nuevo»): ver los borradores, proponer cambios, aprobar y dejar el registro de cambios. SOLO texto plano.
 * Roles: `manager` ve, propone y descarga; `reviewer` (el «Revisor», una sola persona que es a la vez comercial y traductora) además decide las propuestas y APRUEBA o retira la aprobación.
 * La web es estática: nada de esto publica por sí solo. Lo aprobado se descarga (GET /newcontent/export) y `scripts/apply_newcontent.mjs` lo anota en data/content-new/*.json;
 * la siguiente compilación publica solo lo aprobado (site/lib/newcontent.mjs).
 *
 * Datos:
 *   · generated/newcontent.json (lo escribe site/build.mjs): { pages: [ {id, kind, slug, notes, history, langs:{ idioma:{status, approval?, title, meta_description, h1, lead, sections, cta} }} ] } = lo que dicen los archivos.
 *   · clave newcontent:<id> (la escribe este módulo): { langs:{ idioma:{ edit?, base, approval?, proposals[] } }, log[] } = lo hecho en el panel desde la última vez que se anotó en los archivos.
 *   El texto vigente es el del archivo salvo una edición aceptada hecha sobre ESE mismo texto (`base` = su huella); si el archivo cambió después, se ignora la edición. Una aprobación guarda la huella del texto
 *   que se aprobó (`th`): si el texto cambia, deja de valer (y al aceptar una propuesta se retira expresamente y queda en el registro).
 * Reglas: el castellano se aprueba primero (función «comercial»); EN, FR y DE después (función «traductor»); se aprueba un texto que pasa las mismas comprobaciones que el generador
 * (título ≤ 65, descripción 50–160, texto plano, enlaces / o https://).
 *
 *   GET  /api/newcontent                                   páginas, su estado por idioma, propuestas pendientes y registro (managers y revisor)
 *   POST /api/newcontent/:id/:idioma/propose               { title?, meta_description?, h1?, lead?, sections?, cta?, note } → propuesta (managers y revisor)
 *   POST /api/newcontent/:id/:idioma/proposals/:pid        { decision: accept|reject, note? } → decide una propuesta (solo revisor)
 *   POST /api/newcontent/:id/:idioma/approve               aprueba el texto vigente (solo revisor)
 *   POST /api/newcontent/:id/:idioma/withdraw              retira la aprobación (solo revisor)
 *   GET  /api/newcontent/export                            lo que hay que anotar en los archivos (solo managers)
 */
namespace Torivac;

final class NewContent
{
    const LANGS = ['es', 'en', 'fr', 'de'];
    /** Función con la que se aprueba cada idioma. */
    const FUNCTION = ['es' => 'comercial', 'en' => 'traductor', 'fr' => 'traductor', 'de' => 'traductor'];
    /** Límites de los textos (caracteres) y de las listas. */
    const MAX_TITLE = 65, META_MIN = 50, META_MAX = 160, MAX_H = 120, MAX_LEAD = 600, MAX_P = 1500, MAX_NOTE = 400, MAX_LABEL = 60, MAX_HREF = 200, MAX_SECTIONS = 12, MAX_PARAS = 8, MAX_CTA = 3;
    /** Propuestas pendientes por idioma, propuestas ya decididas que se conservan y entradas del registro por página. */
    const MAX_PENDING = 20, KEEP_DECIDED = 30, MAX_LOG = 300;
    /** Peticiones de escritura por hora y persona. */
    const WRITES_PER_HOUR = 200;

    /** Fichero alternativo (pruebas); null = generated/newcontent.json. */
    private static $file = null;

    /** Cambia el fichero de páginas que se lee (pruebas); null vuelve al de generated/. */
    public static function setFile(?string $file): void { self::$file = $file; }

    // ───────────────────────────────────────── [DATOS] lo que dicen los archivos + lo hecho en el panel
    /** Páginas del archivo (id → página), tal como las escribió el build; vacío si falta o está dañado. */
    public static function baked(): array
    {
        $f = self::$file ?? (__DIR__ . '/../generated/newcontent.json');
        $j = is_file($f) ? json_decode((string) @file_get_contents($f), true, 64) : null;
        $out = [];
        foreach ((is_array($j) && isset($j['pages']) && is_array($j['pages']) ? $j['pages'] : []) as $p) {
            if (is_array($p) && isset($p['id']) && is_string($p['id']) && preg_match('/^[a-z0-9-]{1,60}$/D', $p['id']) === 1) $out[$p['id']] = $p;
        }
        return $out;
    }

    /** Lo hecho en el panel sobre una página (vacío si nada). */
    private static function state(string $id): array
    {
        $s = Store::get('newcontent:' . $id);
        return is_array($s) ? $s : ['langs' => [], 'log' => []];
    }

    /** Texto de una versión en su forma canónica (campos y orden fijos), para compararlo y sacarle la huella. */
    public static function canon(array $v): array
    {
        $sections = [];
        foreach ((array) ($v['sections'] ?? []) as $s) {
            if (!is_array($s)) continue;
            $sections[] = ['h2' => (string) ($s['h2'] ?? ''), 'p' => array_values(array_map('strval', array_filter((array) ($s['p'] ?? []), 'is_scalar')))];
        }
        $cta = [];
        foreach ((array) ($v['cta'] ?? []) as $c) { if (is_array($c)) $cta[] = ['label' => (string) ($c['label'] ?? ''), 'href' => (string) ($c['href'] ?? '')]; }
        return ['title' => (string) ($v['title'] ?? ''), 'meta_description' => (string) ($v['meta_description'] ?? ''), 'h1' => (string) ($v['h1'] ?? ''), 'lead' => (string) ($v['lead'] ?? ''), 'sections' => $sections, 'cta' => $cta];
    }

    /** Huella del texto (16 caracteres): mismo texto, misma huella. */
    public static function hash(array $text): string { return substr(hash('sha256', Util::enc(self::canon($text))), 0, 16); }

    /**
     * Estado de un idioma: texto vigente, aprobación válida, propuestas y avisos. Función pura de (archivo, panel).
     * @return array<string,mixed>
     */
    private static function langView(string $lang, array $base, array $st): array
    {
        $baseText = self::canon($base);
        $text = $baseText;
        $edited = false;
        $stale = false;
        if (isset($st['edit']) && is_array($st['edit'])) {
            $he = self::hash($st['edit']);
            if ($he === self::hash($baseText)) { /* ya anotada en el archivo */ }
            elseif (($st['base'] ?? '') === self::hash($baseText)) { $text = self::canon($st['edit']); $edited = true; }
            else $stale = true;                                                          // el archivo cambió después de esa edición: manda el archivo
        }
        $ap = array_key_exists('approval', $st) ? $st['approval'] : (($base['status'] ?? '') === 'aprobado' && is_array($base['approval'] ?? null) ? $base['approval'] : null);
        $outdated = false;
        if (is_array($ap) && isset($ap['th']) && $ap['th'] !== self::hash($text)) { $ap = null; $outdated = true; }
        if (is_array($ap)) $ap = array_intersect_key($ap, array_flip(['by', 'email', 'role', 'at']));
        $props = [];
        foreach ((array) ($st['proposals'] ?? []) as $p) if (is_array($p)) $props[] = $p;
        return ['status' => is_array($ap) ? 'aprobado' : 'borrador', 'approval' => $ap, 'text' => $text, 'edited' => $edited, 'stale_edit' => $stale, 'approval_outdated' => $outdated, 'hash' => self::hash($text), 'proposals' => array_values($props)];
    }

    /** Una página con el estado efectivo de cada idioma que tiene, y su registro (archivo + panel, el más reciente primero). */
    private static function pageView(array $page): array
    {
        $st = self::state($page['id']);
        $langs = [];
        foreach (self::LANGS as $l) {
            if (!isset($page['langs'][$l]) || !is_array($page['langs'][$l])) continue;
            $langs[$l] = self::langView($l, $page['langs'][$l], (array) ($st['langs'][$l] ?? []));
        }
        $log = [];
        $seen = [];
        foreach (array_merge((array) ($page['history'] ?? []), (array) ($st['log'] ?? [])) as $e) {
            if (!is_array($e) || !isset($e['id']) || isset($seen[$e['id']])) continue;
            $seen[$e['id']] = 1;
            $log[] = $e;
        }
        usort($log, function ($a, $b) { return strcmp((string) ($b['at'] ?? ''), (string) ($a['at'] ?? '')); });
        foreach ($langs as $l => &$v) { $why = self::approvalProblem($page, $langs, $l); $v['can_approve'] = $why === null && $v['status'] !== 'aprobado'; $v['approve_problem'] = $why; }
        unset($v);
        return ['id' => $page['id'], 'kind' => (string) ($page['kind'] ?? 'landing'), 'slug' => (object) (array) ($page['slug'] ?? []), 'notes' => array_values((array) ($page['notes'] ?? [])), 'langs' => $langs, 'log' => array_slice($log, 0, 100)];
    }

    /** Por qué NO se puede aprobar ese idioma ahora (texto) o null si se puede. */
    private static function approvalProblem(array $page, array $langs, string $lang): ?string
    {
        if (!isset($langs[$lang])) return 'Ese idioma no existe en la página';
        $e = self::validate($langs[$lang]['text']);
        if ($e) return 'El texto no cumple las reglas: ' . $e[0];
        if ($lang !== 'es' && (($langs['es']['status'] ?? '') !== 'aprobado')) return 'Primero hay que aprobar el castellano: las traducciones se aprueban después';
        return null;
    }

    // ───────────────────────────────────────── [VALIDAR] las mismas reglas que el generador (site/lib/newcontent.mjs) y texto plano
    /** Una cadena de texto plano de una línea o varias; devuelve ['text'|'error']. */
    private static function plain($v, int $max, string $field, bool $multi = false): array
    {
        if (!is_string($v)) return ['error' => 'El campo «' . $field . '» debe ser texto'];
        $r = PlainText::check($v, $max, $multi);
        if (!$r['ok']) return ['error' => $r['code'] === 'too_long' ? 'El campo «' . $field . '» pasa de ' . $max . ' caracteres' : 'El campo «' . $field . '» solo admite texto plano (sin etiquetas ni código)'];
        if ($r['text'] === '' ) return ['error' => 'El campo «' . $field . '» no puede quedar vacío'];
        if (preg_match('/[<>]/', $r['text'])) return ['error' => 'El campo «' . $field . '» no admite < ni >'];
        return ['text' => $r['text']];
    }

    /** Problemas (lista de textos) de un texto completo; vacío si está bien. */
    public static function validate(array $t): array
    {
        $t = self::canon($t);
        $e = [];
        if ($t['title'] === '' || mb_strlen($t['title'], 'UTF-8') > self::MAX_TITLE) $e[] = 'El título debe tener entre 1 y ' . self::MAX_TITLE . ' caracteres';
        $m = mb_strlen($t['meta_description'], 'UTF-8');
        if ($m < self::META_MIN || $m > self::META_MAX) $e[] = 'La descripción debe tener entre ' . self::META_MIN . ' y ' . self::META_MAX . ' caracteres (tiene ' . $m . ')';
        if ($t['h1'] === '') $e[] = 'Falta el título principal (H1)';
        if (!$t['sections']) $e[] = 'Falta al menos una sección';
        foreach ($t['sections'] as $i => $s) {
            if ($s['h2'] === '') $e[] = 'La sección ' . ($i + 1) . ' no tiene encabezado';
            if (!$s['p']) $e[] = 'La sección ' . ($i + 1) . ' no tiene párrafos';
            foreach ($s['p'] as $p) if (trim($p) === '') $e[] = 'La sección ' . ($i + 1) . ' tiene un párrafo vacío';
        }
        foreach ($t['cta'] as $c) {
            if ($c['label'] === '') $e[] = 'Un botón no tiene texto';
            if (preg_match('#^(/[a-z0-9/_-]*|https://[A-Za-z0-9._:/?&=%@+,-]+)$#D', $c['href']) !== 1) $e[] = 'El enlace «' . $c['href'] . '» debe empezar por / o por https://';
        }
        $all = [$t['title'], $t['meta_description'], $t['h1'], $t['lead']];
        foreach ($t['sections'] as $s) { $all[] = $s['h2']; foreach ($s['p'] as $p) $all[] = $p; }
        foreach ($t['cta'] as $c) $all[] = $c['label'];
        foreach ($all as $x) if (preg_match('/[<>]/', $x)) { $e[] = 'El texto no admite < ni > (solo texto plano)'; break; }
        return $e;
    }

    /**
     * Valida los campos que trae una propuesta (solo los que vienen) y los devuelve limpios. Las listas (sections, cta) vienen enteras y sustituyen a las actuales.
     * @return array{fields?:array,error?:string,field?:string}
     */
    private static function cleanFields(array $b): array
    {
        $out = [];
        foreach (['title' => [self::MAX_TITLE, false], 'meta_description' => [self::META_MAX, false], 'h1' => [self::MAX_H, false], 'lead' => [self::MAX_LEAD, true]] as $k => $spec) {
            if (!array_key_exists($k, $b)) continue;
            if ($k === 'lead' && ($b[$k] === '' || $b[$k] === null)) { $out[$k] = ''; continue; }
            $r = self::plain($b[$k], $spec[0], $k, $spec[1]);
            if (isset($r['error'])) return ['error' => $r['error'], 'field' => $k];
            $out[$k] = $r['text'];
        }
        if (array_key_exists('sections', $b)) {
            if (!is_array($b['sections']) || !$b['sections'] || count($b['sections']) > self::MAX_SECTIONS) return ['error' => 'Las secciones deben ser entre 1 y ' . self::MAX_SECTIONS, 'field' => 'sections'];
            $secs = [];
            foreach (array_values($b['sections']) as $i => $s) {
                if (!is_array($s) || !is_array($s['p'] ?? null) || !$s['p'] || count($s['p']) > self::MAX_PARAS) return ['error' => 'La sección ' . ($i + 1) . ' necesita entre 1 y ' . self::MAX_PARAS . ' párrafos', 'field' => 'sections'];
                $h = self::plain($s['h2'] ?? null, self::MAX_H, 'encabezado de la sección ' . ($i + 1));
                if (isset($h['error'])) return ['error' => $h['error'], 'field' => 'sections'];
                $ps = [];
                foreach (array_values($s['p']) as $p) { $r = self::plain($p, self::MAX_P, 'párrafo de la sección ' . ($i + 1), true); if (isset($r['error'])) return ['error' => $r['error'], 'field' => 'sections']; $ps[] = $r['text']; }
                $secs[] = ['h2' => $h['text'], 'p' => $ps];
            }
            $out['sections'] = $secs;
        }
        if (array_key_exists('cta', $b)) {
            if (!is_array($b['cta']) || count($b['cta']) > self::MAX_CTA) return ['error' => 'Máximo ' . self::MAX_CTA . ' botones', 'field' => 'cta'];
            $cta = [];
            foreach (array_values($b['cta']) as $c) {
                if (!is_array($c)) return ['error' => 'Botón no válido', 'field' => 'cta'];
                $l = self::plain($c['label'] ?? null, self::MAX_LABEL, 'texto del botón');
                if (isset($l['error'])) return ['error' => $l['error'], 'field' => 'cta'];
                $href = is_string($c['href'] ?? null) ? trim($c['href']) : '';
                if (strlen($href) > self::MAX_HREF) return ['error' => 'El enlace es demasiado largo', 'field' => 'cta'];
                $cta[] = ['label' => $l['text'], 'href' => $href];
            }
            $out['cta'] = $cta;
        }
        return ['fields' => $out];
    }

    // ───────────────────────────────────────── [REGISTRO]
    /** Añade un hecho al registro de la página (el más antiguo se descarta pasado el máximo). */
    private static function logTo(array &$st, array $who, string $action, string $lang, string $detail): void
    {
        $st['log'] = isset($st['log']) && is_array($st['log']) ? $st['log'] : [];
        array_unshift($st['log'], ['id' => 'L' . bin2hex(random_bytes(6)), 'at' => Util::iso(), 'by' => Util::line((string) ($who['sub'] ?? ''), 120), 'name' => Util::line((string) ($who['name'] ?? ''), 80), 'role' => (string) ($who['role'] ?? ''), 'lang' => $lang, 'action' => $action, 'detail' => Util::line($detail, 200)]);
        $st['log'] = array_slice($st['log'], 0, self::MAX_LOG);
    }

    /** Nombre en castellano de cada acción del registro (para el panel y el archivo). */
    const ACTIONS = ['propuesta' => 'Propuso un cambio', 'propuesta_aceptada' => 'Aceptó una propuesta', 'propuesta_descartada' => 'Descartó una propuesta', 'aprobada' => 'Aprobó la versión', 'aprobacion_retirada' => 'Retiró la aprobación', 'aprobacion_invalidada' => 'La aprobación dejó de valer al cambiar el texto'];

    // ───────────────────────────────────────── [RUTAS]
    /** Despacha /newcontent/… (el Router ya comprobó que es un manager o el revisor). */
    public static function handle(Request $req, array $who): Response
    {
        $path = $req->path;
        $m = $req->method;
        $isMgr = ($who['role'] ?? '') === 'manager';
        $isRev = ($who['role'] ?? '') === 'reviewer';
        if ($path === '/newcontent' && $m === 'GET') return self::listing($who);
        if ($path === '/newcontent/export' && $m === 'GET') return $isMgr ? self::export($who) : new Response(['ok' => false, 'error' => 'Solo para managers'], 403);
        if ($m === 'POST' && preg_match('#^/newcontent/([a-z0-9-]{1,60})/(es|en|fr|de)/(propose|approve|withdraw)$#D', $path, $x)) {
            $rl = RateLimit::hit('newcontent', (string) $who['sub'], self::WRITES_PER_HOUR, 3600000);
            if (!$rl['allowed']) return new Response(['ok' => false, 'error' => 'Demasiados cambios seguidos. Espera unos minutos.'], 429);
            if ($x[3] === 'propose') return self::propose($x[1], $x[2], $req->json() ?? [], $who);
            if (!$isRev) return new Response(['ok' => false, 'error' => 'Solo el Revisor puede aprobar o retirar una aprobación'], 403);
            return $x[3] === 'approve' ? self::approve($x[1], $x[2], $who) : self::withdraw($x[1], $x[2], $who);
        }
        if ($m === 'POST' && preg_match('#^/newcontent/([a-z0-9-]{1,60})/(es|en|fr|de)/proposals/(P[0-9a-f]{8})$#D', $path, $x)) {
            if (!$isRev) return new Response(['ok' => false, 'error' => 'Solo el Revisor decide las propuestas'], 403);
            $rl = RateLimit::hit('newcontent', (string) $who['sub'], self::WRITES_PER_HOUR, 3600000);
            if (!$rl['allowed']) return new Response(['ok' => false, 'error' => 'Demasiados cambios seguidos. Espera unos minutos.'], 429);
            return self::decide($x[1], $x[2], $x[3], $req->json() ?? [], $who);
        }
        return new Response(['ok' => false, 'error' => 'No encontrado'], 404);
    }

    /** GET /newcontent: todas las páginas con su estado efectivo; `me` dice qué puede hacer quien pregunta. */
    private static function listing(array $who): Response
    {
        $pages = [];
        foreach (self::baked() as $p) $pages[] = self::pageView($p);
        $rev = ($who['role'] ?? '') === 'reviewer';
        return new Response(['ok' => true, 'pages' => $pages, 'me' => ['role' => (string) $who['role'], 'can_decide' => $rev, 'can_export' => ($who['role'] ?? '') === 'manager'], 'functions' => self::FUNCTION, 'actions' => self::ACTIONS,
            'limits' => ['title' => self::MAX_TITLE, 'meta_min' => self::META_MIN, 'meta_max' => self::META_MAX, 'h1' => self::MAX_H, 'lead' => self::MAX_LEAD, 'p' => self::MAX_P, 'note' => self::MAX_NOTE, 'sections' => self::MAX_SECTIONS, 'paras' => self::MAX_PARAS, 'cta' => self::MAX_CTA, 'label' => self::MAX_LABEL]], 200, ['Cache-Control' => 'no-store']);
    }

    /** Busca página e idioma; devuelve [página, null] o [null, respuesta de error]. */
    private static function find(string $id, string $lang): array
    {
        $p = self::baked()[$id] ?? null;
        if (!$p) return [null, new Response(['ok' => false, 'error' => 'No existe esa página'], 404)];
        if (!isset($p['langs'][$lang])) return [null, new Response(['ok' => false, 'error' => 'Esa página no tiene versión en ese idioma'], 404)];
        return [$p, null];
    }

    /** POST …/propose: guarda una propuesta con SOLO lo que cambia respecto al texto vigente; el texto resultante debe seguir pasando las reglas al aceptarla. */
    private static function propose(string $id, string $lang, array $b, array $who): Response
    {
        [$page, $err] = self::find($id, $lang);
        if ($err) return $err;
        $c = self::cleanFields($b);
        if (isset($c['error'])) return new Response(['ok' => false, 'error' => $c['error'], 'field' => $c['field'] ?? ''], 400);
        $note = '';
        if (isset($b['note']) && $b['note'] !== '' && $b['note'] !== null) {
            $n = PlainText::check($b['note'], self::MAX_NOTE, true);
            if (!$n['ok']) return new Response(['ok' => false, 'error' => 'La nota solo admite texto plano de hasta ' . self::MAX_NOTE . ' caracteres', 'field' => 'note'], 400);
            $note = $n['text'];
        }
        return Store::locked('newcontent', function () use ($id, $lang, $page, $c, $note, $who) {
            $st = self::state($id);
            $cur = self::langView($lang, $page['langs'][$lang], (array) ($st['langs'][$lang] ?? []))['text'];
            $changed = [];
            foreach ($c['fields'] as $k => $v) if ($v !== $cur[$k]) $changed[$k] = $v;
            if (!$changed) return new Response(['ok' => false, 'error' => 'No hay ningún cambio respecto al texto actual', 'field' => ''], 400);
            $merged = array_merge($cur, $changed);
            $pend = 0;
            foreach ((array) ($st['langs'][$lang]['proposals'] ?? []) as $p) if (($p['status'] ?? '') === 'pendiente') $pend++;
            if ($pend >= self::MAX_PENDING) return new Response(['ok' => false, 'error' => 'Hay demasiadas propuestas pendientes en este idioma: decide algunas antes de añadir más'], 409);
            $prop = ['id' => 'P' . bin2hex(random_bytes(4)), 'at' => Util::iso(), 'by' => Util::line((string) $who['sub'], 120), 'name' => Util::line((string) ($who['name'] ?? ''), 80), 'status' => 'pendiente', 'fields' => $changed, 'note' => $note, 'problems' => self::validate($merged)];
            $st['langs'][$lang]['proposals'] = array_merge([$prop], array_values((array) ($st['langs'][$lang]['proposals'] ?? [])));
            $st['langs'][$lang] = self::trim($st['langs'][$lang]);
            self::logTo($st, $who, 'propuesta', $lang, implode(', ', array_keys($changed)) . ($note !== '' ? ' · ' . $note : ''));
            Store::put('newcontent:' . $page['id'], $st);
            return new Response(['ok' => true, 'proposal' => $prop, 'page' => self::pageView($page)], 201);
        });
    }

    /** Conserva todas las propuestas pendientes y solo las últimas decididas. */
    private static function trim(array $l): array
    {
        $pending = [];
        $decided = [];
        foreach ((array) ($l['proposals'] ?? []) as $p) { if (($p['status'] ?? '') === 'pendiente') $pending[] = $p; else $decided[] = $p; }
        $l['proposals'] = array_merge($pending, array_slice($decided, 0, self::KEEP_DECIDED));
        return $l;
    }

    /** POST …/proposals/:pid { decision }: acepta (el texto vigente pasa a ser el propuesto y la aprobación se retira) o descarta. */
    private static function decide(string $id, string $lang, string $pid, array $b, array $who): Response
    {
        [$page, $err] = self::find($id, $lang);
        if ($err) return $err;
        $d = $b['decision'] ?? '';
        if (!in_array($d, ['accept', 'reject'], true)) return new Response(['ok' => false, 'error' => 'La decisión debe ser accept o reject'], 400);
        $note = '';
        if (isset($b['note']) && $b['note'] !== '' && $b['note'] !== null) {
            $n = PlainText::check($b['note'], self::MAX_NOTE, true);
            if (!$n['ok']) return new Response(['ok' => false, 'error' => 'La nota solo admite texto plano de hasta ' . self::MAX_NOTE . ' caracteres', 'field' => 'note'], 400);
            $note = $n['text'];
        }
        return Store::locked('newcontent', function () use ($id, $lang, $pid, $d, $note, $page, $who) {
            $st = self::state($id);
            $props = array_values((array) ($st['langs'][$lang]['proposals'] ?? []));
            $i = null;
            foreach ($props as $k => $p) if (($p['id'] ?? '') === $pid) $i = $k;
            if ($i === null) return new Response(['ok' => false, 'error' => 'No existe esa propuesta'], 404);
            if (($props[$i]['status'] ?? '') !== 'pendiente') return new Response(['ok' => false, 'error' => 'Esa propuesta ya está decidida'], 409);
            $before = self::langView($lang, $page['langs'][$lang], (array) ($st['langs'][$lang] ?? []));
            if ($d === 'accept') {
                $merged = array_merge($before['text'], (array) ($props[$i]['fields'] ?? []));
                $bad = self::validate($merged);
                if ($bad) return new Response(['ok' => false, 'error' => 'No se puede aceptar: ' . $bad[0] . '. Propón primero una corrección.'], 400);
                $st['langs'][$lang]['edit'] = self::canon($merged);
                $st['langs'][$lang]['base'] = self::hash(self::canon($page['langs'][$lang]));
                if ($before['status'] === 'aprobado') {
                    $st['langs'][$lang]['approval'] = null;
                    self::logTo($st, $who, 'aprobacion_invalidada', $lang, 'por la propuesta ' . $pid);
                }
            }
            $props[$i]['status'] = $d === 'accept' ? 'aceptada' : 'descartada';
            $props[$i]['decided_by'] = Util::line((string) $who['sub'], 120);
            $props[$i]['decided_at'] = Util::iso();
            if ($note !== '') $props[$i]['decided_note'] = $note;
            $st['langs'][$lang]['proposals'] = $props;
            $st['langs'][$lang] = self::trim($st['langs'][$lang]);
            self::logTo($st, $who, $d === 'accept' ? 'propuesta_aceptada' : 'propuesta_descartada', $lang, $pid . ' · ' . implode(', ', array_keys((array) ($props[$i]['fields'] ?? []))) . ($note !== '' ? ' · ' . $note : ''));
            Store::put('newcontent:' . $id, $st);
            return new Response(['ok' => true, 'page' => self::pageView($page)]);
        });
    }

    /** POST …/approve: aprueba el texto vigente con la función que toca (comercial en castellano, traductor en el resto). */
    private static function approve(string $id, string $lang, array $who): Response
    {
        [$page, $err] = self::find($id, $lang);
        if ($err) return $err;
        return Store::locked('newcontent', function () use ($id, $lang, $page, $who) {
            $st = self::state($id);
            $views = [];
            foreach (self::LANGS as $l) if (isset($page['langs'][$l])) $views[$l] = self::langView($l, $page['langs'][$l], (array) ($st['langs'][$l] ?? []));
            if ($views[$lang]['status'] === 'aprobado') return new Response(['ok' => false, 'error' => 'Esa versión ya está aprobada'], 409);
            $why = self::approvalProblem($page, $views, $lang);
            if ($why !== null) return new Response(['ok' => false, 'error' => $why], 409);
            $by = Util::line((string) ($who['name'] ?? '') ?: (string) $who['sub'], 80);
            $st['langs'][$lang]['approval'] = ['by' => $by, 'email' => Util::line((string) $who['sub'], 120), 'role' => self::FUNCTION[$lang], 'at' => gmdate('Y-m-d'), 'th' => $views[$lang]['hash']];
            if (!isset($st['langs'][$lang]['base'])) $st['langs'][$lang]['base'] = self::hash(self::canon($page['langs'][$lang]));
            self::logTo($st, $who, 'aprobada', $lang, 'como ' . self::FUNCTION[$lang]);
            Store::put('newcontent:' . $id, $st);
            return new Response(['ok' => true, 'page' => self::pageView($page)]);
        });
    }

    /** POST …/withdraw: retira la aprobación (la versión vuelve a borrador y deja de publicarse en la siguiente compilación). Si se retira la del castellano, las traducciones aprobadas siguen y se avisa en el registro. */
    private static function withdraw(string $id, string $lang, array $who): Response
    {
        [$page, $err] = self::find($id, $lang);
        if ($err) return $err;
        return Store::locked('newcontent', function () use ($id, $lang, $page, $who) {
            $st = self::state($id);
            $v = self::langView($lang, $page['langs'][$lang], (array) ($st['langs'][$lang] ?? []));
            if ($v['status'] !== 'aprobado') return new Response(['ok' => false, 'error' => 'Esa versión no está aprobada'], 409);
            $st['langs'][$lang]['approval'] = null;
            if (!isset($st['langs'][$lang]['base'])) $st['langs'][$lang]['base'] = self::hash(self::canon($page['langs'][$lang]));
            self::logTo($st, $who, 'aprobacion_retirada', $lang, '');
            if ($lang === 'es') {
                foreach (self::LANGS as $l) if ($l !== 'es' && isset($page['langs'][$l]) && self::langView($l, $page['langs'][$l], (array) ($st['langs'][$l] ?? []))['status'] === 'aprobado') self::logTo($st, $who, 'aprobacion_retirada', $l, 'al retirar el castellano (las traducciones no pueden estar aprobadas sin él)');
                foreach (self::LANGS as $l) if ($l !== 'es' && isset($page['langs'][$l])) { $st['langs'][$l]['approval'] = null; if (!isset($st['langs'][$l]['base'])) $st['langs'][$l]['base'] = self::hash(self::canon($page['langs'][$l])); }
            }
            Store::put('newcontent:' . $id, $st);
            return new Response(['ok' => true, 'page' => self::pageView($page)]);
        });
    }

    /** GET /newcontent/export: lo que hay que anotar en data/content-new/*.json (solo los idiomas cuyo texto o aprobación cambió, y los hechos del registro que el archivo aún no tiene). */
    private static function export(array $who): Response
    {
        $out = [];
        foreach (self::baked() as $page) {
            $v = self::pageView($page);
            $st = self::state($page['id']);
            $langs = [];
            foreach ($v['langs'] as $l => $lv) {
                $b = $page['langs'][$l];
                $baseAp = ($b['status'] ?? '') === 'aprobado' && is_array($b['approval'] ?? null) ? array_intersect_key($b['approval'], array_flip(['by', 'role', 'at'])) : null;
                $nowAp = is_array($lv['approval']) ? array_intersect_key($lv['approval'], array_flip(['by', 'role', 'at'])) : null;
                $textChanged = self::hash($lv['text']) !== self::hash($b);
                if ($textChanged || $baseAp !== $nowAp) $langs[$l] = ['status' => $lv['status'], 'approval' => $lv['approval'], 'text' => $lv['text']];
            }
            $have = [];
            foreach ((array) ($page['history'] ?? []) as $e) if (is_array($e) && isset($e['id'])) $have[$e['id']] = 1;
            $history = array_values(array_filter((array) ($st['log'] ?? []), function ($e) use ($have) { return is_array($e) && isset($e['id']) && !isset($have[$e['id']]); }));
            if ($langs || $history) $out[$page['id']] = ['langs' => $langs, 'history' => $history];
        }
        return new Response(['ok' => true, 'kind' => 'torivac-contenido-nuevo', 'exported_at' => Util::iso(), 'exported_by' => (string) ($who['sub'] ?? ''), 'pages' => Util::obj($out)], 200, ['Cache-Control' => 'no-store']);
    }
}
