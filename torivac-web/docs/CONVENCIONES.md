# Convenciones de código

Pensadas para que un programador nuevo se oriente en minutos. `scripts/gen_code_index.py` las lee y genera `docs/INDICE-CODIGO.md`; la CI (`--check`) falla si se incumplen.

1. **Cabecera en cada archivo**: qué es, qué hace, secciones y dependencias (comentario `/** … */`, `//` o docstring de Python al principio).
2. **Secciones con etiqueta** entre corchetes en mayúsculas: `// ───── [QUOTE] descripción`. Una etiqueta = un bloque con una responsabilidad
   (`[AUTH]`, `[VIEWS]`, `[PRICES]`, `[AI]`, `[ROUTER]`, `[SEO-FILES]`, `[ART]`, `[A11Y]`…).
3. **Cada función lleva una descripción** de una línea encima (qué hace, no cómo). Parámetros y retorno si no son obvios.
4. **Textos de interfaz** solo en `site/lib/i18n.mjs` (4 idiomas). **Colores y tamaños** solo desde `tokens.css`.
5. **Datos**: la web se genera desde `data/catalog/*.json`; el HTML no se edita a mano. Todo dato dudoso va a `proposals.json`.
6. **Sin dependencias en el navegador** salvo jsPDF/autoTable/SheetJS (locales en `assets/vendor`). El Worker no usa SDKs (el runtime de Workers no los admite sin `nodejs_compat`).
7. **Seguridad**: lo que llega del navegador es no fiable (el Worker valida y revalora); secretos solo con `wrangler secret put` o GitHub Actions; `scripts/secret_scan.py` lo vigila.
8. **Pruebas** con cálculo independiente (no comparar el código consigo mismo) y sin red: se simulan Resend, Google y Anthropic.
9. **Comentarios y mensajes en castellano**; nombres de código en inglés o castellano corto, coherentes con el archivo.
