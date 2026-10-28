# Propuestas de mejora: editarlas, probarlas y aplicarlas

En el panel (**Propuestas**) están las 118 mejoras que se han detectado al revisar la web: textos legales con huecos o contradicciones, traducciones que faltan, texto en otro idioma, nombres que no coinciden con el PDF, modelos dudosos, fichas duplicadas… **Ninguna está publicada**: la web usa el dato original hasta que tú decides.

## Los tres pasos

1. **Escribe tu versión.** Cada propuesta se abre (clic en su título) y tiene un recuadro para TU texto: cómo debe quedar el párrafo, la traducción que falta o la decisión que tomas.
2. **Pruébala.** «Probar en la página» abre la **página real** con tu cambio puesto en su sitio y resaltado. Es solo una vista previa en tu pantalla: la web de verdad no cambia.
3. **Aplícala.** «Aplicar» guarda tu versión como **aprobada** en el servidor (y queda ahí aunque cierres el panel). «Descartar» la aparta con una nota; «Deshacer» la devuelve a pendiente.

> **Aprobar no publica nada por sí solo.** El texto aprobado entra en la web en la **siguiente actualización** (§3). Publicar al momento desde el panel está planificado para la sesión 21 (`SESION-21.md`).

## 1. Qué se puede hacer con cada tipo

| Tipo de propuesta | Qué escribes | «Probar» | Qué pasa al publicar |
|---|---|---|---|
| **Texto legal** con un trozo literal (frase rota, titular en blanco, «correodelcliente»…) y **texto en otro idioma**, **nombre** y **etiqueta de voltaje** | El párrafo entero como debe quedar | Sustituye ese párrafo en la página, resaltado | Se **sustituye** el párrafo en todas las páginas indicadas |
| **Texto legal** que solo describe un problema (faltan plazos, datos registrales…) | El párrafo nuevo (o elige «Solo guardar mi decisión») | Lo enseña al final de la página, resaltado | **Anotado** para quien lo coloque (el sitio exacto es una decisión legal) |
| **Traducción que falta** | La traducción de la descripción (nunca se traduce sola) | Pone tu traducción en la ficha de ese idioma y quita el aviso de «traducción pendiente» | La descripción de esa ficha en ese idioma pasa a ser tu texto |
| **Título SEO** de la portada | Una línea por idioma: `es: …`, `en: …`, `fr: …`, `de: …` (ya vienen rellenas) | Dibuja un resultado de búsqueda con tu título y su longitud | Cambia el `<title>` de las portadas (y con él `llms.txt`, el sitemap y las vistas previas al compartir) |
| **Decisiones** (PDF sin ficha, modelos dudosos, tabla distinta, fichas duplicadas, enlaces de traducción) | Tu decisión o el dato correcto (p. ej. la lista de modelos confirmados) | No tiene vista previa | **Anotado** para el equipo: es trabajo de catálogo, no un cambio de texto |

Detalles útiles:
- **«Traer el párrafo de la web»** abre la página, busca el párrafo que contiene el trozo indicado y lo pone entero en tu recuadro: así lo editas «en su sitio» en vez de escribirlo de cero.
- El recuadro **«Texto que hay ahora en la web»** basta con un trozo del párrafo; viene rellenado con la frase que cita la propuesta. Si «Probar» dice que no lo encuentra, ajusta ese trozo (tiene que aparecer tal cual en la página).
- **Textos legales:** revisa lo que apliques con quien lleve lo legal (asesoría). Aquí se puede poner cualquier texto, pero no se valida jurídicamente.
- **Traducciones:** escribe o pega tú la traducción (de una persona o de un traductor de tu confianza). La web **no traduce nada por su cuenta** ni reformula palabras: lo que apruebes es lo que se publica, tal cual.
- Los textos son **texto plano**: sin etiquetas HTML, código ni más de 2 enlaces, hasta 3000 caracteres (300 el trozo a sustituir, 500 la nota). Si no cumple, el panel lo dice junto al campo.
- Los filtros de arriba (Pendientes · Aprobadas · Descartadas · Todas, tipo y buscador) ayudan a trabajar por tandas; el buscador se confirma con Intro.

