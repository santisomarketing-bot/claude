<?php
/**
 * CONFIGURACIÓN DEL API DE TORIVAC (hosting con Apache y PHP: cPanel, Plesk…).
 *   1) Copia este fichero como config.php (en esta misma carpeta) y rellénalo.
 *   2) config.php NO se sube a ningún repositorio: contiene claves. Permisos recomendados: 640.
 * Cualquier valor puede darse también como variable de entorno TORIVAC_<CLAVE> (p. ej. TORIVAC_SESSION_SECRET, TORIVAC_MAIL_RESEND_API_KEY).
 */
return [
    // Dónde se guardan pedidos, usuarios y precios (ficheros JSON). Déjalo VACÍO y se elige solo:
    //   «torivac-datos» en la carpeta personal de la cuenta (cPanel: /home/CUENTA/torivac-datos, FUERA de la web) y, si ahí no se puede crear (Plesk: la raíz de la
    //   cuenta suele ser de solo lectura para la web), api/storage, dentro de la web y protegida con .htaccess. Una carpeta que ya tiene datos no se abandona sola.
    //   El diagnóstico dice cuál se usa y avisa si cae dentro de la web.
    // Si prefieres una ruta concreta, escríbela (p. ej. '/home/CUENTA/torivac-datos' o, en Plesk, una carpeta fuera de la web que haya creado tu usuario o el
    //   administrador: '/var/www/vhosts/DOMINIO/torivac-datos'); si no se puede usar, se avisa y se elige otra. Para cambiar de carpeta con datos ya guardados, copia antes su contenido.
    'storage_dir' => '',

    // Clave para firmar las sesiones: ≥ 32 caracteres aleatorios (https://www.random.org/strings/) y que NO contenga «CAMBIA-ESTO». Si es más corta o es la del ejemplo, nadie
    // puede iniciar sesión (el acceso responde «Configuración insegura») y el diagnóstico lo marca en rojo. Cambiarla cierra todas las sesiones. Las sesiones duran 24 h.
    'session_secret' => 'CAMBIA-ESTO-por-una-cadena-aleatoria-de-32-o-mas-caracteres',

    // Token maestro opcional (equivale a un manager) para scripts o para crear el primer usuario con curl. Vacío = desactivado. Si lo pones, ≥ 32 caracteres aleatorios:
    // uno más corto queda DESACTIVADO (nunca vale) y el diagnóstico lo marca en rojo. Vacíalo cuando ya tengas tu usuario.
    'admin_token' => '',

    // Otros orígenes que pueden llamar al API desde un navegador (la propia web siempre puede). Normalmente vacío.
    'allowed_origins' => [],

    // IP real del visitante detrás de un proxy: se lee de X-Forwarded-For SOLO si quien conecta es la propia máquina, una red privada (el nginx de Plesk) o
    // Cloudflare; no hay que tocar nada. Añade aquí (IP o red, p. ej. '203.0.113.0/24') otro proxy tuyo con IP pública, si lo hubiera. Normalmente vacío.
    'trusted_proxies' => [],

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
    // Si lo pones, ≥ 24 caracteres aleatorios (uno más corto desactiva la URL). Vacío = la URL no existe. 10 intentos fallidos en 10 min desde una IP la bloquean un rato.
    'cron_token' => '',

    // COPIA DEL PRESUPUESTO AL CLIENTE. Cualquier visitante puede enviar un pedido, así que la copia solo lleva texto fijo del servidor (en el idioma del pedido), el número, las líneas
    // con el importe calculado por el servidor y el total; NUNCA lo que escribió el visitante (nombre, empresa, teléfono, notas) ni adjunto. El PDF del navegador solo va al equipo.
    //   'capped' (por defecto) = se envía con topes: 2 copias por destinatario cada 24 h y 'order_copy_daily_max' al día en total.
    //   'off' = nunca se envía copia al cliente.  Cualquier otro valor se trata como 'off' (falla cerrado).
    // Superado un tope, el pedido se guarda y se avisa al equipo igual; solo la copia no sale (la respuesta lo dice en emailed.customer_reason).
    'order_copy' => 'capped',
    'order_copy_daily_max' => 150,

    // Tope global de pedidos por hora (además del de 8 pedidos / 10 min por visitante): protege la cuota del correo (Resend) y el buzón del equipo. Superado: error 429.
    'orders_per_hour_max' => 120,
];
