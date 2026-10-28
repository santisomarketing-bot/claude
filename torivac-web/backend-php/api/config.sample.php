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
    // Remitente: «Nombre <correo@dominio>». Con SMTP debe ser una dirección del propio buzón (o que el servidor deje usar); con Resend o Brevo, de un dominio/remitente VERIFICADO en ese servicio.
    'order_from' => 'Torivac Web <pedidos@grupotorivac.com>',

    // CORREO. Cómo se envían los avisos de pedidos y mensajes. Elige UNO en 'driver':
    //   'smtp'   → el buzón de correo de tu propio dominio (RECOMENDADO en Plesk y cPanel: no depende de ningún servicio externo). Rellena 'smtp' más abajo.
    //   'brevo'  → API de Brevo (clave API v3: Brevo → SMTP y API → Claves API). El remitente de order_from tiene que estar verificado en Brevo (Remitentes y dominios).
    //   'resend' → API de Resend. El dominio de order_from tiene que estar verificado en Resend (SPF y DKIM).
    //   'mail'   → la función mail() del hosting: el servidor local la acepta pero NO garantiza que llegue (puede perderse o ir a spam y aquí no hay forma de saberlo). Solo como último recurso.
    //   'file'   → pruebas: guarda cada correo en la carpeta de datos (outbox) y NO lo envía.
    //   'none'   → no envía nada (los pedidos y los mensajes de contacto se guardan igualmente y se ven en el panel).
    // Para saber si funciona: panel → Ajustes → Correo → «Enviar correo de prueba» (te dice el motivo exacto si falla) o /api/health. Para que no vaya a spam, el dominio de order_from
    // necesita SPF y DKIM (SPF: qué servidores pueden enviar por él; DKIM: la firma): en Plesk, Correo → Ajustes; en cPanel, «Entregabilidad de correo» (Email Deliverability).
    'mail' => [
        'driver' => 'smtp',
        // SMTP — Plesk: crea el buzón (Correo → Crear dirección de correo, p. ej. pedidos@grupotorivac.com). Servidor: normalmente mail.TUDOMINIO.com (o el nombre del servidor que sale en Correo →
        //   Ajustes); puerto 587 con STARTTLS ('tls') o 465 con SSL ('ssl'); usuario = la dirección completa y su contraseña.
        // SMTP — cPanel: «Cuentas de correo → Conectar dispositivos» muestra el servidor (mail.TUDOMINIO.com), 465 (SSL) y 587 (TLS) y el usuario = la dirección completa.
        // secure: 'tls' (587, STARTTLS), 'ssl' (465, cifrado desde el primer byte) o 'none' (25, sin cifrar: solo hacia la propia máquina). La contraseña NUNCA se envía sin cifrar a otro servidor.
        // El certificado del servidor SE VERIFICA. Si sale «certificate verify failed» porque el certificado es de otro nombre (p. ej. conectas a localhost pero es de mail.midominio.com), pon en
        //   'tls_name' el nombre del certificado; solo como último recurso 'insecure_tls' => true (no verifica nada: el diagnóstico lo marca con un aviso).
        'smtp' => [
            'host' => '',                    // p. ej. 'mail.grupotorivac.com'
            'port' => 587,
            'secure' => 'tls',               // 'tls' | 'ssl' | 'none'
            'user' => '',                    // p. ej. 'pedidos@grupotorivac.com'
            'pass' => '',
            // 'tls_name' => 'mail.grupotorivac.com',
            // 'insecure_tls' => false,
            // 'helo' => 'grupotorivac.com',   // con qué nombre se presenta; vacío = el del servidor web
            // 'timeout' => 15,                // segundos para toda la conversación (3..60)
        ],
        'brevo_api_key' => '',
        'resend_api_key' => '',
    ],

    // Antispam de los formularios: milisegundos mínimos entre cargar la página y pulsar enviar (el navegador manda `_e`). Un bot que envía sin cargar la página queda fuera.
    // 1200 por defecto; 0 = no se exige. Los formularios (contacto y pedido) además solo admiten texto plano y con límite de caracteres (ver PlainText.php).
    'form_min_fill_ms' => 1200,

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

    // VERIFICACIÓN EN DOS PASOS POR CORREO (solo managers). Con la contraseña buena, se envía un código de 6 cifras al correo de la cuenta (vale 10 minutos) y hay que escribirlo para entrar. Marcando
    // «recordar este dispositivo» no se vuelve a pedir en ese navegador durante `remember_days`. Solo se pide si el correo de arriba está completo (si no, nadie se queda fuera).
    //   enabled       true (por defecto) = se pide a los managers; false = no se pide de rutina. EMERGENCIA (el correo falla y no puedes entrar): pon enabled y on_attack en false, entra, arregla el correo y vuelve a ponerlos en true.
    //   remember_days 30 por defecto (1 a 90; 0 = no se ofrece recordar el dispositivo).
    //   exempt        correos que NO piden código de rutina (cuentas de confianza, p. ej. la tuya como administrador): ['tu@correo.com']. También se marca en Panel → Usuarios, casilla «Código por correo». Bajo ataques repetidos (on_attack) también ellas lo piden en dispositivos nuevos.
    //   on_attack     true (por defecto) = si una cuenta (también una de confianza) suma 3 bloqueos en 24 h, se avisa por correo (UNA vez al día) y esa cuenta pide el código en dispositivos nuevos durante 7 días.
    'two_step' => [
        'enabled' => true,
        'remember_days' => 30,
        'exempt' => [],
        'on_attack' => true,
    ],

    // Quién recibe el aviso de intentos repetidos contra una cuenta (solo se envía si el patrón se repite). Vacío = los mismos que reciben los pedidos (order_to).
    'alert_to' => [],

    // COPIAS DE SEGURIDAD de los datos (pedidos, mensajes, usuarios, precios, propuestas, blog e imágenes). Una por semana, sola, y se guardan las 8 últimas en <carpeta de datos>/backups.
    // Se bajan desde Panel → Ajustes → Copias de seguridad. Para restaurar: php api/tools/restore.php archivo.jsonl.gz (ver docs/SEGURIDAD.md).
    //   auto  true (por defecto) = la copia semanal se hace sola · media  true (por defecto) = con las imágenes del blog.
    'backup' => ['auto' => true, 'media' => true],

    // CAPTCHA invisible opcional (Cloudflare Turnstile, gratuito; NO hace falta pasar la web a Cloudflare): dash.cloudflare.com → Turnstile → Añadir sitio → tu dominio → modo «Gestionado» (o «Invisible»). Pon LAS DOS claves o ninguna:
    //   turnstile_sitekey = la clave del sitio (pública: la ve cualquiera, va en la página) · turnstile_secret = la clave secreta (NUNCA fuera de este archivo). Solo el secreto sin la clave pública bloquearía los formularios.
    // Nada más que hacer: los formularios cargan el CAPTCHA solos cuando las dos están puestas (Ajustes → Diagnóstico lo confirma). Vacías = apagado. Guía y nota de privacidad: docs/SEGURIDAD.md §14.
    'turnstile_sitekey' => '',
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
