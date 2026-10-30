# Google · Analytics 4, Google Ads y Search Console

Cómo mide la web, cómo se activa y qué se probó. **Estado de entrega: todo apagado** (sin IDs ni en el panel ni en `site/google.config.json`): la web no carga nada de Google y no enseña aviso de cookies.

**Dónde se configura (dos sitios).** Lo normal es el **panel: Ajustes → Google** (§11): el manager escribe el ID de Analytics, el de Ads y la etiqueta de cada conversión y la web lo aplica en unos minutos, **sin recompilar**. `site/google.config.json` queda como valor de arranque (y es el único sitio para la verificación de **Search Console**, que tiene que estar en el HTML que ve el robot). Si el panel tiene IDs, mandan sobre los del archivo.

## 0. Antes de activar: lo que ya mide la web actual (Google Tag Manager)

El informe de Santiso Marketing de mayo de 2026 dice que la web actual (WordPress) carga **Google Tag Manager `GTM-K93FKL89`** y que los formularios (WPForms) llevan seguimiento de conversiones. Es decir: GA4, las conversiones de Ads y lo que haya de remarketing **cuelgan de ese contenedor**, no de etiquetas puestas a mano en la web. Al publicar esta web en lugar de aquella, **si no se recoge lo mismo, las conversiones actuales dejan de contarse** y la campaña «Maximizar conversiones» se queda sin señal.

- **Camino implementado (A): etiquetas directas, con los MISMOS destinos.** Misma propiedad de GA4 (se conserva el histórico) y las **mismas acciones de conversión de Ads** (no hace falta crear otras: en Ads → Objetivos → Conversiones → la acción → *Etiqueta*, salen su ID y su etiqueta). La web envía `generate_lead` a GA4 y la conversión a Ads. Si en GA4 hay eventos clave o audiencias que dependen de un nombre de evento propio del contenedor (por ejemplo el que dispara WPForms), hay que decir cuál es para que el evento coincida (cambio de una línea en `consent.js`).
- **Camino alternativo (B): cargar el contenedor `GTM-K93FKL89` en la web nueva.** No está implementado a propósito: lo que haya dentro del contenedor (etiquetas HTML personalizadas, píxeles de terceros) puede chocar con la política de seguridad sin scripts en línea; sus disparadores de WPForms no existen en esta web; y el consentimiento tendría que repasarse dentro del contenedor. Si Torivac prefiere conservarlo, hay que revisar primero el contenedor.
- En cualquier caso, **no** dejar las dos cosas a la vez (el contenedor y las etiquetas directas): se contaría todo dos veces.

## 1. Qué hay

| Pieza | Dónde | Qué hace |
|---|---|---|
| Ajustes del panel | `site/assets/js/admin-google.js` + `GoogleSettings.php` / `workers/api/src/google.js` | Los IDs y etiquetas que escribe el manager; se guardan en el servidor y la web los lee en `GET /api/google` (§11). |
| Configuración de arranque | `site/google.config.json` | Los IDs **públicos** (salen en el código de cualquier web; no son claves) con los que se compila. Vacío = nada. Un ID mal escrito **detiene la compilación** con el motivo (un ID roto dejaría la medición muerta sin avisar). Search Console solo se configura aquí. |
| Módulo de compilación | `site/lib/google.mjs` | Valida los IDs, decide el modo (producción «live» / pruebas «test» / **`runtime`**: la compilación lleva el servidor y por eso incluye siempre todo el mecanismo apagado), calcula los orígenes de la CSP y la etiqueta de Search Console. |
| Aviso de cookies | `site/templates.mjs` (`cookieBar`) + `site/assets/js/consent.js` | Banda inferior sin bloquear la página: **Rechazar todas** y **Aceptar todas** con el mismo peso visual y **Configurar** para elegir por categoría. Va en el HTML oculto: sin JavaScript no sale y tampoco se mide nada. Con servidor lleva las dos categorías y los dos textos; `consent.js` enseña solo las que tienen ID. |
| Política de cookies | `site/lib/cookies.mjs` + `cookiePage` | Página propia en los 4 idiomas, **en la misma dirección que la de la web original** (`/politica-de-cookies/`, `/en/politica-de-cookies/`, …): la original era un *shortcode* de Complianz que no se puede copiar y esa dirección dejaría de existir. Con servidor lleva todas las secciones (`data-cookie-sec`) y `consent.js` deja visibles solo las que corresponden a lo configurado. |
| CSP | `site/lib/hosting.mjs` + `cspHosts()` | En producción **con servidor** abre siempre los dominios de Google (lo que se active desde el panel no puede quedar bloqueado); sin servidor, solo si hay IDs en el archivo. Solo en producción, nunca en pruebas. Sigue sin `unsafe-inline` ni `eval`. |
| Eventos | `TV.track()` en `consent.js`; llamadas en `quote-page.js` y `contact.js` | Solo **envíos completados** (presupuesto y contacto). |
| Pruebas | `scripts/qa-google.mjs` (en `qa-all.sh` y CI) | ~150 comprobaciones; `--real` además carga el `gtag.js` **de verdad**. |

