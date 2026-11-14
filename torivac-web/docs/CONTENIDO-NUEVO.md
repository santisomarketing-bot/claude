# Contenido nuevo (plan 2027): solo se publica lo aprobado

Páginas que **no existen en la web original** (fabricación a medida, OEM…) y que Torivac y Santiso Marketing deciden añadir. El contenido original sigue intacto: esto es un archivo aparte, con su propio flujo de aprobación.

## La regla

> Una versión de una página nueva solo entra en la web cuando está **aprobada**, y aprobarla exige **quién**, **con qué función** y **cuándo**.

| Idioma | Función con la que se aprueba | Condición |
|---|---|---|
| Castellano | **comercial**: da el visto bueno a las afirmaciones y a las condiciones | — |
| EN, FR, DE | **traductor**: valida la traducción | El castellano ya debe estar aprobado |

**Una sola persona hace las dos funciones**: el usuario **Revisor** (rol `reviewer`). Se crea desde el panel (*Usuarios → Nuevo usuario → Rol: Revisor*), sin tocar código; la función («comercial» o «traductor») la decide el idioma que aprueba, y queda anotada junto a su nombre y la fecha.

Lo que no esté aprobado **no sale en la web, ni en el sitemap, ni en el selector de idioma, ni en `llms.txt`**. Una versión aprobada no declara `hreflang` hacia una traducción que aún está en borrador.

## Dónde está y cómo se ve

Una página por archivo, en `data/content-new/<id>.json`:

```json
{
  "id": "a-medida",
  "slug": { "es": "/fabricacion-transformadores-a-medida/", "en": "/en/custom-transformer-manufacturing/" },
  "notes": ["lo que queda pendiente de confirmar (no se publica)"],
  "langs": {
    "es": { "status": "borrador", "title": "…", "meta_description": "…", "h1": "…", "lead": "…",
            "sections": [{ "h2": "…", "p": ["…"] }], "cta": [{ "label": "…", "href": "/contacto/" }] }
  }
}
```

- El contenido es **texto plano**: ninguna etiqueta HTML (el generador lo escapa).
- `title` de 65 caracteres como máximo; `meta_description` entre 50 y 160.
- Los enlaces de los botones se escriben con la ruta en castellano (`/contacto/`) y el generador los lleva a la versión del idioma de la página (`/en/contact/`).
- Rutas reservadas (`/product/`, `/categoria-producto/`, `/admin/`, `/api/`, `/blog/`…) y rutas que ya existen: rechazadas.

Para **aprobar** una versión se cambia `"status": "aprobado"` y se añade quién la aprueba:

```json
"status": "aprobado",
"approval": { "by": "Nombre y apellidos", "role": "comercial", "at": "2026-11-20" }
```

La compilación se **detiene con un error claro** si falta algo (quién, función, fecha), si el texto lleva etiquetas, si una traducción se aprueba antes que el castellano, o si dos páginas usan la misma ruta.

## El panel «Contenido nuevo» (manager y Revisor)

Menú lateral → **Contenido nuevo** (`site/assets/js/admin-newcontent.js`, rutas `/api/newcontent/…` en `backend-php/api/lib/NewContent.php`). Solo existe en el servidor PHP (el Worker de Cloudflare responde 501 y el panel lo explica).

| Quién | Qué puede hacer |
|---|---|
| **Manager** | Ver los borradores y su estado, **proponer cambios**, ver el registro y **descargar** lo aprobado para anotarlo en los archivos |
| **Revisor** | Lo mismo salvo descargar, y además **aceptar o descartar** las propuestas, **aprobar** y **retirar la aprobación** |
| Propietario, cliente y visitantes | Nada (403). El Revisor, a su vez, solo llega a esta sección: la API le niega presupuestos, precios, clientes, mensajes y ajustes |

Flujo:

1. **Proponer.** En el detalle de una versión (idioma) el formulario trae el texto vigente; solo se envía lo que se cambia. Es **texto plano** (sin etiquetas ni código; el servidor lo vuelve a comprobar) y respeta los límites del generador (título ≤ 65, descripción 50–160…). Secciones: «`## Encabezado`» y debajo los párrafos separados por una línea en blanco; botones: «`Texto | /enlace/`», uno por línea. Una propuesta que dejaría el texto fuera de las reglas se guarda para comentarla, con el aviso, pero **no se puede aceptar**.
2. **Decidir** (Revisor). Ve el antes y el después de cada campo. *Aceptar* cambia el texto vigente (y **retira la aprobación** de esa versión si la tenía, con una línea en el registro); *Descartar* no cambia nada.
3. **Aprobar** (Revisor). Marca «He leído el texto completo y lo doy por bueno» y aprueba con la función que toca. Reglas: el castellano antes que las traducciones; el texto debe pasar las comprobaciones del generador; un texto cambiado después de aprobarlo deja de estar aprobado. Retirar la aprobación del castellano retira también la de las traducciones (no pueden publicarse sin él).
4. **Registro de cambios.** Cada propuesta, decisión, aprobación y retirada queda con quién, cuándo, idioma y detalle (vista «Registro de cambios» y, por versión, al pie del detalle). También aparece en *Actividad* del manager.

### Del panel al archivo y a la web

La web es estática: **aprobar en el panel no publica nada por sí solo.**

