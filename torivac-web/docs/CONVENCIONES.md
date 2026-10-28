# Convenciones de código

Pensadas para que un programador nuevo se oriente en minutos. `scripts/gen_code_index.py` las lee y genera `docs/INDICE-CODIGO.md`; la CI (`--check`) falla si se incumplen.

1. **Cabecera en cada archivo**: qué es, qué hace, secciones y dependencias (comentario `/** … */`, `//`, docstring de Python o docblock de PHP tras `<?php`).
2. **Secciones con etiqueta** entre corchetes en mayúsculas: `// ───── [QUOTE] descripción`. Una etiqueta = un bloque con una responsabilidad
   (`[AUTH]`, `[VIEWS]`, `[PRICES]`, `[AI]`, `[ROUTER]`, `[SEO-FILES]`, `[ART]`, `[A11Y]`…).
3. **Cada función lleva una descripción** de una línea encima (qué hace, no cómo): `/** … */` o `//` en JS y PHP (también helpers locales, flechas y métodos), docstring de una línea en Python. Parámetros y retorno si no son obvios.
4. **Textos de interfaz** solo en `site/lib/i18n.mjs` (4 idiomas). **Colores y tamaños** solo desde `tokens.css`.
5. **Datos**: la web se genera desde `data/catalog/*.json`; el HTML no se edita a mano. Todo dato dudoso va a `proposals.json`.
6. **Sin dependencias en el navegador** salvo jsPDF/autoTable/SheetJS (locales en `assets/vendor`). El Worker no usa SDKs (el runtime de Workers no los admite sin `nodejs_compat`).
7. **Seguridad**: lo que llega del navegador es no fiable (el Worker valida y revalora); secretos solo con `wrangler secret put` o GitHub Actions; `scripts/secret_scan.py` lo vigila.
8. **Pruebas** con cálculo independiente (no comparar el código consigo mismo) y sin red: se simulan Resend, Google y Anthropic.
9. **Comentarios y mensajes en castellano**; nombres de código en inglés o castellano corto, coherentes con el archivo.
10. **PHP** (`backend-php/api`): compatible con 7.4 (sin `match`, `str_contains` ni argumentos con nombre); una clase por fichero en `lib/` (las auxiliares comparten fichero con su clase, ver `autoload.php`); en cadenas con comillas dobles una variable pegada a `»` se escribe `{$var}` (PHP lee `»` como parte del nombre); sin caché que oculte cambios de `config.php`.
11. **Dos backends, un contrato**: cualquier cambio en una ruta, un mensaje o una regla de precios se hace en `workers/api` **y** en `backend-php/api`, y se prueba con los mismos guiones (`qa-*.mjs` y `--php`); el código compartido va a `shared/` con casos de prueba comunes.
