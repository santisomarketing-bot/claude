<?php
/**
 * [GOOGLE-SETTINGS] Ajustes de medición de Google (Analytics 4, Google Ads y la etiqueta de cada conversión) que el manager edita en el panel (Ajustes → Google) y que la web lee SIN recompilar.
 * Se guardan en el almacén (clave `settings:google`, sin caducidad). Contrato único con el Worker: docs/GOOGLE.md §11 (mismas reglas que site/lib/google.mjs y site/assets/js/consent.js).
 *   GET  /api/google            PÚBLICO: { ok, google:{ ga4, ads, conv:{ quote, contact } } } — solo IDs (salen en el código de cualquier web); conv = etiqueta COMPLETA y solo si está activada y hay ID de Ads.
 *   GET  /api/settings/google   manager: { ok, settings:{ ga4, ads, conversions:{ quote:{label,on}, contact:{label,on} }, updated:{at,by}|null } }
 *   PUT  /api/settings/google   manager: valida y guarda; error → 400 { ok:false, error, field }.
 * Las dos conversiones son las que mide la web: `quote` (el presupuesto y el pedido son el mismo envío) y `contact`. Teléfono, WhatsApp y correo no se miden.
 */
namespace Torivac;

final class GoogleSettings
{
    /** Clave del almacén. */
    const KEY = 'settings:google';
    /** Conversiones que mide la web, con el nombre que se le enseña a la persona. */
    const KINDS = ['quote' => 'Presupuesto enviado', 'contact' => 'Mensaje de contacto enviado'];
    const RX_GA4 = '/^(?:G|GT)-[A-Z0-9]{6,14}$/D';
    const RX_ADS = '/^AW-\d{6,12}$/D';
    const RX_LABEL = '/^[A-Za-z0-9_-]{8,40}$/D';
    const RX_FULL = '/^(AW-\d{6,12})\/([A-Za-z0-9_-]{8,40})$/D';
    /** Tamaño máximo del cuerpo del PUT en bytes. */
    const MAX_BODY = 5000;

    /** Ajustes vacíos (nada que medir). */
    public static function blank(): array
    {
        return ['ga4' => '', 'ads' => '', 'conversions' => ['quote' => ['label' => '', 'on' => true], 'contact' => ['label' => '', 'on' => true]], 'updated' => null];
    }

    /** Ajustes guardados; si no hay o están dañados, los vacíos. Siempre con la forma completa y solo valores que cumplen las reglas (lo guardado a mano o por una versión vieja no se cuela). */
    public static function load(): array
    {
        $s = Store::get(self::KEY);
        $out = self::blank();
        if (!is_array($s)) return $out;
        if (is_string($s['ga4'] ?? null) && preg_match(self::RX_GA4, $s['ga4'])) $out['ga4'] = $s['ga4'];
        if (is_string($s['ads'] ?? null) && preg_match(self::RX_ADS, $s['ads'])) $out['ads'] = $s['ads'];
        foreach (array_keys(self::KINDS) as $k) {
            $c = is_array($s['conversions'][$k] ?? null) ? $s['conversions'][$k] : [];
            $l = is_string($c['label'] ?? null) ? $c['label'] : '';
            if ($l !== '' && !preg_match(self::RX_LABEL, $l) && !preg_match(self::RX_FULL, $l)) $l = '';
            $out['conversions'][$k] = ['label' => $l, 'on' => ($c['on'] ?? true) !== false];
        }
        if (is_array($s['updated'] ?? null) && is_string($s['updated']['at'] ?? null) && is_string($s['updated']['by'] ?? null)) $out['updated'] = ['at' => $s['updated']['at'], 'by' => Util::line($s['updated']['by'], 120)];
        return $out;
    }

    /** Etiqueta COMPLETA (AW-…/etiqueta) a partir de lo guardado y del ID de Ads; '' si no se puede completar. */
    public static function fullLabel(string $label, string $ads): string
    {
        if (preg_match(self::RX_FULL, $label)) return $label;
        return preg_match(self::RX_LABEL, $label) && preg_match(self::RX_ADS, $ads) ? $ads . '/' . $label : '';
    }

    /** Lo que la web puede ver: IDs y etiquetas completas de las conversiones activadas (con ID de Ads). */
    public static function publicView(array $s): array
    {
        $conv = [];
        foreach (array_keys(self::KINDS) as $k) {
            $c = $s['conversions'][$k];
            $conv[$k] = $c['on'] && $s['ads'] !== '' ? self::fullLabel($c['label'], $s['ads']) : '';
        }
        return ['ga4' => $s['ga4'], 'ads' => $s['ads'], 'conv' => $conv];
    }

