# Torivac · Web nueva con pedido tipo e-commerce — Plan por sesiones

> **Nombre y dominio reales:** la marca es **Torivac** y la web es **https://grupotorivac.com**
> (el brief inicial decía "Toriback", transcripción del dictado). WordPress + WooCommerce + Elementor +
> Yoast + WPML (ES · EN · FR · DE), hecha por Santiso Marketing. Catálogo de **presupuesto** (ningún producto tiene precio hoy).

## Qué se construye

Réplica del contenido de grupotorivac.com en los 4 idiomas, con la misma estética pero mejor experiencia:
menú lateral fijo, elementos flotantes (carrito/presupuesto, filtros), **pedido por cantidades** como en un e-commerce,
**etiquetas de voltaje** en los productos, envío del pedido por email, descarga del **presupuesto en PDF**,
precios desde una hoja de Drive (actualización cada 24 h + manual) y un **dashboard con login** (manager / cliente).

## Sesiones

| # | Sesión | Entrega | Criterio de "hecho" |
|---|--------|---------|---------------------|
| 0 | Desbloqueo | Dominio correcto y acceso | `grupotorivac.com` accesible; REST y sitemaps cosechados |
| 1 | **Análisis profundo** | `data/raw`, `data/analysis`, `docs/01-analisis/` | 100 % de páginas, productos, PDFs y 4 idiomas inventariados; huecos y contradicciones listados; tokens de diseño extraídos |
| 2 | Organización | `data/catalog/*.json` limpios + diccionario de datos | Cada producto con categoría limpia, 4 idiomas, PDFs vinculados y etiquetas de voltaje normalizadas |
| 3 | Estructura | Esquema JSON + generador HTML + carrito/presupuesto funcional | Se puede armar un pedido con cantidades y "Enviar pedido" |
| 4 | Estética y UX | Diseño final responsive, menú lateral, flotantes, PDF de presupuesto | Misma identidad que la web actual, mejor flujo de compra |
| 5 | QA de punta a punta | Informe de pruebas | Presupuesto real (toroidales + resistencias + baquelitas) cuadra en los 4 idiomas, PDF y email |
| 6 | Precios | Hoja de Drive ⇄ web, sync 24 h + botón manual, variaciones (incl. céntimos) | Cambiar un precio en la hoja se refleja en la web ≤ 24 h o al instante con el botón |
| 7 | Dashboard | Login + vista Manager + vista Cliente (Google Business, Ads, SEO, guías) | Dos roles con permisos distintos y datos reales conectados |

Cada sesión termina con commit + push a la rama de trabajo, para no perder nada si el entorno se recicla.

## Arquitectura propuesta (copiada de tus repos, sin proveedores nuevos)

Se reutiliza el patrón de **`whynot-sites`** (ya en producción) y del **CRM**:

| Pieza | Patrón de origen | En Torivac |
|-------|------------------|-----------|
| Web estática desde datos | `whynot-sites`: `data.json` + esquema Zod + plantilla Nunjucks + `tokens.css` + `build.js` | `data/catalog/*.json` → HTML por idioma. JS vanilla, funciona sin JS, AA, LCP < 2 s |
| SEO/GEO como contrato | `whynot-sites`: JSON-LD, `llms.txt`, sitemap con imágenes, `seo:check` | Se conserva el SEO de grupotorivac.com (títulos, metas, hreflang) y se mejora |
| Envío del pedido | `workers/forms` (Turnstile + email) y CRM (Resend) | Worker `orders`: valida, guarda, envía a info@ y mzamora@ y devuelve PDF |
| Precios 24 h + manual | CRM: cron triggers de Cloudflare Workers + D1 | Worker `prices`: cron diario lee la hoja de Drive; endpoint de refresco manual |
| Login manager / cliente | `workers/admin`: token master + sesión de usuario (PBKDF2 + cookie firmada HMAC) | `admin-panel` con dos vistas (manager / cliente) |
| Estadísticas | `workers/analytics`, `AEO-core` (informes), `GOOGLE-BUSINESS…`, `reports` | Dashboard agrega GBP, Google Ads, SEO y guías (S7) |

Reglas heredadas de `whynot-sites/CLAUDE.md`: salida 100 % estática, tokens de diseño (nunca colores a fuego),
accesibilidad AA, `alt` obligatorio, todo dato debe existir en el esquema.

## Puntos que necesito confirmados

1. **Correos de destino del pedido:** `info@grupotorivac.com` y el de mzamora. Asumo `mzamora@torivac.com`
   (el dictado dice "toriback.com"). Pruebas de envío solo a `info@grupotorivac.com` y **con tu OK antes de enviar**.
2. **Hosting:** propongo Cloudflare (Pages/Workers), como ya hacen `whynot-sites` y el CRM. Alternativa: seguir en el hosting actual del WordPress.
3. **Qué hacer con la web actual:** ¿sustituye a la de WordPress o convive (subdominio) mientras se valida?
4. **Hoja de precios:** ¿Excel ya existente en Drive o la creo yo con la estructura propuesta en la Sesión 6?

## Convenciones

- Datos en bruto reproducibles: `node scripts/harvest.mjs` (HTML no se versiona, se regenera).
- Todo lo que sale de un PDF lleva referencia (archivo + página) y pasa por una verificación independiente antes de darse por bueno.
- Nunca se inventan datos de producto: lo que falta se lista como hueco, no se rellena.
