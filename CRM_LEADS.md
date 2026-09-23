# CRM propio — leads de Meta Ads, Google Ads y formularios web

Un CRM ligero y propio (sin HubSpot ni similares) que centraliza en un solo
sitio los leads que entran por **Meta Ads** (Facebook/Instagram Lead Ads),
**Google Ads** (formularios de generación de clientes potenciales) y
**formularios web** (la web de Santiso o las webs de clientes). Un panel
único para ver, buscar y mover cada lead por su pipeline, en vez de tenerlos
repartidos entre Meta Ads Manager, Google Ads y el buzón de cada web.

Código en [`crm/`](./crm). Sin frameworks ni base de datos externa: Node
puro + un fichero JSON como almacén (pensado para el volumen de una agencia,
no para alto tráfico).

## Arranque rápido

```bash
cp crm/.env.example crm/.env   # rellena CRM_USER / CRM_PASS como mínimo
npm run crm                    # arranca en http://localhost:8787
npm run crm:test               # prueba de humo end-to-end (no toca Meta/Google reales)
```

Sin `CRM_USER`/`CRM_PASS` el servidor arranca pero el panel y la API quedan
inaccesibles (avisa por consola). Los webhooks de entrada no usan Basic
Auth — cada uno se autentica a su manera (ver abajo).

## Arquitectura

```
crm/
  server.mjs           servidor HTTP (rutas, sin framework)
  lib/
    config.mjs          lee todo de variables de entorno
    schema.mjs           forma canónica de un lead + estados del pipeline
    store.mjs             almacén en crm/data/leads.json
    auth.mjs                Basic Auth del panel/API
    sources/
      meta.mjs           Meta Lead Ads: firma, handshake, Graph API, normaliza
      google.mjs         Google Ads Lead Form webhook: clave, normaliza
      webform.mjs        formularios web: clave por sitio, normaliza
  public/                dashboard (HTML/CSS/JS planos, sin build)
  test/smoke.mjs         prueba end-to-end de todas las rutas
  data/leads.json         (se crea solo; no se versiona — datos personales)
```

Todo lead, venga de donde venga, se normaliza a la misma forma (ver
`buildLead` en `crm/lib/schema.mjs`):

```js
{
  id, source: "meta"|"google"|"web", sourceId, site,
  receivedAt, status,              // nuevo · contactado · respondio · reunion · presupuesto · ganado · perdido
  contact: { name, email, phone, company },
  campaign: { ... },               // ids de campaña/anuncio/formulario según la fuente
  message, fields: { ... },        // resto de campos del formulario
  notes: [{ at, text }],
  raw: { ... }                     // payload original, para depurar
}
```

Los **estados del pipeline** son a propósito los mismos que ya se usan en el
checklist "Estado del lead" de las tareas de Jira (ver `JIRA_TEMPLATES.md`),
para hablar el mismo idioma en los dos sitios.

## 1) Meta Ads (Facebook/Instagram Lead Ads)

Meta no manda los datos del formulario directamente: avisa por webhook de
que hay un lead nuevo (`leadgen_id`) y hay que ir a buscarlo a la Graph API
con un token de página.

