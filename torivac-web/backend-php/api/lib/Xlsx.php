<?php
/**
 * [XLSX] Lector mínimo de libros .xlsx (zip + XML) sin extensiones ni librerías: la tarifa se lee directamente de Drive sin convertirla a hoja de Google.
 * Port en PHP de shared/xlsx.mjs; ambos se prueban con los mismos libros (shared/xlsx/*.xlsx) y el mismo resultado esperado (shared/xlsx/esperado.json).
 *
 *   Xlsx::read($bytes)           → [['name' => …, 'hidden' => bool, 'rows' => [[…], …]], …]   hojas en el orden del libro
 *   Xlsx::pick($sheets, $name)   → ['name' => …, 'rows' => …]   la hoja pedida por nombre o la primera visible con cabecera de precios
 *
 * Valores: texto (cadenas compartidas, «inline», resultado de fórmula; el texto enriquecido se une y la fonética se ignora), números (int/float),
 * booleanos y '' en las celdas intermedias vacías. Se descartan las filas sin contenido y las celdas vacías del final de cada fila.
 * No soporta: zip64, libros cifrados, .xls antiguo (error claro). Necesita gzinflate (incluida en PHP).
 *
 * [TOPES] El libro viene de una hoja de Drive que puede editar más gente que los managers: un libro hostil no puede agotar la memoria ni el tiempo.
 *   · bytes descomprimidos por entrada del zip ≤ 20 MB (bomba de descompresión) y ≤ 60 MB en total;
 *   · columna ≤ XFD (16 384), filas ≤ 200 000, casillas (huecos incluidos) ≤ 1 500 000, cadenas compartidas ≤ 500 000;
 *   · el XML se recorre en UNA pasada con strpos, sin expresiones regulares que retrocedan (miles de <row> sin cerrar las hacían cuadráticas).
 * Si se supera alguno: «La hoja es demasiado grande o está dañada» (la sincronización falla y se conservan los precios vigentes).
 */
namespace Torivac;

final class Xlsx
{
    /** Bytes máximos que puede ocupar una entrada del zip una vez descomprimida. */
    const MAX_ENTRY_BYTES = 20000000;
    /** Bytes máximos descomprimidos entre todas las entradas leídas del libro. */
    const MAX_TOTAL_BYTES = 60000000;
    /** Columnas máximas de una hoja (XFD). */
    const MAX_COLS = 16384;
    /** Filas máximas de una hoja. */
    const MAX_ROWS = 200000;
    /** Casillas máximas (huecos intermedios incluidos) que se guardan en memoria entre todas las filas de una hoja. */
    const MAX_CELLS = 1500000;
    /** Cadenas compartidas máximas. */
    const MAX_SHARED = 500000;
    /** Mensaje cuando se supera un tope o el libro está dañado. */
    const TOO_BIG = 'La hoja es demasiado grande o está dañada';

    /** Entero de 16 bits little-endian en la posición o del texto binario (formato del zip). */
    private static function u16(string $b, int $o): int { return ord($b[$o]) | (ord($b[$o + 1]) << 8); }

    /** Entero de 32 bits little-endian en la posición o del texto binario (formato del zip). */
    private static function u32(string $b, int $o): int { return ord($b[$o]) | (ord($b[$o + 1]) << 8) | (ord($b[$o + 2]) << 16) | (ord($b[$o + 3]) << 24); }

    /** índice del contenido del zip por nombre: método, tamaños, y posición de la cabecera local (del directorio central, al final del fichero) */
    private static function entries(string $b): array
    {
        $len = strlen($b);
        $e = $len >= 22 ? strrpos($b, "PK\x05\x06") : false;                                   // última aparición: el registro final del zip
        if ($e === false || $e + 22 > $len) throw new \InvalidArgumentException('El fichero no es un libro .xlsx (no es un zip válido)');
        $n = self::u16($b, $e + 10);
        $p = self::u32($b, $e + 16);
        $out = [];
        for ($i = 0; $i < $n; $i++) {
            if ($p + 46 > $len || self::u32($b, $p) !== 0x02014b50) throw new \InvalidArgumentException('El libro .xlsx está dañado (directorio del zip)');
            $nlen = self::u16($b, $p + 28); $xlen = self::u16($b, $p + 30); $clen = self::u16($b, $p + 32);
            $out[substr($b, $p + 46, $nlen)] = ['method' => self::u16($b, $p + 10), 'csize' => self::u32($b, $p + 20), 'usize' => self::u32($b, $p + 24), 'off' => self::u32($b, $p + 42)];
            $p += 46 + $nlen + $xlen + $clen;
        }
        return $out;
    }