## 2. Cómo se activa

**Con el panel (lo normal, sin recompilar):** conseguir los IDs (§3) → entrar en el panel como manager → **Ajustes → Google** → pegar el ID de Analytics, el de Ads y la etiqueta de cada conversión → **Guardar** → **Comprobar qué carga la web** → comprobar con la web publicada (§7). Un visitante lo recibe en la primera página de cada sesión (el navegador lo guarda 2 minutos). Para **apagarlo**: vaciar los campos y guardar. La etiqueta se puede pegar completa (`AW-123456789/AbCdEfGhIjK`) o solo la parte final.

**Con el archivo (valor de arranque, o si no hay servidor), 3 pasos:**

1. **Conseguir los IDs** (§3) y escribirlos en `site/google.config.json`:
   ```json
   {
     "ga4": "G-XXXXXXXXXX",
     "ads": "AW-123456789",
     "conversions": { "quote": "AW-123456789/AbCdEfGhIjK", "contact": "AW-123456789/LmNoPqRsTuV" },
     "searchConsole": { "meta": "token-de-la-etiqueta-meta", "htmlFile": "google0123456789abcdef.html" }
   }
   ```
   Todo es opcional y se puede poner por partes. Una conversión se puede escribir completa o solo con la etiqueta (`AbCdEfGhIjK`): se completa con el ID de Ads. Si solo hay conversiones completas, el ID de Ads se toma de ellas.
2. **Compilar y empaquetar producción**: `python3 -I scripts/package_cpanel.py --base=https://grupotorivac.com` (el empaquetador comprueba que producción no lleva IDs ficticios y que la CSP abre Google solo cuando toca).
3. **Subir el paquete** como siempre ([`ACTUALIZAR-SIN-ROMPER.md`](ACTUALIZAR-SIN-ROMPER.md)) y comprobar (§7).

Para **apagarlo**: vaciar los IDs y repetir 2-3.

> **Search Console va siempre al compilar** (no se puede cambiar desde el panel): su etiqueta tiene que estar en el HTML que ve el robot de Google sin ejecutar nada. Los IDs de Analytics y Ads sí se pueden cambiar desde el panel; los del archivo solo son el valor de arranque.

## 3. De dónde sale cada ID

- **GA4 (`G-…`)**: Analytics → Administrar → Flujos de datos → el flujo web de grupotorivac.com → *ID de medición*.
- **Google Ads (`AW-…`)**: cada acción de conversión se crea en Ads → Objetivos → Conversiones → *Nueva acción de conversión* → **Sitio web** → categoría *Enviar formulario de cliente potencial*. Crear **dos**: «Presupuesto enviado» y «Contacto enviado». En «Instalar la etiqueta con Google Tag» salen el **ID** (`AW-123456789`) y la **etiqueta de conversión** (`AbCdEfGhIjK`) de cada una. Contar **una** conversión por envío. No hace falta valor.
- **Search Console**: añadir la propiedad **«Prefijo de la URL»** `https://grupotorivac.com/` (no hace falta acceso al DNS; el DNS solo es necesario para la propiedad de «Dominio»). Método de verificación:
  - **Etiqueta HTML**: Google da `<meta name="google-site-verification" content="XXXX">`; se copia **solo** el valor de `content` en `searchConsole.meta`.
  - **Archivo HTML**: Google da un archivo `googleXXXXXXXXXXXXXXXX.html`; se escribe su nombre en `searchConsole.htmlFile` y la compilación crea el archivo con el contenido exacto que Google exige. Si hay dudas, la etiqueta meta es lo más cómodo.

  Después de subir, pulsar *Verificar* y enviar el sitemap: `https://grupotorivac.com/sitemap.xml` (hreflang e imágenes incluidos; solo existe en producción).
