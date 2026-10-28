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
 */
namespace Torivac;

final class Xlsx
{
    /** Entero de 16 bits little-endian en la posición o del texto binario (formato del zip). */
    private static function u16(string $b, int $o): int { return ord($b[$o]) | (ord($b[$o + 1]) << 8); }

    /** Entero de 32 bits little-endian en la posición o del texto binario (formato del zip). */
    private static function u32(string $b, int $o): int { return ord($b[$o]) | (ord($b[$o + 1]) << 8) | (ord($b[$o + 2]) << 16) | (ord($b[$o + 3]) << 24); }

    /** índice del contenido del zip por nombre: método, tamaño comprimido y posición de la cabecera local (del directorio central, al final del fichero) */
    private static function entries(string $b): array
    {
        $len = strlen($b);
        $e = $len >= 22 ? strrpos($b, "PK\x05\x06") : false;                                   // última aparición: el registro final del zip
        if ($e === false) throw new \InvalidArgumentException('El fichero no es un libro .xlsx (no es un zip válido)');
        $n = self::u16($b, $e + 10);
        $p = self::u32($b, $e + 16);
        $out = [];
        for ($i = 0; $i < $n; $i++) {
            if ($p + 46 > $len || self::u32($b, $p) !== 0x02014b50) throw new \InvalidArgumentException('El libro .xlsx está dañado (directorio del zip)');
            $nlen = self::u16($b, $p + 28); $xlen = self::u16($b, $p + 30); $clen = self::u16($b, $p + 32);
            $out[substr($b, $p + 46, $nlen)] = ['method' => self::u16($b, $p + 10), 'csize' => self::u32($b, $p + 20), 'off' => self::u32($b, $p + 42)];
            $p += 46 + $nlen + $xlen + $clen;
        }
        return $out;
    }

    /** contenido de una entrada del zip (sin comprimir o deflate) */
    private static function text(string $b, ?array $ent): string
    {
        if (!$ent) return '';
        if (self::u32($b, $ent['off']) !== 0x04034b50) throw new \InvalidArgumentException('El libro .xlsx está dañado (cabecera local)');
        $start = $ent['off'] + 30 + self::u16($b, $ent['off'] + 26) + self::u16($b, $ent['off'] + 28);
        $raw = substr($b, $start, $ent['csize']);
        if ($ent['method'] === 0) return $raw;
        if ($ent['method'] !== 8) throw new \InvalidArgumentException('El libro .xlsx usa una compresión que no se soporta');
        $d = @gzinflate($raw);
        if ($d === false) throw new \InvalidArgumentException('El libro .xlsx está dañado (no se puede descomprimir)');
        return $d;
    }

    /** entidades XML → texto (&amp; &lt; &#233; &#xE9;) */
    private static function unesc(string $s): string { return html_entity_decode($s, ENT_QUOTES | ENT_XML1, 'UTF-8'); }

    /** atributos de una etiqueta XML: ' r="A1" t="s"' → ['r' => 'A1', 't' => 's'] */
    private static function attrs(string $s): array
    {
        $o = [];
        if (preg_match_all('/([\w:.\-]+)\s*=\s*"([^"]*)"/', $s, $m, PREG_SET_ORDER)) foreach ($m as $x) $o[$x[1]] = self::unesc($x[2]);
        return $o;
    }

    /** texto de un fragmento con <t>…</t> (varios si es texto enriquecido); la fonética <rPh> no cuenta */
    private static function tText(string $xml): string
    {
        $xml = preg_replace('/<rPh\b[\s\S]*?<\/rPh>/', '', $xml);
        $s = '';
        if (preg_match_all('/<t(?:\s[^>\/]*)?>([\s\S]*?)<\/t>/', $xml, $m)) foreach ($m[1] as $t) $s .= self::unesc($t);
        return $s;
    }