    /** contenido de una entrada del zip (sin comprimir o deflate), con tope por entrada y en total (`$budget` = bytes que aún se pueden leer en este libro) */
    private static function text(string $b, ?array $ent, int &$budget): string
    {
        if (!$ent) return '';
        if ($ent['off'] + 30 > strlen($b) || self::u32($b, $ent['off']) !== 0x04034b50) throw new \InvalidArgumentException('El libro .xlsx está dañado (cabecera local)');
        if ($ent['usize'] > self::MAX_ENTRY_BYTES || $ent['csize'] > self::MAX_ENTRY_BYTES) throw new \InvalidArgumentException(self::TOO_BIG);
        $start = $ent['off'] + 30 + self::u16($b, $ent['off'] + 26) + self::u16($b, $ent['off'] + 28);
        $raw = substr($b, $start, $ent['csize']);
        if ($ent['method'] === 0) $d = $raw;
        elseif ($ent['method'] !== 8) throw new \InvalidArgumentException('El libro .xlsx usa una compresión que no se soporta');
        else {
            $d = @gzinflate($raw, self::MAX_ENTRY_BYTES);                                       // false si no se puede descomprimir o supera el tope (sin llegar a reservar la memoria de la bomba)
            if ($d === false) throw new \InvalidArgumentException(self::TOO_BIG);
        }
        $budget -= strlen($d);
        if (strlen($d) > self::MAX_ENTRY_BYTES || $budget < 0) throw new \InvalidArgumentException(self::TOO_BIG);
        return $d;
    }

    /** entidades XML → texto (&amp; &lt; &#233; &#xE9;) */
    private static function unesc(string $s): string { return html_entity_decode($s, ENT_QUOTES | ENT_XML1, 'UTF-8'); }

    /** atributos de una etiqueta XML: ' r="A1" t="s"' → ['r' => 'A1', 't' => 's'] (una etiqueta de más de 4 KB de atributos no es de un libro real) */
    private static function attrs(string $s): array
    {
        if (strlen($s) > 4096) throw new \InvalidArgumentException(self::TOO_BIG);
        $o = [];
        if (preg_match_all('/([\w:.\-]+)\s*=\s*"([^"]*)"/', $s, $m, PREG_SET_ORDER)) foreach ($m as $x) $o[$x[1]] = self::unesc($x[2]);
        return $o;
    }

    /** ¿Es `$c` (el carácter que sigue al nombre de una etiqueta) un final de nombre? (espacio, «>» o «/»: así <row no confunde <rowBreaks) */
    private static function endsName(string $c): bool { return $c === ' ' || $c === '>' || $c === '/' || $c === "\t" || $c === "\r" || $c === "\n"; }

    /**
     * Recorre en una sola pasada los elementos <tag …>contenido</tag> y <tag …/> de un XML y llama a `$fn(atributos, contenido)` (contenido = null si es <tag …/>).
     * Un elemento sin cerrar corta el recorrido (el resto se descarta). Si `$fn` devuelve false, el recorrido se detiene.
     */
    private static function each(string $xml, string $tag, callable $fn): void
    {
        $open = '<' . $tag;
        $ol = strlen($open);
        $close = '</' . $tag . '>';
        $pos = 0;
        while (($i = strpos($xml, $open, $pos)) !== false) {
            $a = $i + $ol;
            if (!self::endsName($xml[$a] ?? '')) { $pos = $a; continue; }
            $gt = strpos($xml, '>', $a);
            if ($gt === false) return;
            $at = substr($xml, $a, $gt - $a);
            if ($at !== '' && $at[strlen($at) - 1] === '/') { if ($fn(rtrim($at, '/'), null) === false) return; $pos = $gt + 1; continue; }
            $end = strpos($xml, $close, $gt + 1);
            if ($end === false) return;
            if ($fn($at, substr($xml, $gt + 1, $end - $gt - 1)) === false) return;
            $pos = $end + strlen($close);
        }
    }