- **Vincular GA4 con Ads** (Analytics → Administrar → Vinculación de Google Ads) para ver en Analytics las campañas. **No** importar a Ads el evento `generate_lead` de GA4 *además* de las conversiones propias: se contaría dos veces.

El entorno de pruebas es `noindex`: **no** se verifica en Search Console ni mide nada.

## 4. Consentimiento (Consent Mode v2 «básico»)

- Al entrar, la web declara el consentimiento **por defecto en «denegado»** (`ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`), una lista en memoria sin ninguna petición.
- **Nada de Google se descarga hasta que la persona acepta.** «Rechazar» no carga nada y no vuelve a preguntar en 12 meses.
- Categorías: **Estadísticas** (GA4: `analytics_storage`) y **Publicidad** (Ads: `ad_storage`, `ad_user_data` y `ad_personalization`). Solo se ofrecen las que tienen ID. Las casillas opcionales empiezan **sin marcar**.
- La decisión se guarda en `localStorage` (`tv-consent`, 12 meses). El botón **«Configurar cookies»** del pie la reabre; es tan fácil retirar el permiso como darlo.
- **Retirar un permiso** ya en uso borra las cookies de Google (`_ga*`, `_gcl_*`, `_gac_*`, …) y recarga la página, para que `gtag.js` no siga cargado sin permiso.
- Dentro del panel (`?embed=1`) no hay aviso ni medición.
- Modo «básico» = quien rechaza **no aparece** en Analytics ni en Ads (sin modelado de conversiones). Es lo más prudente legalmente; si Torivac quiere el modo «avanzado» (pings sin cookies de quien rechaza, con modelado), es otro compromiso legal y hay que decidirlo con quien lleve lo legal.

## 5. Qué se mide

| Cuándo | GA4 (si hay permiso de Estadísticas) | Ads (si hay permiso de Publicidad y etiqueta) |
|---|---|---|
| Cada página | `page_view` (automático de `gtag`) | — |
| Presupuesto/pedido enviado | `generate_lead` con `lead_type: "quote"`, `items`, `language` | `conversion` con `send_to` = etiqueta de «presupuesto» y `transaction_id` = número del pedido (`TV-AAAAMMDD-…`: Google no la cuenta dos veces) |
| Mensaje de contacto enviado | `generate_lead` con `lead_type: "contact"`, `language` | `conversion` con `send_to` = etiqueta de «contacto» |

En la web **presupuesto y pedido son el mismo envío** (`POST /api/order`), por eso hay dos conversiones, no tres.

**No se mide ningún clic en teléfono, WhatsApp ni correo** (decisión de Torivac: no quieren fomentar esos canales). `TV.track` rechaza cualquier tipo de evento que no sea `quote` o `contact`, y `qa-google.mjs` lo comprueba pulsando esos enlaces.

## 6. La política de seguridad (CSP)

En **producción con servidor** (la compilación lleva el API y los IDs se editan en el panel) `cspHosts()` abre **siempre** los dominios de Analytics y Ads, aunque hoy no haya ID: así lo que el manager active después no queda bloqueado por la política. Sin servidor, solo se abre lo que tenga ID en `google.config.json`. En pruebas no se abre nada. Qué se abre:

- **Siempre que haya algo**: `script-src https://www.googletagmanager.com`; `connect-src`/`img-src https://*.googletagmanager.com`.
- **GA4**: `connect-src https://*.google-analytics.com https://*.analytics.google.com`; `img-src https://*.google-analytics.com`.
- **Ads**: `script-src https://www.googleadservices.com https://*.doubleclick.net https://www.google.com`; `connect-src https://*.doubleclick.net https://www.google.com https://pagead2.googlesyndication.com` y `https://www.google.{es,fr,de}`; `img-src` lo mismo más `https://www.googleadservices.com`; `frame-src https://*.doubleclick.net`.

