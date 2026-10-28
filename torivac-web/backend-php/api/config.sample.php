<?php
/**
 * CONFIGURACIÓN DEL API DE TORIVAC (hosting con cPanel).
 *   1) Copia este fichero como config.php (en esta misma carpeta) y rellénalo.
 *   2) config.php NO se sube a ningún repositorio: contiene claves. Permisos recomendados: 640.
 * Cualquier valor puede darse también como variable de entorno TORIVAC_<CLAVE> (p. ej. TORIVAC_SESSION_SECRET, TORIVAC_MAIL_RESEND_API_KEY).
 */
return [
    // Dónde se guardan pedidos, usuarios y precios (ficheros JSON). Por defecto: «torivac-datos» en la carpeta personal de la cuenta de cPanel
    // (fuera de la web). Se crea sola. Puedes poner otra ruta, p. ej. '/home/CUENTA/torivac-datos'. Dentro de la web también funciona (se protege con .htaccess), pero no es lo ideal.
    'storage_dir' => (function_exists('posix_getpwuid') && function_exists('posix_geteuid') && ($pw = @posix_getpwuid(posix_geteuid())) && !empty($pw['dir']) ? $pw['dir'] : __DIR__ . '/..') . '/torivac-datos',

    // Clave para firmar las sesiones: ≥ 32 caracteres aleatorios (https://www.random.org/strings/). Cambiarla cierra todas las sesiones.
    'session_secret' => 'CAMBIA-ESTO-por-una-cadena-aleatoria-de-32-o-mas-caracteres',

    // Token maestro opcional (equivale a un manager) para scripts o para crear el primer usuario con curl. Vacío = desactivado.
    'admin_token' => '',

    // Otros orígenes que pueden llamar al API desde un navegador (la propia web siempre puede). Normalmente vacío.
    'allowed_origins' => [],

    // Quién recibe los pedidos y mensajes (confirmado por el cliente; info@ también para pruebas) y desde qué dirección se envían.
    'order_to' => ['info@grupotorivac.com', 'mzamora@torivac.com'],
    'order_from' => 'Torivac Web <pedidos@grupotorivac.com>',   // el dominio debe estar verificado en Resend (SPF/DKIM) si usas Resend

    'mail' => [
        // 'resend' (recomendado), 'mail' (función mail() del hosting) o 'none' (no enviar; el pedido se guarda igualmente)
        'driver' => 'resend',
        'resend_api_key' => '',
    ],

    'prices' => [
        // Hoja de precios en Drive. Tres formas (se usa la primera que esté rellena):
        //  A) cuenta de servicio de Google con acceso de lectura al archivo: ruta al .json (fuera de public_html) + id del archivo.
        //     Vale una hoja de Google (se lee 'sheet_range') o un Excel .xlsx subido a Drive tal cual (se lee la hoja 'sheet_name').
        'sheet_id' => '',
        'sheet_range' => 'Precios!A:O',
        'google_service_account' => '',        // '/home/CUENTA/torivac-datos/cuenta-servicio.json'
        //  B) un Excel .xlsx con descarga directa (Drive «cualquiera con el enlace puede ver»):
        //     https://drive.google.com/uc?export=download&id=<ID>   ·   hoja de Google como Excel: https://docs.google.com/spreadsheets/d/<ID>/export?format=xlsx
        'xlsx_url' => '',
        'sheet_name' => '',                    // hoja del libro; vacío = la primera visible con columnas de referencia y precio
        //  C) hoja de Google compartida «con enlace» exportada como CSV:  https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=0
        'csv_url' => '',
        // Decimales del precio unitario al importar (4 por defecto; máximo 6). El importe de cada línea siempre se redondea a 2.
        'decimals' => 4,
    ],

    // Instrucciones de precios en castellano (la IA propone; tú confirmas). Vacío = desactivado.
    'ai' => ['anthropic_api_key' => '', 'model' => 'claude-sonnet-5-5'],

    // Anti-spam opcional (Cloudflare Turnstile). Vacío = desactivado.
    'turnstile_secret' => '',

    // Para sincronizar precios con una URL si el hosting no permite cron por línea de comandos: https://dominio/api/cron?token=ESTE_VALOR
    'cron_token' => '',
];
