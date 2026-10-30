# Sesión 21 · Ajustes en el panel, métricas de Google y actualizaciones fáciles

Estado: **planificada** (se hace en una sesión nueva, como se pidió). Este documento es el encargo: qué se construye, cómo, con qué condiciones de seguridad y cómo se sabrá que está hecho.

## 1. Qué se quiere

1. **Todo lo que falte configurar, en el panel del gestor**, sin editar archivos en el servidor.
2. **Métricas de Google** dentro del panel.
3. **Actualizar el código con facilidad**, sin miedo a romper lo publicado. (La parte de *cómo se hace hoy* ya está en [`ACTUALIZAR-SIN-ROMPER.md`](ACTUALIZAR-SIN-ROMPER.md); aquí se automatiza.)

Se hace en tres bloques con commit y entrega cada uno: **21a** ajustes, **21b** métricas, **21c** publicar con facilidad.

## 2. Inventario: qué se configura hoy y dónde pasará a estar

| Ajuste | Hoy (PHP · Worker) | En el panel (S21a) | ¿Secreto? |
|---|---|---|---|
| Destinatarios del pedido `order_to`, remitente `order_from` | `config.php` · `ORDER_TO`, `ORDER_FROM` | *Ajustes → Correo* | no |
| Clave de Resend + **«Enviar correo de prueba»** | `mail.resend_api_key` · `RESEND_API_KEY` | *Ajustes → Correo* | **sí** |
| Origen de precios: enlace del `.xlsx`, hoja, CSV, cuenta de servicio, decimales + **«Probar lectura»** | `prices.*` · `PRICE_*`, `GOOGLE_SERVICE_ACCOUNT` | *Ajustes → Precios* | cuenta de servicio: **sí** |
| IA de precios (clave de Anthropic, modelo) | `ai.*` · `ANTHROPIC_API_KEY`, `AI_MODEL` | *Ajustes → IA* | **sí** |
| Anti-spam (Turnstile: clave pública y secreta) | `turnstile_secret` · `TURNSTILE_SECRET` | *Ajustes → Seguridad* | secreta: **sí** |
| Clave del cron por URL | `cron_token` | *Ajustes → Precios* (se genera y se rota con un botón) | **sí** |
| Orígenes permitidos `allowed_origins` | `config.php` · `ALLOWED_ORIGINS` | *Ajustes → Seguridad* | no |
| Primer manager | `admin_token` + `curl` o `create-user.php` | asistente «Crear el primer manager» (pide el `admin_token` como código de instalación) | — |
| ¿Precios públicos o solo para registrados? (decisión pendiente) | fijo en código | interruptor en *Ajustes → Precios* | no |
| ID de medición de GA4, ID de Ads y etiquetas de conversión | `site/google.config.json` (al compilar) | ✅ **hecho**: *Ajustes → Google* (sin recompilar; [`GOOGLE.md`](GOOGLE.md) §11) | no (son IDs públicos) |
| Conexión con Google para **métricas** (cuenta de servicio, sitio de Search Console, informes de Looker Studio) | no existe | *Ajustes → Google* (21b) | cuenta de servicio: **sí** |

**Lo que se queda en `config.php`/variables del Worker, a propósito** (si el panel pudiera cambiarlo, un manager comprometido podría hacerse con el servidor): `storage_dir`, `session_secret`, `settings_key` (la clave con la que se cifran los secretos), `trusted_proxies`, `admin_token`. Son 5 líneas que se escriben una vez.

## 3. Cómo se hará

