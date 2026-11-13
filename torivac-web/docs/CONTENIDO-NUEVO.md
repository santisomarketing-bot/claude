# Contenido nuevo (plan 2027): solo se publica lo aprobado

Páginas que **no existen en la web original** (fabricación a medida, OEM…) y que Torivac y Santiso Marketing deciden añadir. El contenido original sigue intacto: esto es un archivo aparte, con su propio flujo de aprobación.

## La regla

> Una versión de una página nueva solo entra en la web cuando está **aprobada**, y aprobarla exige **quién**, **con qué función** y **cuándo**.

| Idioma | Quién aprueba | Condición |
|---|---|---|
| Castellano | Función **comercial**: da el visto bueno a las afirmaciones y a las condiciones | — |
| EN, FR, DE | Función **traductor**: valida la traducción | El castellano ya debe estar aprobado |

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

Todo en borrador: **hoy no se publica ninguna página nueva**. FR y DE no existen todavía; se redactarán después de aprobar el castellano.

## Lo que falta para publicar

- La aprobación del usuario **comercial** (castellano) y del **traductor** (inglés), que quedan anotadas en el archivo.
- Los datos que Torivac debe confirmar están como propuestas «dato faltante» en el panel (*Propuestas*), con la etiqueta «Contenido nuevo (plan 2027)». Mientras no se confirmen, los textos dicen que plazos, mínimos y condiciones se confirman para cada proyecto, y **no** afirman «fabricante europeo», «fabricado en España» ni certificaciones.
- Enlazar las páginas aprobadas desde el menú, el pie y las categorías (no entran solas en la navegación).
- El formulario técnico por familia sustituirá al contacto actual como destino de los botones. **Sin archivos adjuntos por ahora** (decisión del 13/11/2026).

## Pruebas

`node scripts/test-newcontent.mjs` (paso de `qa-all.sh`): validación (quién y con qué función aprueba), que un borrador no sale, que las equivalencias entre idiomas solo enlazan versiones publicadas, que una compilación de producción con una versión aprobada pasa `seo_check.py`, y que `--drafts` con `--base` se rechaza.