    /**
     * Valida el cuerpo del PUT y devuelve ['settings' => ajustes normalizados (sin `updated`)] o ['error' => castellano, 'field' => ga4|ads|conversions.quote|conversions.contact].
     * Reglas: IDs con la forma de Google; etiqueta completa (con el mismo ID que `ads`) o solo la parte final (necesita `ads`); si hay etiquetas completas y `ads` está vacío, `ads` sale de ellas; `on` es booleano.
     * @param mixed $raw
     */
    public static function validate($raw): array
    {
        if (!is_array($raw) || (Util::isList($raw) && $raw)) return ['error' => 'Petición no válida', 'field' => ''];
        foreach (['ga4', 'ads'] as $k) if (isset($raw[$k]) && !is_string($raw[$k])) return ['error' => 'Petición no válida', 'field' => $k];
        $ga4 = trim((string) ($raw['ga4'] ?? '')); $ads = trim((string) ($raw['ads'] ?? ''));
        if ($ga4 !== '' && !preg_match(self::RX_GA4, $ga4)) return ['error' => 'El ID de Analytics debe tener la forma G-XXXXXXXXXX.', 'field' => 'ga4'];
        if ($ads !== '' && !preg_match(self::RX_ADS, $ads)) return ['error' => 'El ID de Google Ads debe tener la forma AW-123456789.', 'field' => 'ads'];
        $in = is_array($raw['conversions'] ?? null) ? $raw['conversions'] : [];
        $conv = [];
        foreach (self::KINDS as $k => $name) {
            $c = is_array($in[$k] ?? null) ? $in[$k] : [];
            if (array_key_exists('label', $c) && !is_string($c['label'])) return ['error' => 'Petición no válida', 'field' => 'conversions.' . $k];
            if (array_key_exists('on', $c) && !is_bool($c['on'])) return ['error' => 'Petición no válida', 'field' => 'conversions.' . $k];
            $l = trim((string) ($c['label'] ?? ''));
            if ($l !== '') {
                if (preg_match(self::RX_FULL, $l, $m)) {
                    if ($ads !== '' && $m[1] !== $ads) return ['error' => 'La etiqueta de «' . $name . '» es de otra cuenta de Ads (' . $m[1] . ').', 'field' => 'conversions.' . $k];
                } elseif (!preg_match(self::RX_LABEL, $l)) {
                    return ['error' => 'La etiqueta de «' . $name . '» no es válida: pega AW-123456789/AbCdEfGhIjK o solo AbCdEfGhIjK.', 'field' => 'conversions.' . $k];
                }
            }
            $conv[$k] = ['label' => $l, 'on' => ($c['on'] ?? true) !== false];
        }
        if ($ads === '') {                                                                          // sin ID de Ads: se toma de las etiquetas completas; solo la etiqueta no vale
            foreach (self::KINDS as $k => $name) {
                $l = $conv[$k]['label'];
                if ($l === '') continue;
                if (preg_match(self::RX_FULL, $l, $m)) { if ($ads === '') $ads = $m[1]; elseif ($ads !== $m[1]) return ['error' => 'Las etiquetas son de cuentas de Ads distintas.', 'field' => 'conversions.' . $k]; }
                else return ['error' => 'Para usar solo la etiqueta de «' . $name . '» escribe antes el ID de Google Ads.', 'field' => 'conversions.' . $k];
            }
        }
        return ['settings' => ['ga4' => $ga4, 'ads' => $ads, 'conversions' => $conv]];
    }

    /** GET /google (público): lo que necesita la web, con caché corta. */
    public static function handlePublic(): Response
    {
        return new Response(['ok' => true, 'google' => self::publicView(self::load())], 200, ['Cache-Control' => 'public, max-age=60', 'Vary' => 'Origin']);
    }

    /** GET /settings/google (manager): los ajustes tal como están guardados. */
    public static function handleGet(): Response
    {
        return new Response(['ok' => true, 'settings' => self::load()], 200, ['Cache-Control' => 'no-store']);
    }

    /** PUT /settings/google (manager): valida, guarda con quién y cuándo, lo anota en Actividad y devuelve los ajustes. */
    public static function handlePut(Request $req, array $who, ?int $nowMs = null): Response
    {
        $b = $req->json(self::MAX_BODY);
        if ($b === null) return new Response(['ok' => false, 'error' => 'Petición no válida', 'field' => ''], 400);
        $v = self::validate($b);
        if (isset($v['error'])) return new Response(['ok' => false, 'error' => $v['error'], 'field' => $v['field']], 400);
        $s = $v['settings'] + ['updated' => ['at' => Util::iso($nowMs === null ? null : $nowMs / 1000), 'by' => Util::line((string) (empty($who['master']) ? ($who['sub'] ?? '') : 'maestro'), 120)]];
        try { Store::put(self::KEY, $s); }
        catch (\Throwable $e) { error_log('torivac-api: [google] No se pudieron guardar los ajustes: ' . mb_substr($e->getMessage(), 0, 160)); return new Response(['ok' => false, 'error' => 'No se pudieron guardar los ajustes'], 500); }
        $c = $s['conversions'];
        Audit::log('settings.google', $who, $req, 'ga4=' . ($s['ga4'] ?: '—') . ' ads=' . ($s['ads'] ?: '—') . ' presupuesto=' . ($c['quote']['label'] !== '' ? ($c['quote']['on'] ? 'sí' : 'apagada') : '—') . ' contacto=' . ($c['contact']['label'] !== '' ? ($c['contact']['on'] ? 'sí' : 'apagada') : '—'));
        return new Response(['ok' => true, 'settings' => self::load()], 200, ['Cache-Control' => 'no-store']);
    }
}