### 21a · Ajustes (mismo contrato en PHP y en Worker)
- **Almacén**: claves `settings:*` en el mismo almacén de siempre (ficheros JSON / KV). Un esquema por ajuste (tipo, longitud, formato de correo, rangos) valida todo en el servidor.
- **Secretos cifrados en reposo** (AES-256-GCM; `openssl` en PHP, WebCrypto en el Worker) con una clave propia `settings_key`, distinta de `session_secret` (cambiar la de sesiones no debe dejar los secretos ilegibles). Los secretos son **solo de escritura**: la API nunca los devuelve; el panel muestra «configurada · fecha · quién · huella» y un botón *Sustituir*/*Borrar*. Nunca van a los registros ni a los mensajes de error.
- **Precedencia**: lo fijado en `config.php`/variables del Worker **manda** y el panel lo enseña con un candado («fijado en el servidor»); si no, vale lo del panel; si no, el valor por defecto. Así quien administra el servidor siempre puede bloquear algo.
- **Historial** de cambios (quién, cuándo, qué ajuste; **nunca valores**) en *Ajustes → Historial*.
- **Botones «Probar»** que usan el ajuste que se acaba de guardar y dicen exactamente qué falló: correo de prueba (solo a la dirección del propio manager), lectura de la hoja de precios (cuenta filas y enseña tres referencias), llamada mínima a la IA, consulta mínima a Google.
- **API**: `GET /api/settings` (valores no secretos y estado de los secretos), `PUT /api/settings` (parcial), `POST /api/settings/test/<tipo>`, `GET /api/settings/history`. Solo managers.

### 21b · Métricas de Google
- **Fase 1, con la misma cuenta de servicio que ya lee Drive**: **Search Console** (consultas, clics, impresiones, CTR y posición) y **GA4** (usuarios, sesiones, páginas más vistas) por sus APIs de solo lectura. El gestor añade el correo de la cuenta de servicio como lector en GA4 y en Search Console, pega el ID de la propiedad y la URL del sitio, y pulsa *Probar*. El servidor consulta **una vez al día** (el mismo cron de los precios) y guarda instantáneas agregadas (sin datos personales); el panel las dibuja con gráficos propios en SVG, sin librerías ni cookies de terceros, en el estilo de «Ficha técnica».
- **La etiqueta de GA4 y de Ads ya existe** (sesión 27, [`GOOGLE.md`](GOOGLE.md)): aviso de cookies, Consent Mode v2 y conversiones de presupuesto y contacto; se activa con los IDs de `site/google.config.json`. Esta sesión solo **lee** las métricas por API (no añade etiquetas). Quien rechaza las cookies no sale en Analytics, así que además se contarán en el servidor, sin cookies, **pedidos, mensajes de contacto y descargas de presupuesto** por día e idioma, para tener una cifra que no depende del consentimiento.
- **Fase 2, Google Business Profile y Google Ads**: sus APIs piden un acceso aprobado por Google y la autorización de la cuenta que administra la ficha (OAuth), no una cuenta de servicio. Hasta tenerlo, alternativa inmediata: **incrustar informes de Looker Studio** (se pega la URL en *Ajustes → Google*; quien los ve necesita acceso en Google; la CSP solo admite ese dominio en `/admin/`).
- Todo lo anterior son **supuestos a confirmar con una prueba real** al empezar la sesión (permisos, cuotas, formato de las respuestas).

### 21c · Publicar con facilidad
- **Versión visible**: el Diagnóstico y el pie del panel enseñan la versión instalada (ya se escribe en `api/generated/build.json`), y avisan si el paquete se compiló para otro dominio que el que lo sirve.
- **Una sola orden de publicación** (`bash scripts/publicar.sh pruebas|produccion`, y el mismo flujo en GitHub): pruebas → paquete verificado → copia de seguridad del servidor en una carpeta fuera de la web → subida con simulacro y confirmación → **comprobaciones de humo contra la URL real** (`scripts/smoke-live.mjs`: salud, cabeceras, huellas de CSS/JS, `robots`, ficha con precio, API cerrada a ficheros de código) → **vuelta atrás automática** si fallan.
- **Volver atrás con un comando** (`bash scripts/publicar.sh volver`): restaura el paquete anterior guardado en el servidor.
- **`--allow-ip`** en el paquete de pruebas, para que la restricción por IP no se pierda al regenerar el `.htaccess`.
- **El panel no se actualiza a sí mismo**: que una web pueda reescribir su propio código es una puerta que no se abre. Las actualizaciones las dispara una persona.
- Más adelante (opcional, no en esta sesión): cambios de texto desde el panel que abren una propuesta revisable en GitHub y se publican en pruebas sin tocar código.

## 4. Condiciones de seguridad (la sesión no se da por buena sin ellas)
- Solo managers; cambiar o borrar un secreto pide **repetir la contraseña** (sesión reciente).
- **Anti-SSRF** en todo ajuste que sea una URL (enlace del `.xlsx`, CSV): solo `https`, solo `drive.google.com`, `docs.google.com` y `*.googleusercontent.com`, sin IP privadas ni locales, sin seguir redirecciones a otros dominios, con tamaño y tiempo máximos. Hoy esas URL solo las escribe quien administra el servidor; al pasar al panel hay que cerrar esa vía.
- Validación estricta en servidor; límites de intentos en cambios y en pruebas; las pruebas «Probar» tienen un tope por hora (para no usar el servidor como lanzador de correos o de consultas).
- Los secretos no aparecen en respuestas, registros, historial, errores, copias de `build.json` ni en el paquete (el escáner de secretos y `package_cpanel.py` lo vigilan).
- Pruebas negativas: un cliente (rol `client`) y un visitante no pueden leer ni cambiar ajustes; un secreto no se recupera por ninguna ruta; una URL fuera de la lista se rechaza; un ajuste fijado en el servidor no se puede cambiar desde el panel.
- Revisión independiente de seguridad al terminar 21a (sin conocer mi análisis), como la de [`SEGURIDAD.md`](SEGURIDAD.md).

## 5. Criterios de «hecho»
- **21a**: se puede dejar el servidor con solo las 5 líneas de §2 en `config.php` y configurar el resto desde el panel, con los botones *Probar* en verde; Worker y PHP pasan las mismas pruebas; `qa-admin-live` (ambos backends) cubre ajustes, secretos solo-escritura, candado y historial.
- **21b**: con una propiedad real de Search Console y una de GA4, el panel enseña cifras reales de los últimos 28 días y las instantáneas diarias se guardan solas; sin credenciales, enseña qué falta y no inventa cifras.
- **21c**: `publicar.sh` hace un ciclo completo pruebas → producción y una vuelta atrás en un entorno de ensayo; `smoke-live.mjs` falla a propósito cuando se estropea algo (cabecera ausente, huella equivocada, API abierto).
- En los tres: pruebas de PHP y del Worker en verde, `qa-all` en verde, documentación y entrega como en las sesiones anteriores.

## 6. Qué hace falta de Torivac / decisiones
1. **Analítica**: decidido: GA4 y Ads con aviso de cookies ([`GOOGLE.md`](GOOGLE.md)). Queda decidir si el panel enseña también los contadores del servidor (sin cookies).
2. **Accesos de lectura** para el correo de la cuenta de servicio: Search Console (propiedad de grupotorivac.com) y GA4 (si se usa), y el ID de la propiedad. Si ya existe un informe de Looker Studio, su enlace.
3. **Google Business Profile y Ads**: ¿quién administra la ficha y la cuenta? ¿Informe incrustado ahora y API más adelante?
4. **Quién ve las métricas**: hoy hay dos roles (manager y client = compradores). ¿Solo managers, o un rol nuevo «propietario» para el equipo de Torivac?
5. **Precios públicos o solo para registrados** (el interruptor se construye en 21a; falta decidir el valor).
6. **Dónde se publica** (Plesk → cPanel): si hay SSH, la publicación guiada de 21c funciona completa; sin SSH, se genera el paquete y la subida es manual con las mismas comprobaciones.

## 7. Riesgos
| Riesgo | Mitigación |
|---|---|
| El panel guarda secretos de terceros | Cifrado en reposo, solo escritura, historial sin valores, precedencia con candado, revisión independiente |
| Las APIs de Google cambian o limitan | Instantáneas diarias (pocas llamadas), errores claros, sin cifras inventadas cuando falla |
| Que la analítica rompa el rendimiento o el RGPD | Fase 1 sin etiquetas ni cookies; GA4 solo si Torivac lo decide, con aviso de cookies |
| Que «actualizar fácil» abra una puerta | Nada se actualiza desde la web; la persona dispara, el sistema verifica y puede volver atrás |