Sigue sin `unsafe-inline` ni `eval`: los IDs van en un bloque `<script type="application/json">` (no se ejecuta) y `gtag.js` se pide como archivo. El primer intento con la lista de la documentación de Google **fallaba contra el Google real** (`ad.doubleclick.net/ccm/s/collect` quedaba bloqueado); `qa-google.mjs --real` lo detectó y por eso hay `*.doubleclick.net`.

**Si un día falla una conversión o la consola dice «Refused to … because it violates the following Content Security Policy directive»**: copiar el dominio bloqueado, añadirlo en `cspHosts()` (`site/lib/google.mjs`), recompilar y repetir `node scripts/qa-google.mjs --real`. Los países de Ads fuera de ES/FR/DE pueden usar otro `www.google.<país>` (lista `TLDS`).

## 7. Cómo comprobar que de verdad llega a Google (lo que **no** se puede probar desde aquí)

Las pruebas automáticas usan IDs inventados: comprueban que la web **manda** lo correcto, no que tu cuenta lo **reciba**. Con los IDs reales y la web publicada:

1. **Tag Assistant** (tagassistant.google.com) → conectar `https://grupotorivac.com` → aceptar las cookies → debe aparecer la etiqueta de Google con el ID de GA4 y el de Ads.
2. **GA4 → Informes → Tiempo real**: aceptar cookies, navegar → aparece 1 usuario. Enviar un contacto de prueba → evento `generate_lead`. En Administrar → Eventos, marcar `generate_lead` como **evento clave**.
3. **Ads → Objetivos → Conversiones**: tras un envío con cookies de publicidad aceptadas, la acción pasa de «Sin actividad reciente» a «Registrando conversiones» (puede tardar horas; solo cuenta si hubo clic previo en un anuncio, o lo registra como no atribuida).
4. **Search Console**: *Verificar*; después *Sitemaps* → añadir `sitemap.xml`.
5. Revisar con las herramientas del navegador (Aplicación → Cookies) los nombres y duraciones reales y compararlos con la tabla de `site/lib/cookies.mjs`. En Chromium real aparecen `_ga`, `_ga_<ID>` y `_gcl_au`; **`_gcl_aw` y `_gac_gb_<ID>` solo con clic de anuncio** (`gclid`) y no se pudieron ver aquí.

## 8. Entorno de pruebas

`--staging` compila en **modo «test»**: el aviso sale y se puede probar entero, `TV.track` anota en la consola (`[Google · prueba] …`), pero **no se descarga `gtag.js`, no sale ninguna petición a Google, la CSP no se abre y no hay verificación de Search Console**. Si el repositorio no tiene IDs, el paquete de pruebas se genera con IDs ficticios para poder ver el aviso: `package_cpanel.py --base=… --staging --google-demo` (con `--google-demo` sin `--staging` el compilador se niega; los IDs `G-DEMO000000` / `AW-0000000000` nunca llegan a producción: el empaquetador lo comprueba).

## 9. Textos que valida una persona (legal)

Escritos por el proyecto, **borrador**:

- Textos del aviso (`cookie_*` en `site/lib/i18n.mjs`; listados en [`TEXTOS-DE-INTERFAZ.md`](TEXTOS-DE-INTERFAZ.md) para validar por idioma).
- La **política de cookies** (`site/lib/cookies.mjs`, versión `2026-10`): 4 idiomas.
- La **política de privacidad** (texto de la web original, sin tocar aquí) debería mencionar, al activar la medición: Google (Analytics/Ads) como destinatario/encargado, **consentimiento** como base jurídica, la posible **transferencia a EE. UU.** (Google LLC está en el Marco de Privacidad de Datos UE-EE. UU.), el plazo de conservación de Analytics y cómo retirar el consentimiento (botón «Configurar cookies»). Y, si se activa el CAPTCHA (ver [`SEGURIDAD.md`](SEGURIDAD.md)), una línea sobre Cloudflare Turnstile.

## 10. Límites conocidos