    /** Recorre las etiquetas <tag …> o <tag …/> (solo atributos, sin contenido) y llama a `$fn(atributos)`. */
    private static function eachOpen(string $xml, string $tag, callable $fn): void
    {
        $open = '<' . $tag;
        $ol = strlen($open);
        $pos = 0;
        while (($i = strpos($xml, $open, $pos)) !== false) {
            $a = $i + $ol;
            if (!self::endsName($xml[$a] ?? '')) { $pos = $a; continue; }
            $gt = strpos($xml, '>', $a);
            if ($gt === false) return;
            $fn(rtrim(substr($xml, $a, $gt - $a), '/'));
            $pos = $gt + 1;
        }
    }

    /** texto de un fragmento con <t>…</t> (varios si es texto enriquecido); la fonética <rPh> no cuenta */
    private static function tText(string $xml): string
    {
        $clean = '';
        $pos = 0;
        while (($i = strpos($xml, '<rPh', $pos)) !== false) {                                  // quita cada <rPh…>…</rPh> (si no cierra, se deja)
            if (!self::endsName($xml[$i + 4] ?? '')) { $clean .= substr($xml, $pos, $i + 4 - $pos); $pos = $i + 4; continue; }
            $j = strpos($xml, '</rPh>', $i);
            if ($j === false) break;
            $clean .= substr($xml, $pos, $i - $pos);
            $pos = $j + 6;
        }
        $clean .= substr($xml, $pos);
        $s = '';
        self::each($clean, 't', function ($at, $inner) use (&$s) { if ($inner !== null && strpos($at, '/') === false) $s .= self::unesc($inner); });
        return $s;
    }

    /** letras de columna → posición: A=0, Z=25, AA=26, XFD=16383 (más de 3 letras o pasar de XFD no es una columna de Excel) */
    private static function colIndex(string $ref): int
    {
        $n = 0;
        if (preg_match('/^[A-Za-z]+/', $ref, $m)) {
            if (strlen($m[0]) > 3) throw new \InvalidArgumentException(self::TOO_BIG);
            foreach (str_split(strtoupper($m[0])) as $ch) $n = $n * 26 + (ord($ch) - 64);
        }
        if ($n > self::MAX_COLS) throw new \InvalidArgumentException(self::TOO_BIG);
        return $n - 1;
    }

    /** celdas de una hoja → filas (ver cabecera) */
    private static function sheetRows(string $xml, array $shared): array
    {
        $rows = [];
        $nRows = 0;
        $slots = 0;
        self::each($xml, 'row', function ($rat, $rinner) use (&$rows, &$nRows, &$slots, $shared) {
            if (++$nRows > self::MAX_ROWS) throw new \InvalidArgumentException(self::TOO_BIG);
            if ($rinner === null || $rinner === '') return;
            $row = [];
            $next = 0;
            self::each($rinner, 'c', function ($cat, $body) use (&$row, &$next, &$slots, $shared) {
                $a = self::attrs($cat);
                $body = $body ?? '';
                $col = isset($a['r']) ? self::colIndex($a['r']) : $next;
                $next = $col + 1;
                $t = $a['t'] ?? '';
                $v = null;
                $vi = strpos($body, '<v>');
                if ($vi !== false) { $ve = strpos($body, '</v>', $vi + 3); if ($ve !== false) $v = substr($body, $vi + 3, $ve - $vi - 3); }
                $val = '';
                if ($t === 'inlineStr') {
                    $ii = strpos($body, '<is>');
                    $ie = $ii === false ? false : strpos($body, '</is>', $ii + 4);
                    $val = $ie === false ? '' : self::tText(substr($body, $ii + 4, $ie - $ii - 4));
                } elseif ($v !== null) {
                    if ($t === 's') $val = $shared[(int) $v] ?? '';
                    elseif ($t === 'str' || $t === 'd') $val = self::unesc($v);
                    elseif ($t === 'b') $val = trim($v) === '1';
                    elseif ($t === 'e') $val = '';
                    elseif (trim($v) === '') $val = '';
                    elseif (is_numeric($v)) { $f = (float) $v; $val = !is_finite($f) ? self::unesc($v) : ((floor($f) == $f && abs($f) < 1e15) ? (int) $f : $f); }
                    else $val = self::unesc($v);
                }
                if ($slots + max(count($row), $col + 1) > self::MAX_CELLS) throw new \InvalidArgumentException(self::TOO_BIG);
                while (count($row) < $col) $row[] = '';
                $row[$col] = $val;
            });
            while ($row && end($row) === '') array_pop($row);
            foreach ($row as $c) { if ($c !== '') { $slots += count($row); $rows[] = array_values($row); break; } }
        });
        return $rows;
    }