    /** letras de columna → posición: A=0, Z=25, AA=26 */
    private static function colIndex(string $ref): int
    {
        $n = 0;
        if (preg_match('/^[A-Za-z]+/', $ref, $m)) foreach (str_split(strtoupper($m[0])) as $ch) $n = $n * 26 + (ord($ch) - 64);
        return $n - 1;
    }

    /** celdas de una hoja → filas (ver cabecera) */
    private static function sheetRows(string $xml, array $shared): array
    {
        $rows = [];
        if (!preg_match_all('/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/', $xml, $rm, PREG_SET_ORDER)) return $rows;
        foreach ($rm as $r) {
            if (empty($r[1])) continue;
            $row = [];
            $next = 0;
            if (preg_match_all('/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/', $r[1], $cm, PREG_SET_ORDER)) {
                foreach ($cm as $c) {
                    $a = self::attrs($c[1]);
                    $body = $c[2] ?? '';
                    $col = isset($a['r']) ? self::colIndex($a['r']) : $next;
                    $next = $col + 1;
                    $t = $a['t'] ?? '';
                    $hasV = preg_match('/<v>([\s\S]*?)<\/v>/', $body, $vm);
                    $v = $hasV ? $vm[1] : null;
                    $val = '';
                    if ($t === 'inlineStr') $val = preg_match('/<is>([\s\S]*?)<\/is>/', $body, $im) ? self::tText($im[1]) : '';
                    elseif ($v !== null) {
                        if ($t === 's') $val = $shared[(int) $v] ?? '';
                        elseif ($t === 'str' || $t === 'd') $val = self::unesc($v);
                        elseif ($t === 'b') $val = trim($v) === '1';
                        elseif ($t === 'e') $val = '';
                        elseif (trim($v) === '') $val = '';
                        elseif (is_numeric($v)) { $f = (float) $v; $val = (floor($f) == $f && abs($f) < 1e15) ? (int) $f : $f; }
                        else $val = self::unesc($v);
                    }
                    while (count($row) < $col) $row[] = '';
                    $row[$col] = $val;
                }
            }
            while ($row && end($row) === '') array_pop($row);
            foreach ($row as $c) { if ($c !== '') { $rows[] = array_values($row); break; } }
        }
        return $rows;
    }

    /** @return array<int,array{name:string,hidden:bool,rows:array}> */
    public static function read(string $bytes): array
    {
        $z = self::entries($bytes);
        $wb = self::text($bytes, $z['xl/workbook.xml'] ?? null);
        if ($wb === '') throw new \InvalidArgumentException('El fichero es un zip pero no un libro de Excel (.xlsx)');
        $rels = [];
        if (preg_match_all('/<Relationship\b([^>]*?)\/?>/', self::text($bytes, $z['xl/_rels/workbook.xml.rels'] ?? null), $m, PREG_SET_ORDER)) {
            foreach ($m as $x) { $a = self::attrs($x[1]); if (isset($a['Id'])) $rels[$a['Id']] = $a['Target'] ?? ''; }
        }
        $shared = [];
        if (preg_match_all('/<si(?:\s[^>\/]*)?>([\s\S]*?)<\/si>/', self::text($bytes, $z['xl/sharedStrings.xml'] ?? null), $m)) foreach ($m[1] as $si) $shared[] = self::tText($si);
        $sheets = [];
        if (preg_match_all('/<sheet\b([^>]*?)\/?>/', $wb, $m, PREG_SET_ORDER)) {
            foreach ($m as $x) {
                $a = self::attrs($x[1]);
                $target = $rels[$a['r:id'] ?? ''] ?? '';
                if ($target === '') continue;
                $target = $target[0] === '/' ? substr($target, 1) : 'xl/' . preg_replace('/^\.\//', '', $target);
                $sheets[] = ['name' => $a['name'] ?? '', 'hidden' => in_array($a['state'] ?? '', ['hidden', 'veryHidden'], true), 'rows' => self::sheetRows(self::text($bytes, $z[$target] ?? null), $shared)];
            }
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