1. Crea (o usa) una app en [Meta for Developers](https://developers.facebook.com/apps).
2. Añade el producto **Webhooks**, objeto `page`, campo `leadgen`.
3. URL de callback: `https://TU-DOMINIO/webhooks/meta` · Verify token: el
   mismo valor que pongas en `META_VERIFY_TOKEN`.
4. Consigue un **Page Access Token** de larga duración con permiso
   `leads_retrieval` de la página que recibe los leads → `META_PAGE_ACCESS_TOKEN`.
5. Copia el **App Secret** de la app → `META_APP_SECRET` (se usa para
   verificar la firma `X-Hub-Signature-256` de cada aviso).
6. Suscribe la página al webhook (`/{page-id}/subscribed_apps`).

Si en algún aviso falla la llamada a la Graph API (token caducado, etc.), el
lead no se pierde: se guarda igualmente con `needsSync: true` y el
`leadgen_id` en `raw`, para reprocesarlo a mano.

## 2) Google Ads (formularios de clientes potenciales)

En Google Ads, cada campaña con extensión de formulario puede configurar
**entrega por webhook** (además o en vez del email/CRM integrado):

1. Herramientas → Configuración → **Integraciones de generación de clientes potenciales** → Webhook.
2. URL: `https://TU-DOMINIO/webhooks/google` · Clave: el mismo valor que
   pongas en `GOOGLE_ADS_WEBHOOK_KEY` (Google la manda de vuelta en cada
   envío como `google_key`, así se verifica que es Google quien llama).
3. Botón "Enviar solicitud de prueba" para comprobar que responde 200 antes
   de activarlo en campañas reales.

El mapeo de campos (`FULL_NAME`, `EMAIL`, `PHONE_NUMBER`, preguntas
personalizadas…) está en `crm/lib/sources/google.mjs`. El payload original
siempre se guarda en `raw`, así que si Google cambia algún nombre de campo
no se pierde información aunque el mapeo no lo reconozca todavía.

## 3) Formularios web

Cualquier formulario (la web de Santiso o la de un cliente) puede mandar el
lead con un simple `POST` a `/webhooks/web-form`. Admite JSON o
`application/x-www-form-urlencoded` (formularios HTML clásicos sin JS).

**Con JavaScript (fetch):**

```html
<form id="contacto">
  <input name="nombre" required />
  <input name="email" type="email" required />
  <textarea name="mensaje"></textarea>
</form>
<script>
document.getElementById("contacto").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  await fetch("https://TU-DOMINIO/webhooks/web-form", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": "clave-del-sitio" },
    body: JSON.stringify(body),
  });
  e.target.innerHTML = "<p>¡Gracias! Te contactamos en breve.</p>";
});
</script>
```

**Sin JavaScript (formulario clásico, ideal para WordPress):**

```html
<form action="https://TU-DOMINIO/webhooks/web-form?key=clave-del-sitio" method="POST">
  <input name="nombre" required />
  <input name="email" type="email" required />
  <input type="hidden" name="redirect" value="https://tuweb.com/gracias" />
  <button type="submit">Enviar</button>
</form>
```

Cada sitio tiene su propia clave en `WEBFORM_API_KEYS` (formato
`sitio1:clave1,sitio2:clave2`), así el dashboard sabe de qué web viene cada
lead. **Si `WEBFORM_API_KEYS` está vacío, el endpoint queda abierto** (sin
clave) — cómodo en desarrollo, pero configúralo antes de dar la URL a un
cliente. El endpoint acepta CORS (`WEBFORM_CORS_ORIGIN`, por defecto `*`)
para poder llamarse desde el navegador de cualquier web.

Campos reconocidos (nombre/email/teléfono/empresa/mensaje, en español o
inglés — ver `ALIAS` en `crm/lib/sources/webform.mjs`); cualquier otro
campo del formulario se guarda igualmente en `fields`. Se exige al menos
email o teléfono para aceptar el lead (si no, `422`).

## Dashboard

`https://TU-DOMINIO/` (Basic Auth con `CRM_USER`/`CRM_PASS`): resumen por
fuente/estado, tabla con filtros (fuente, estado, búsqueda libre), ficha de
detalle por lead con todos sus campos + notas, cambio de estado desde la
propia tabla o la ficha, y exportación a CSV respetando los filtros
activos.

## API

Todo bajo Basic Auth salvo `/health` y los `/webhooks/*`.

| Ruta | Qué hace |
|---|---|
| `GET /api/leads?source=&status=&q=&from=&to=&limit=&offset=` | Lista/filtra |
| `GET /api/leads/:id` | Detalle |
| `PATCH /api/leads/:id` `{status?, note?}` | Cambia estado / añade nota |
| `DELETE /api/leads/:id` | Borra (p. ej. solicitud de baja RGPD) |
| `GET /api/leads/export.csv` | Exporta (mismos filtros que el listado) |
| `GET /api/stats` | Totales por fuente y por estado |

## Desplegarlo

El servidor es un proceso Node normal (`npm run crm`) que necesita:

- Una **URL pública HTTPS** (Meta y Google no aceptan webhooks HTTP ni a
  `localhost`) — cualquier VPS, Render, Railway, Fly.io, etc. sirve.
- **Disco persistente** para `crm/data/leads.json` entre despliegues
  (si no, cambia `CRM_DATA_FILE` a un volumen persistente).
- Las variables de entorno de `crm/.env.example` configuradas en la
  plataforma elegida (no subas `crm/.env` a git; ya está en `.gitignore`).

No incluye script de despliegue porque depende de dónde se aloje; el propio
servidor no asume ninguna plataforma en concreto.

## Relación con el pipeline de Jira

El pipeline de leads de LinkedIn ya vuelca en Jira vía `jira-lead-templates.mjs`
(ver `JIRA_TEMPLATES.md`). Este CRM es la fuente de verdad para Meta/Google/web
y **hoy no crea tareas de Jira automáticamente** — el dato ya está todo en el
lead (contacto, campaña, mensaje) para copiarlo a mano si un lead se
convierte en oportunidad real de venta. Automatizar ese salto (botón
"Enviar a Jira" en la ficha del lead, reusando `construyeTareaLead`) es una
ampliación natural cuando convenga, sin tocar el modelo de datos actual.

## Datos personales

`crm/data/leads.json` guarda datos personales de terceros (nombre, email,
teléfono...) — por eso está en `.gitignore` y nunca debe subirse al
repositorio. Restringe el acceso al servidor/panel a quien lo necesite y
borra (`DELETE /api/leads/:id`) los leads cuando corresponda (p. ej. una
solicitud de supresión RGPD).