## 2. Descargar lo aprobado

Botón **«Descargar aprobadas»** (arriba de la lista): genera `propuestas-aprobadas-AAAA-MM-DD.json` con cada propuesta aprobada, su texto, su modo y las páginas donde se aplica. Es lo que se manda a quien mantiene la web (por ejemplo, adjuntándolo en el chat).

## 3. Publicarlo (quien mantiene la web)

```bash
node scripts/apply_proposals.mjs --file=propuestas-aprobadas-2026-10-28.json --dry    # comprueba sin guardar
node scripts/apply_proposals.mjs --file=propuestas-aprobadas-2026-10-28.json          # guarda data/catalog/proposals.applied.json
node scripts/test-proposals.mjs                                                        # pruebas
python3 -I scripts/package_cpanel.py --base=https://torivac.santisomarketing.com --staging   # paquete nuevo (o sin --staging en producción)
```
- Antes de guardar, `apply_proposals.mjs` **prueba cada propuesta sobre el catálogo real**: si el trozo a sustituir ya no está, o la página no existe, lo dice y no guarda (corrígela en el panel y vuelve a descargar; `--allow-missing` guarda el resto).
- Por defecto **mezcla** con lo que ya hubiera (por identificador). `--replace` deja el archivo exactamente como la descarga (así se deshace lo que ya no está aprobado).
- `site/build.mjs` aplica `proposals.applied.json` al compilar y lo cuenta: `[PROPUESTA] PR-57830 aplicada: página /aviso-legal-2/`. Todo lo escrito se **escapa** (nunca se convierte en HTML) y los JSON originales de `data/catalog` no se tocan: para volver atrás basta con borrar la entrada de `proposals.applied.json` y recompilar.
- Después se sube el paquete como cualquier otra actualización (`ACTUALIZAR-SIN-ROMPER.md`). Las propuestas aprobadas siguen apareciendo en el panel como «Aprobada con tu versión»; cuando la web ya las lleva, se pueden dejar así o deshacer.

## 4. Límites conocidos

- **No hay publicación instantánea** (sesión 21). La vista previa y la aprobación sí son inmediatas.
- La vista previa **no ejecuta scripts** (es un marco aislado): enseña el HTML de la página y tu cambio, sin menús ni precios dinámicos. Si el navegador avisa en la consola de «Blocked script execution», es por eso y es normal.
- **Un trozo que se repite** en varios párrafos: se sustituye el primero que lo contiene en cada página indicada; si hay dudas, alarga el trozo para que sea único.
- Si la web original o el catálogo cambian y el trozo desaparece, `apply_proposals.mjs` y la compilación lo avisan (no fallan en silencio).
- Dos managers editando la misma propuesta a la vez: gana el último que pulse «Aplicar».

## 5. Para quien programe

- **Servidor** (PHP y Worker, mismo contrato): `GET /api/proposals/state` → `{state: {id: {state: ok|no, by, at, mode?, text?, find?, note?}}}`; `POST /api/proposals/state` con `{id: "PR-12345", state: ok|no|"", mode?, text?, find?, note?}`. `mode` ∈ `replace · translate · title · add · note`. Los textos pasan el validador de texto plano (`shared/plain-text.mjs` → `lib/Proposals.php` / `src/proposals.js`), 400 con `code` y `field` si no valen. Solo managers.
- **Panel:** `site/assets/js/admin-proposals.js` (`TV.AdminProposals`: clases de propuestas, destinos, vista previa en un `iframe sandbox`, acciones y exportación). El panel recibe de `GET /api/admin/data` las propuestas y, por producto, categoría y portada, las rutas de las páginas (`paths`, `cats`, `homes`).
- **Aplicación:** `site/lib/proposals-apply.mjs` (`applyApproved`) la usan `site/build.mjs` y `scripts/apply_proposals.mjs`; el archivo `data/catalog/proposals.applied.json` es la fuente.
- **Pruebas:** `php backend-php/api/tests/run.php Proposals`, `cd workers/api && npm test`, `node scripts/test-proposals.mjs` y `node scripts/qa-admin-live.mjs [--php]` (sección 9: editar, probar, aplicar, descargar, rechazar, deshacer).
