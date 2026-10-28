<?php
/** Pruebas del lector de .xlsx con los mismos libros y el mismo resultado esperado que la versión JavaScript (shared/xlsx/) */
namespace Torivac\Tests;

use Torivac\PriceSheet;
use Torivac\Xlsx;

/** Carpeta con los libros de ejemplo (solo existe en el repositorio completo). */
function xlsxDir(): ?string
{
    $d = __DIR__ . '/../../../shared/xlsx';
    return is_dir($d) ? $d : null;                                          // solo existe en el repositorio completo (no en el paquete del hosting)
}

/** Los dos libros de ejemplo dan las hojas, el orden, las ocultas y las filas esperadas. */
function test_xlsx_books_match_expected()
{
    $d = xlsxDir();
    if (!$d) { fwrite(STDERR, "  · xlsx: sin shared/xlsx (paquete suelto), se omite\n"); return; }
    $exp = json_decode(file_get_contents("$d/esperado.json"), true);
    foreach ($exp as $file => $want) {
        T::$name = "xlsx · $file";
        T::same($want, Xlsx::read(file_get_contents("$d/$file")), 'hojas, orden, ocultas y filas');
    }
}

/** Elección de hoja (primera visible con cabecera o por nombre) y paso del libro por las reglas de precios. */
function test_xlsx_pick_and_price_rules()
{
    $d = xlsxDir();
    if (!$d) return;
    $a = Xlsx::read(file_get_contents("$d/artesanal.xlsx"));
    T::same('Tarifa', Xlsx::pick($a)['name'], 'primera visible con cabecera (no «Notas», no la oculta)');
    T::same('Tarifa', Xlsx::pick($a, ' tarifa ')['name'], 'por nombre');
    T::throws(function () use ($a) { Xlsx::pick($a, 'Precios'); }, '/no tiene la hoja «Precios»/', 'hoja inexistente');
    T::throws(function () { Xlsx::pick([['name' => 'Notas', 'hidden' => false, 'rows' => [['hola']]]]); }, '/Ninguna hoja visible/', 'sin cabecera');
    $o = Xlsx::pick(Xlsx::read(file_get_contents("$d/tarifa-openpyxl.xlsx")));
    $r = PriceSheet::read($o['rows'], ['lines' => ['TT0150117EM' => ['n' => 'x', 'pid' => 884]], 'rules' => [['pattern' => '^TT\d{7,8}[A-Z]{0,3}$', 'pid' => 884]]]);
    T::same(37.0122, $r['items']['TT0150117EM']['p'], '8 decimales → 4');
    T::same(884, $r['items']['TT0330212']['pid'], 'referencia nueva por regla de familia');
    T::same(['ZZ999'], $r['unknown'], 'código desconocido fuera');
}

/** Un fichero que no es un libro Excel da un error claro. */
function test_xlsx_rejects_non_books()
{
    T::throws(function () { Xlsx::read("ref;price\nA;1\n"); }, '/no es un zip válido/', 'texto plano');
    T::throws(function () { Xlsx::read(str_repeat('x', 100)); }, '/no es un zip válido/', 'basura');
}

// ───────────────────────────────────────── sincronización de precios desde un .xlsx de Drive (Sheets::sync)
use Torivac\Config;
use Torivac\Http;
use Torivac\Sheets;
use Torivac\Store;

/** Contexto de catálogo de las pruebas de tarifa: dos referencias TT y la regla de la familia TT. */
function ttCtx(): array { return ['lines' => ['TT0150117EM' => ['n' => 'x', 'pid' => 884], 'TT0330212' => ['n' => 'x', 'pid' => 884]], 'rules' => [['pattern' => '^TT\d{7,8}[A-Z]{0,3}$', 'pid' => 884]]]; }

/** Sustituye la configuración de precios de las pruebas. */
function setPrices(array $p): void { Config::set(['prices' => $p, 'storage_dir' => Store::root(), 'session_secret' => SECRET]); }

/** Sincronización desde la URL de un .xlsx: referencias nuevas por regla y desconocidas fuera. */
function test_sync_from_xlsx_url()
{
    $d = xlsxDir();
    if (!$d) return;
    fresh();
    $asked = null;
    Http::$mock = function ($m, $u) use ($d, &$asked) { $asked = $u; return [200, file_get_contents("$d/tarifa-openpyxl.xlsx")]; };
    setPrices(['xlsx_url' => 'https://drive.test/uc?export=download&id=ABC']);
    $m = Sheets::sync(['reason' => 'test', 'ctx' => ttCtx()]);
    T::same('https://drive.test/uc?export=download&id=ABC', $asked, 'descarga la URL configurada');
    T::same(['xlsx-url', 3], [$m['source'], $m['refs']], 'origen y referencias (ZZ999 no encaja en ninguna familia)');
    $cur = \Torivac\Prices::load();
    T::same(37.0122, $cur['items']['TT0150117EM']['p'], '8 decimales → 4');
    T::same(884, $cur['items']['TT00302075']['pid'], 'referencia nueva dentro de su familia');
}

