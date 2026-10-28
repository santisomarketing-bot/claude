# Arquitectura del demo Torivac (contrato entre módulos)

Principios heredados de `whynot-sites` (ver `CLAUDE.md` de ese repo): salida **100 % estática**, **JS vanilla** progresivo
(la web se lee sin JS; el pedido necesita JS), tokens de diseño en CSS (nunca colores o fuentes a fuego en componentes),
accesibilidad AA, `alt` obligatorio, todo dato debe existir en el esquema.

**Regla de oro del proyecto:** el contenido es el de la web original (grupotorivac.com) tal cual; solo cambia el precio y la
experiencia de compra. Nada que no esté en la web o en un PDF verificado se publica: lo dudoso va a `data/catalog/proposals.json`
y se ve en el panel admin como *propuesta pendiente*.

## Flujo de datos

```
grupotorivac.com (solo lectura, GET)
   └─ scripts/harvest.mjs ─► data/raw/              (en bruto; html no se versiona)
        └─ scripts/prepare.py, map_translations.py ─► data/analysis/   (páginas limpias, mapa de traducciones, lotes)
             ├─ agentes S1 (productos, PDFs, páginas, diseño) ─► data/analysis/{products,pdfs,content,...}
             └─ scripts/build_catalog.py (S2) ─► data/catalog/*.json       ← ÚNICA fuente de verdad del sitio
                  └─ site/build.mjs (S3/S4) ─► dist/   (HTML estático por idioma + assets + JSON públicos)
```

## `data/catalog/` (salida de S2)

| Fichero | Contenido |
|---|---|
| `meta.json` | idiomas (`es` por defecto en la raíz; `en`,`fr`,`de` bajo `/en/`,`/fr/`,`/de/`), moneda `EUR`, `price_mode: "demo"`, fecha de generación, correos de destino del pedido |
| `categories.json` | árbol limpio: `{id, parent, order, slug:{es,en,fr,de}, name:{…}, description:{…}, image, url:{lang:path}, legacy_ids:[]}` |
| `products.json` | `{id, sku, slug:{…}, url:{lang:path}, name:{…}, short:{…}, description:{lang:[bloques]}, category_ids, images:[{src,alt:{…}}], voltage_tags:[id], power:{min,max,unit}, attributes, variants:[…], pdfs:[…], seo:{lang:{title,description}}, source_url:{lang}}` |
| `variants` (dentro de producto) | unidad **pedible**: `{ref, label:{…}, specs:{col:{raw,value,unit}}, voltage_tags, image, source:{type:"web"|"pdf", file, page}}` — la `ref` es la clave de precios |
| `voltage-tags.json` | `{id:"230V-AC", label, kind:"ac|dc|ac-dc|range|three-phase", min, max, unit, aliases:[], products:[ids]}` |
| `pages.json` | por idioma: empresa, proyectos, contacto, legales, blog (`{slug,title,date,image,blocks}`) |
| `proposals.json` | cambios dudosos para el admin: `{id, type:"web_vs_pdf|missing_translation|missing_data|typo", product_id, ref, field, web_value, pdf_value, evidence:{file,page}, status:"pending"}` |
| `prices.demo.csv` | hoja de precios **DEMO**: `ref,product_id,currency,unit,price,min_qty,tier2_qty,tier2_price,tier3_qty,tier3_price,note,updated_at` |
| `prices.json` | generado desde el CSV/Excel: `{updated_at, source, currency, items:{ref:{unit_price, tiers:[{min,price}], note}}}` |

Bloques de descripción: `{t:"p"|"h2"|"h3"|"ul"|"table"|"image"|"pdf", …}` (nada de HTML crudo del WordPress).

## `site/` (generador, S3/S4)

- `build.mjs`: lee `data/catalog`, escribe `dist/`. Plantillas Nunjucks en `site/templates/`. URLs idénticas a la web original (mismo slug, mismo prefijo de idioma) para conservar SEO.
- `site/assets/css/`: `tokens.css` (variables), `base.css`, `components.css`, `layout.css` (menú lateral fijo, flotantes), `art.css` (piezas gráficas) = aspecto **Clásico**; `ficha-tokens.css` + `ficha.css` = aspecto **Ficha técnica** (nuevo, por defecto); `fonts*.css` (fuentes). El generador los junta en un único `site.css` con dos capas (`@layer classic, ficha`): ver [`DISENO-TEMAS.md`](DISENO-TEMAS.md).
- `site/assets/js/` (cada módulo es un IIFE o ES module con cabecera de etiquetas, ver S15):
  - `i18n.js` — detección de idioma por navegador + selector manual, cookie `tv_lang` (S13)
  - `quote.js` — **motor del presupuesto/pedido**: líneas `{ref, qty}`, localStorage `tv_quote_v1`, API pública `TorivacQuote`
  - `prices.js` — carga `/data/prices.json`, aplica tramos y redondeo (céntimos), botón de actualización manual
  - `pdf.js` — genera el PDF del presupuesto en cliente con imágenes referenciales
  - `filters.js` — filtro por categoría, etiqueta de voltaje, potencia y búsqueda por referencia
  - `admin/*.js` — panel (login demo, vistas manager/cliente, subida CSV/XLSX, propuestas)
- `dist/` es la entrega demo: abrible con `python3 -m http.server` o publicable en cualquier hosting estático/Cloudflare Pages.

## Reglas de seguridad del demo

- Sin emails reales: "Enviar pedido" crea el borrador (`mailto:` + descarga de `.eml`/JSON) y registra el pedido en localStorage.
- El login del admin/cliente del demo es **solo de demostración** (sin backend): se avisa con un banner. El login real (PBKDF2 + sesión HMAC en un Worker) va en la Sesión 7 como en `whynot-sites/workers/admin`.
- Precios `price_mode: "demo"`: banner visible "Precios de demostración".

## Backends (producción)

La web estática habla con **un backend de contrato único** (`/api/health|prices|order|contact|auth/*|orders|prices/refresh|prices/upload|prices/ai|prices/ai/apply|proposals/state|users`, más `/api/diag` y `/api/cron` en PHP):

| | Worker de Cloudflare (`workers/api`) | API PHP para cPanel (`backend-php/api`) |
|---|---|---|
| Almacén | KV (`user:`, `order:`, `prices:…`) | ficheros JSON en `storage_dir` con la misma estructura de claves |
| Correo / IA / Drive | Resend, Anthropic, Google (fetch) | Resend, Anthropic, Google (cURL) |
| Cron de precios | trigger `0 3 * * *` | `php api/cron.php` (cPanel) o `GET /api/cron?token=` |
| Hojas de precios | `shared/price-sheet.mjs`, `shared/xlsx.mjs` | `lib/PriceSheet.php`, `lib/Xlsx.php` (ports con las mismas pruebas) |
| Pruebas de navegador | `node scripts/qa-*.mjs` | `node scripts/qa-*.mjs --php` (`scripts/lib/backends.mjs`) |

La compilación con API (**LIVE**: `--php-api` o `TORIVAC_API`) no lleva precios (los da el servidor) ni más de un destinatario en el código público. El paquete de cPanel se genera y verifica con `scripts/package_cpanel.py`.
