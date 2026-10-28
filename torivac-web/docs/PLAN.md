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

Estado: ✅ hecha y probada · 🟡 hecha en lo que no depende de terceros (se indica qué falta).

| # | Sesión | Entrega | Criterio de "hecho" | Estado |
|---|--------|---------|---------------------|--------|
| 0 | Desbloqueo | Dominio correcto y acceso | `grupotorivac.com` accesible; REST y sitemaps cosechados | ✅ |
| 1 | **Análisis profundo** | `data/raw`, `data/analysis`, `docs/01-analisis/` | 100 % de páginas, productos, PDFs y 4 idiomas inventariados; huecos y contradicciones listados; tokens de diseño extraídos | ✅ (hallazgos en `01-analisis/HALLAZGOS.md`) |
| 2 | Organización | `data/catalog/*.json` limpios + diccionario de datos | Cada producto con categoría limpia, 4 idiomas, PDFs vinculados y etiquetas de voltaje normalizadas | ✅ |
| 3 | Estructura | Esquema JSON + generador HTML + carrito/presupuesto funcional | Se puede armar un pedido con cantidades y "Enviar pedido" | ✅ |
| 4 | Estética y UX | Diseño final responsive, menú lateral, flotantes, PDF de presupuesto | Misma identidad que la web actual, mejor flujo de compra | ✅ |
| 5 | QA de punta a punta | Informe de pruebas | Presupuesto real (toroidales + resistencias + baquelitas) cuadra en los 4 idiomas, PDF y email | ✅ (`qa-quote`, `qa-live`) |
| 6 | Precios | Hoja de Drive ⇄ web, sync 24 h + botón manual, variaciones (incl. céntimos) | Cambiar un precio en la hoja se refleja en la web ≤ 24 h o al instante con el botón | ✅ (Excel/Hoja/CSV, 4 decimales, tarifa real) |
| 7 | Dashboard | Login + vista Manager + vista Cliente (Google Business, Ads, SEO, guías) | Dos roles con permisos distintos y datos reales conectados | 🟡 login, roles, pedidos, precios, usuarios y propuestas reales; **Estadísticas sin conectar** (faltan credenciales de Google) |
| 8 | Plataforma de presupuestos del cliente | Zona cliente: subir CSV/Excel → presupuesto con imágenes → PDF | Un cliente sube su lista y obtiene el PDF | ✅ |
| 9 | Contacto y legales | Formulario real y páginas legales en 4 idiomas | Mensaje llega a info@ y mzamora@ | ✅ (textos legales tal cual; 15 propuestas legales) |
| 10 | Control riguroso de UX y contenido | `qa-ux` (todas las páginas), contenido frente al original | Sin desbordes, imágenes rotas ni texto en otro idioma | ✅ |
| 11 | Verificar PDFs técnicos | Enlace producto ↔ PDF, contrastes, voltaje | Lo dudoso no se publica: va a Propuestas | ✅ (283 modelos pedibles; 116 propuestas) |
| 12 | Elementos gráficos | Osciloscopio del variador y arte toroidal, sin estilo genérico | Accesibles y con movimiento reducido | ✅ |
| 13 | Idioma | Detección por navegador + selector manual fiable | `qa-lang` | ✅ |
| 14 | QA final y entrega | Demo (doble clic) + paquete de pruebas para cPanel | Todas las suites en verde | ✅ |
| 15 | Documentación para programadores | Guía, convenciones e índice de código (cada archivo y cada función) | `gen_code_index.py --check` sin avisos | ✅ |
| 16 | Revisión final | Superar la versión de Why Not (SEO/GEO, rendimiento, a11y, calidad) | `seo_check`, `perf`, `qa-a11y` | ✅ |
| 17 | Despliegue en cPanel | Paquete `.zip` verificado, `.htaccess`, 404, noindex de pruebas, API PHP, CI | `qa-package.mjs` y `DESPLIEGUE-CPANEL.md` | ✅ (falta solo la primera subida a tu hosting) |
| 18 | Precios reales desde Drive | Formatos de hoja reales, decimales, referencias nuevas, lectura del `.xlsx` | `qa-tarifa.mjs` (Worker y PHP) | ✅ |
| 19 | Identidad visual «Ficha técnica» + aspecto Clásico | Aspecto nuevo por defecto (papel, tinta, cobre, Archivo extendida + Chivo Mono) y el actual como segunda opción, con selector; banderas de compilación; documentación | `qa-theme.mjs`, `qa-ux` y `qa-a11y` con los dos aspectos, [`DISENO-TEMAS.md`](DISENO-TEMAS.md) | ✅ (falta que Torivac elija cuál se publica) |
| 20 | Hosting con Plesk (pruebas) y cPanel (producción) | Elección segura de la carpeta de datos, IP real del visitante tras el nginx de Plesk (y sin poder falsearla), diagnóstico por servidor, guía [`DESPLIEGUE-PLESK.md`](DESPLIEGUE-PLESK.md) con el paso a cPanel y paquete con nombre neutro | `php tests/run.php` (`HostingTest.php`), `qa-live` / `qa-admin-live` / `qa-tarifa` con `--php`, `qa-package.mjs` | ✅ (falta la primera subida a tu Plesk) |

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

## Puntos que había que confirmar (resueltos)

1. **Correos de destino del pedido:** `info@grupotorivac.com` y `mzamora@torivac.com` — **confirmado** (info@ también para las pruebas).
2. **Hosting:** las pruebas van a un subdominio de **Plesk** (`torivac.santisomarketing.com`) y la producción irá a un **hosting con cPanel** (distinto del actual); por eso el API existe también en PHP y el mismo paquete vale para los dos. El Worker de Cloudflare queda como alternativa.
3. **Qué hacer con la web actual:** **no se toca**. Todo se prueba en un subdominio de pruebas (o con el demo); el cambio de DNS es el último paso.
4. **Hoja de precios:** un **Excel existente en tu Drive** («tarifa trafos» y «Torivac Precios»); se lee tal cual (`PRECIOS-DRIVE.md`).

## Convenciones

- Datos en bruto reproducibles: `node scripts/harvest.mjs` (HTML no se versiona, se regenera).
- Todo lo que sale de un PDF lleva referencia (archivo + página) y pasa por una verificación independiente antes de darse por bueno.
- Nunca se inventan datos de producto: lo que falta se lista como hueco, no se rellena.