/** Hoja elegida por nombre y errores de descarga (nombre inexistente, página en vez de libro, HTTP 404). */
function test_sync_from_xlsx_sheet_name_and_bad_downloads()
{
    $d = xlsxDir();
    if (!$d) return;
    fresh();
    Http::$mock = function () use ($d) { return [200, file_get_contents("$d/artesanal.xlsx")]; };
    setPrices(['xlsx_url' => 'https://x.test/a.xlsx', 'sheet_name' => 'Tarifa']);
    T::same(1, Sheets::sync(['ctx' => ['lines' => ['TT0020210' => ['n' => 'x', 'pid' => 884]]]])['refs'], 'hoja elegida por nombre');
    setPrices(['xlsx_url' => 'https://x.test/a.xlsx', 'sheet_name' => 'Precios']);
    T::throws(function () { Sheets::sync(['ctx' => []]); }, '/no tiene la hoja «Precios» \(hojas: Notas & avisos, Oculta, Tarifa\)/', 'nombre inexistente lista las hojas');
    setPrices(['xlsx_url' => 'https://x.test/a.xlsx']);
    Http::$mock = function () { return [200, '<html>Inicia sesión</html>']; };
    T::throws(function () { Sheets::sync(['ctx' => []]); }, '/no es un zip válido.*compartido con enlace/', 'la URL devuelve una página, no un libro');
    Http::$mock = function () { return [404, 'no']; };
    T::throws(function () { Sheets::sync(['ctx' => []]); }, '/XLSX 404/', 'HTTP 404');
}

/** Cuenta de servicio: hoja de Google por Sheets API; si es un .xlsx de Drive, respaldo con la API de Drive y errores si fallan las dos. */
function test_sync_service_account_sheets_then_drive_fallback()
{
    $d = xlsxDir();
    if (!$d) return;
    fresh();
    $k = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    openssl_pkey_export($k, $pem);
    setPrices(['google_service_account' => ['client_email' => 'svc@proj.iam.gserviceaccount.com', 'private_key' => $pem], 'sheet_id' => 'FILE1']);
    $calls = []; $scope = null; $sheetsOk = true;
    Http::$mock = function ($m, $u, $h, $b) use (&$calls, &$scope, &$sheetsOk, $d) {
        $calls[] = $u;
        if (strpos($u, 'oauth2') !== false) { parse_str($b, $f); $scope = json_decode(\Torivac\Util::unb64url(explode('.', $f['assertion'])[1]), true)['scope']; return [200, '{"access_token":"tok"}']; }
        if (strpos($u, 'sheets.googleapis.com') !== false) return $sheetsOk ? [200, json_encode(['values' => [['ref', 'price'], ['R100', 5.5], ['P16633', 67.65], ['TT0020210', 12.37]]])] : [400, '{"error":{"status":"FAILED_PRECONDITION"}}'];
        if (strpos($u, 'drive/v3/files/FILE1?alt=media') !== false) return [200, file_get_contents("$d/tarifa-openpyxl.xlsx")];
        return [500, 'url inesperada ' . $u];
    };
    T::same('sheet:FILE1', Sheets::sync(['ctx' => []])['source'], 'hoja de Google → Sheets API');
    T::true(strpos($scope, 'spreadsheets.readonly') !== false && strpos($scope, 'drive.readonly') !== false, 'el token pide leer hojas y archivos de Drive');
    $sheetsOk = false; $calls = [];
    $m = Sheets::sync(['ctx' => ttCtx(), 'force' => true, 'mode' => 'replace']);
    T::same(['drive-xlsx:FILE1', 3], [$m['source'], $m['refs']], '.xlsx de Drive: Sheets falla y se descarga con la API de Drive');
    T::true(count(array_filter($calls, function ($u) { return strpos($u, 'sheets.googleapis.com') !== false; })) === 1 && count(array_filter($calls, function ($u) { return strpos($u, 'drive/v3/files/FILE1') !== false; })) === 1, 'probó Sheets y luego Drive');
    Http::$mock = function ($m, $u) { return strpos($u, 'oauth2') !== false ? [200, '{"access_token":"tok"}'] : [404, 'x']; };
    T::throws(function () { Sheets::sync(['ctx' => []]); }, '/Sheets API 404 · Drive API 404.*compartido con el correo de la cuenta de servicio/', 'ni Sheets ni Drive');
}