```bash
# 1. el manager pulsa «Descargar para anotar en los archivos» → contenido-nuevo-AAAA-MM-DD.json
# 2. anotarlo en data/content-new (valida antes de escribir; --dry solo comprueba)
node scripts/apply_newcontent.mjs --file=contenido-nuevo-2026-11-20.json
# 3. compilar y empaquetar: solo se publica lo aprobado
node site/build.mjs && python3 scripts/package_cpanel.py …
```

`apply_newcontent.mjs` escribe en cada idioma que cambió el texto vigente, su estado y `approval` (`by`, `role`, `at`: **sin correo**), y añade al `history` de la página los hechos del registro que el archivo aún no tenía (por `id`, así aplicar dos veces no duplica). No crea páginas. Si el resultado no pasara la validación del generador, no escribe nada.

Mientras no se anota, el servidor guarda lo hecho en el panel junto a los datos (clave `newcontent:<id>`) y lo **superpone** al archivo. Si el archivo cambia por otro camino después de una edición hecha en el panel, **manda el archivo** (la edición vieja se ignora y se avisa), y una aprobación solo vale mientras el texto sea exactamente el que se aprobó. Tras anotar y desplegar, el estado del panel y el del archivo coinciden y no hay nada duplicado.

## Los archivos: `history`

Cada página puede llevar un registro de cambios en el propio archivo (lo escribe `apply_newcontent.mjs`; no hace falta tocarlo a mano):

```json
"history": [
  { "id": "L1f3a9c2e8b41", "at": "2026-11-21T10:00:00.000Z", "by": "marta@…", "name": "Marta Revisora", "lang": "es", "action": "aprobada", "detail": "como comercial" }
]
```

Acciones: `propuesta`, `propuesta_aceptada`, `propuesta_descartada`, `aprobada`, `aprobacion_retirada`, `aprobacion_invalidada`. Se conservan las últimas 300 por página.

## Vista previa de borradores

```bash
node site/build.mjs --drafts --out=/ruta/vista-previa
```

Compila también los borradores, marcados con `[BORRADOR]` en el título y con el aviso «BORRADOR · pendiente de aprobación» en el texto. **`--drafts` no se puede combinar con `--base`**: un paquete (pruebas o producción) nunca lleva borradores.

## Estado de hoy

| Página | ES | EN | FR | DE |
|---|---|---|---|---|
| Fabricación a medida (`a-medida`) | borrador | borrador | — | — |
| Fabricación OEM (`oem`) | borrador | borrador | — | — |

Todo en borrador: **hoy no se publica ninguna página nueva**. FR y DE no existen todavía; se redactarán después de aprobar el castellano. El Revisor aún no existe (Torivac dirá quién es y se crea desde *Usuarios*).

## Lo que falta para publicar

- **Que Torivac diga quién es el Revisor** y crear su cuenta desde el panel. Después aprueba el castellano y, a continuación, el inglés.
- Los datos que Torivac debe confirmar están como propuestas «dato faltante» en el panel (*Propuestas*), con la etiqueta «Contenido nuevo (plan 2027)». Mientras no se confirmen, los textos dicen que plazos, mínimos y condiciones se confirman para cada proyecto, y **no** afirman «fabricante europeo», «fabricado en España» ni certificaciones.
- Enlazar las páginas aprobadas desde el menú, el pie y las categorías (no entran solas en la navegación).
- El formulario técnico por familia sustituirá al contacto actual como destino de los botones.

## Sin archivos adjuntos

**Ningún formulario de la web admite archivos** (decisión del 14/11/2026): ni el presupuesto, ni el contacto, ni los formularios técnicos que lleguen. Es menos riesgo (no se reciben ni se guardan archivos de terceros) y no cambia el trabajo comercial. En su lugar la web dice, en los cuatro idiomas, **en el formulario de presupuesto y en el de contacto, en la confirmación y en el correo que recibe el cliente**: *los planos y la documentación técnica se envían por correo como adjunto, indicando el número de pedido* (a `info@grupotorivac.com`, el primer destinatario de los pedidos). Las páginas nuevas dicen lo mismo en sus textos.

## Pruebas

| Prueba | Qué comprueba |
|---|---|
| `node scripts/test-newcontent.mjs` | Validación (quién y con qué función aprueba), que un borrador no sale, que las equivalencias entre idiomas solo enlazan versiones publicadas, que una compilación de producción con una versión aprobada pasa `seo_check.py`, que `--drafts` con `--base` se rechaza y que `apply_newcontent.mjs` anota sin duplicar, valida y no crea páginas |
| `php backend-php/api/tests/run.php NewContent` | El rol Revisor (solo ve «Contenido nuevo»), listado, proponer (texto plano, solo lo que cambia), decidir, aprobar (función, castellano primero), retirar, exportar, que el archivo gana si cambió, auditoría y `/api/health` |
| `workers/api/test/newcontent.test.js` | En el Worker: el rol Revisor se crea y entra igual, solo llega a `/api/newcontent` y ahí responde 501 con un mensaje claro |
| `node scripts/qa-newcontent-panel.mjs` | En un navegador contra el servidor PHP: el manager propone, crea al Revisor desde *Usuarios*, ella acepta y aprueba (ES como «comercial», EN como «traductor»), registro, descarga, `apply_newcontent.mjs` y una compilación que publica solo lo aprobado; axe y móvil |