    /** @return array<int,array{name:string,hidden:bool,rows:array}> */
    public static function read(string $bytes): array
    {
        $budget = self::MAX_TOTAL_BYTES;
        $z = self::entries($bytes);
        $wb = self::text($bytes, $z['xl/workbook.xml'] ?? null, $budget);
        if ($wb === '') throw new \InvalidArgumentException('El fichero es un zip pero no un libro de Excel (.xlsx)');
        $rels = [];
        self::eachOpen(self::text($bytes, $z['xl/_rels/workbook.xml.rels'] ?? null, $budget), 'Relationship', function ($at) use (&$rels) { $a = self::attrs($at); if (isset($a['Id'])) $rels[$a['Id']] = $a['Target'] ?? ''; });
        $shared = [];
        self::each(self::text($bytes, $z['xl/sharedStrings.xml'] ?? null, $budget), 'si', function ($at, $inner) use (&$shared) {
            if ($inner === null) return;                                                         // <si/> sin contenido: igual que la versión JavaScript, no suma una cadena
            if (count($shared) >= self::MAX_SHARED) throw new \InvalidArgumentException(self::TOO_BIG);
            $shared[] = self::tText($inner);
        });
        $sheets = [];
        $wanted = [];
        self::eachOpen($wb, 'sheet', function ($at) use (&$wanted, $rels) {
            $a = self::attrs($at);
            $target = $rels[$a['r:id'] ?? ''] ?? '';
            if ($target === '') return;
            $target = $target[0] === '/' ? substr($target, 1) : 'xl/' . preg_replace('/^\.\//', '', $target);
            $wanted[] = [$a, $target];
        });
        foreach ($wanted as [$a, $target]) {
            $sheets[] = ['name' => $a['name'] ?? '', 'hidden' => in_array($a['state'] ?? '', ['hidden', 'veryHidden'], true), 'rows' => self::sheetRows(self::text($bytes, $z[$target] ?? null, $budget), $shared)];
        }
        return $sheets;
    }

    /** elige la hoja de precios: por nombre si se da (error claro si no existe); si no, la primera visible con columnas de referencia y precio */
    public static function pick(array $sheets, string $name = ''): array
    {
        $want = mb_strtolower(trim($name));
        $names = implode(', ', array_map(function ($s) { return $s['name']; }, $sheets)) ?: 'ninguna';
        if ($want !== '') {
            foreach ($sheets as $s) { if (mb_strtolower(trim($s['name'])) === $want) return $s; }
            throw new \InvalidArgumentException("El libro no tiene la hoja «{$name}» (hojas: $names)");
        }
        foreach ($sheets as $s) { if (!$s['hidden'] && PriceSheet::findHeader($s['rows'])) return $s; }
        throw new \InvalidArgumentException("Ninguna hoja visible del libro tiene las columnas de referencia y de precio (hojas: $names)");
    }
}
