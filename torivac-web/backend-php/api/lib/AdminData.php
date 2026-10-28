<?php
/**
 * [ADMIN-DATA] Datos de gestión que NO se publican en la web: las propuestas de cambio (incluidas las que señalan carencias legales) y los datos de cobertura del catálogo.
 * El build del sitio los escribe en generated/admin-data.json = {"proposals":[…],"admin":{"products":[…],"byRef":{…}}} y GET /api/admin/data los sirve SOLO a managers
 * (el token maestro cuenta como manager; clientes y anónimos no pasan). Si el fichero falta o está dañado se devuelven listas vacías, nunca un error.
 */
namespace Torivac;

final class AdminData
{
    /** Fichero alternativo (pruebas); null = generated/admin-data.json. */
    private static $file = null;

    /** Cambia el fichero de datos que se lee (pruebas); null vuelve al de generated/. */
    public static function setFile(?string $file): void { self::$file = $file; }

    /**
     * El contenido del fichero tal cual, con la forma garantizada: proposals (lista), admin.products (lista) y admin.byRef (objeto, aunque vaya vacío). Se decodifica a objetos
     * (no a arrays) para que un `byRef` vacío siga saliendo como {} y no como [].
     * @return array{proposals:array,admin:\stdClass}
     */
    public static function load(): array
    {
        $f = self::$file ?? (__DIR__ . '/../generated/admin-data.json');
        $j = is_file($f) ? json_decode((string) @file_get_contents($f), false, 64) : null;
        $props = is_object($j) && isset($j->proposals) && is_array($j->proposals) ? $j->proposals : [];
        $adm = is_object($j) && isset($j->admin) && is_object($j->admin) ? $j->admin : new \stdClass();
        if (!isset($adm->products) || !is_array($adm->products)) $adm->products = [];
        if (!isset($adm->byRef) || !is_object($adm->byRef)) $adm->byRef = new \stdClass();
        return ['proposals' => $props, 'admin' => $adm];
    }
}
