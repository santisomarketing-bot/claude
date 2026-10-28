<?php
/**
 * [PROPOSALS] Decisiones del manager sobre las propuestas de mejora del panel (clave proposals:state: id de la propuesta → entrada).
 * Una entrada es { state: ok|no, by, at } y, si el manager ha editado la propuesta, también:
 *   mode  → qué hace su texto: replace (sustituye el párrafo de la web que contiene `find`) · translate (descripción del producto en otro idioma) · title (título de la portada, una línea
 *           «es: …» por idioma) · add (texto que falta y se añade) · note (decisión o dato para el equipo, sin cambio automático)
 *   text  → SU versión del texto (≤ 3000 caracteres) · find → fragmento de la web que se sustituye (≤ 300) · note → nota libre (≤ 500)
 * Todo es TEXTO PLANO (las mismas reglas que los formularios públicos, PlainText): lo que escribe un manager acaba en una página estática y se escapa siempre, pero así tampoco puede colarse
 * código. Aprobar NO publica nada por sí solo: el texto aprobado se descarga desde el panel y se aplica en la siguiente actualización de la web (scripts/apply_proposals.mjs).
 *
 *   Proposals::entry(body, state, by, nowMs) → ['entry' => …] | ['error', 'code', 'field']
 */
namespace Torivac;

final class Proposals
{
    /** Valores válidos de `mode`. */
    const MODES = ['replace', 'translate', 'title', 'add', 'note'];
    /** Límites de caracteres de cada campo de texto. */
    const MAX_TEXT = 3000, MAX_FIND = 300, MAX_NOTE = 500;

    /**
     * Valida el cuerpo de POST /api/proposals/state para el estado `ok` o `no` y devuelve la entrada que se guarda, con los textos ya normalizados (sin controles ni invisibles). Los campos
     * ausentes o vacíos no se guardan; un campo que no es una cadena, un `mode` desconocido o un texto que no es texto plano o se pasa del límite dan error (con `code` y `field`).
     * @return array{entry?:array,error?:string,code?:string,field?:string}
     */
    public static function entry(array $b, string $state, string $by, ?int $nowMs = null): array
    {
        $e = ['state' => $state, 'by' => $by, 'at' => Util::iso($nowMs === null ? null : $nowMs / 1000)];
        $mode = $b['mode'] ?? null;
        if ($mode !== null && $mode !== '') {
            if (!is_string($mode) || !in_array($mode, self::MODES, true)) return ['error' => 'Modo no válido', 'code' => 'mode', 'field' => 'mode'];
            $e['mode'] = $mode;
        }
        foreach (['text' => [self::MAX_TEXT, true], 'find' => [self::MAX_FIND, false], 'note' => [self::MAX_NOTE, true]] as $k => $spec) {
            $v = $b[$k] ?? null;
            if ($v === null || $v === '') continue;
            if (!is_string($v)) return ['error' => 'Petición no válida', 'code' => 'plain_text', 'field' => $k];
            $r = PlainText::check($v, $spec[0], $spec[1]);
            if (!$r['ok']) return Orders::plainError($r['code'], $k, $spec[0]);
            if ($r['text'] !== '') $e[$k] = $r['text'];
        }
        return ['entry' => $e];
    }
}