- No se ha podido verificar contra **cuentas reales** (no hay IDs de Torivac accesibles desde aquí); sí contra el `gtag.js` real con IDs inventados (sin violaciones de la CSP; cookies `_ga`, `_ga_<ID>` y `_gcl_au` creadas).
- Modo «básico»: quien rechaza no se cuenta (ver §4).
- Un cambio en el panel tarda hasta ~3 minutos en llegar a un visitante (caché pública de 60 s del API + 2 min guardado en su navegador). Si aparece una categoría nueva (p. ej. se añade Ads donde solo había Analytics), `consent.js` **vuelve a preguntar**: lo aceptado antes no vale para una categoría que no se ofreció.
- Si el servidor no responde, `consent.js` usa los IDs de arranque de la compilación; si tampoco hay, no hace nada (la web nunca se rompe por esto).
- Los nombres y duraciones de cookies de Google son los documentados por Google; pueden cambiar.
- La verificación de Search Console por **Google Analytics o Tag Manager** no sirve aquí (la etiqueta solo carga tras aceptar cookies): usar la etiqueta meta o el archivo.

## 11. Ajustes en el panel (contrato de los dos servidores)

El manager configura Analytics, Ads y las conversiones en **Ajustes → Google · medición y conversiones** (`site/assets/js/admin-google.js`). Se guardan en el servidor (PHP: `Store` clave `settings:google`; Worker: KV `settings:google`; sin caducidad) y la web los lee en `GET /api/google`.

### `GET /api/google` — público
`200 { ok:true, google:{ ga4, ads, conv:{ quote, contact } } }` con cadenas (`''` = no hay). Solo contiene lo que sale en el código de cualquier web (IDs); `conv.x` es la etiqueta **completa** `AW-123456789/AbCdEfGhIjK` y solo si esa conversión está activada y hay ID de Ads. Sin nada guardado devuelve todo vacío. Cabeceras: `Cache-Control: public, max-age=60`, CORS como el resto de rutas públicas. Es de solo lectura: ningún límite de IP especial más allá del general.

### `GET /api/settings/google` — manager
`200 { ok:true, settings:{ ga4, ads, conversions:{ quote:{ label, on }, contact:{ label, on } }, updated:{ at, by } | null } }`. `label` es lo que se guardó (completa o solo la parte final); `on` es booleano (por defecto `true`). Un propietario (`client`) recibe 403 «Solo para managers».

### `PUT /api/settings/google` — manager
Cuerpo `{ ga4, ads, conversions:{ quote:{ label, on }, contact:{ label, on } } }` (≤ 5 KB; cualquier clave que falte se toma vacía/`on:true`; las claves desconocidas se ignoran). Validación (las mismas reglas que `site/lib/google.mjs`):

- `ga4`: vacío o `^(?:G|GT)-[A-Z0-9]{6,14}$` · `ads`: vacío o `^AW-\d{6,12}$`.
- `label`: vacío, o `AW-<id>/<etiqueta>` completa (`^(AW-\d{6,12})/([A-Za-z0-9_-]{8,40})$`), o solo `<etiqueta>` (`^[A-Za-z0-9_-]{8,40}$`). Solo la etiqueta exige `ads`. Completa con otro ID que `ads` → error. Si hay etiquetas completas y `ads` está vacío, `ads` se toma de ellas.
- `on`: booleano; cualquier otra cosa → 400.
- Error: `400 { ok:false, error:'<texto en castellano>', field:'ga4'|'ads'|'conversions.quote'|'conversions.contact' }`.
- Éxito: guarda con `updated = { at: ahora (ISO UTC), by: correo (o 'maestro') }` y responde `200 { ok:true, settings }` (ya normalizados). PHP: `Audit::log('settings.google', $who, $req, 'ga4=… ads=… conv=…')` (categoría de ajustes).
- Un propietario → 403; sin sesión → 401.

### Cómo lo usa la web
`consent.js` pide `GET /api/google` una vez por sesión (guardado 2 min), valida cada ID con la forma de Google y, si no hay ningún ID, **no hace nada**. Si el servidor no tiene IDs, valen los de arranque que lleva la página (`site/google.config.json`; en el paquete de pruebas, los ficticios de `--google-demo`). La política de seguridad de las compilaciones de producción con servidor abre siempre los dominios de Google (así lo que se active desde el panel no queda bloqueado); nada se carga hasta que la persona acepta.
