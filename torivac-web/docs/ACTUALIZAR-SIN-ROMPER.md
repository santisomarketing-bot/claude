# Actualizar la web publicada sin romper nada

Vale para Plesk y para cPanel (el paquete es el mismo). La regla es una: **nada llega a producción sin haber pasado antes por el subdominio de pruebas, y siempre con una vuelta atrás preparada.**

## 1. Qué se actualiza y qué no se toca nunca

| Se sustituye con cada paquete | **No se toca** (vive solo en el servidor) |
|---|---|
| La web (HTML de los 4 idiomas, CSS, JS, imágenes, PDF, catálogo) | `api/config.php` (claves, correo, origen de precios) |
| El código del API (`api/lib/*.php`, `api/index.php`…) | La carpeta de datos: pedidos, usuarios, precios vigentes e histórico (`api/storage/`, o `torivac-datos`, o la que pongas en `storage_dir`) |
| El `.htaccess` y `robots.txt` (se generan en cada compilación) | `.well-known/` (certificados) |

El `.zip` **no lleva** `config.php`, ni datos, ni precios, ni tests: aunque lo extraigas encima, no puede pisarlos. Lo verifica el propio empaquetado antes de dejarte descargarlo.

> **Ojo con el `.htaccess`:** se regenera entero. Si lo tocaste a mano en el servidor (por ejemplo el bloque `Require ip` de pruebas), se pierde al actualizar: vuelve a ponerlo después o guarda tu versión antes.

## 2. El procedimiento (el mismo cada vez)

**A. En tu ordenador o en GitHub**
1. Todo en un commit y las pruebas en verde: `bash scripts/qa-all.sh --rapido` (4-6 min) o la CI de GitHub. Para cambios grandes, `bash scripts/qa-all.sh` completo.
2. Paquete de **pruebas**: `python3 -I scripts/package_cpanel.py --base=https://torivac.santisomarketing.com --staging`. Anota la **versión** (el commit) y el SHA-256 que imprime.

**B. En el subdominio de pruebas**
3. Sube y extrae encima (Plesk: *Files → Extract Files* · cPanel: *Administrador de archivos → Extract*). No borres nada.
4. Pasa la lista corta de abajo (§3). Si algo falla, se arregla aquí; producción no se ha tocado.

**C. Antes de tocar producción: la vuelta atrás**
5. Copia de seguridad de lo único que no se regenera: `api/config.php` y la **carpeta de datos** (Plesk: *Backup Manager* o *Files → Compress*; cPanel: *Copia de seguridad* o *Compress*). Guarda también el `.zip` de la versión que está publicada ahora.
6. Elige un momento tranquilo (sin pedidos en curso): extraer un `.zip` tarda segundos, pero durante ellos hay archivos nuevos y viejos mezclados.

**D. Producción**
7. Paquete de **producción** del **mismo commit** que probaste: `python3 -I scripts/package_cpanel.py --base=https://www.grupotorivac.com`. El empaquetado se niega si hay cambios sin commit (así el paquete se puede repetir y volver atrás) y ejecuta además la auditoría SEO/GEO.
8. Sube y extrae encima. Con GitHub: `ci/deploy.yml` empaqueta, verifica y sube por SSH con rsync; **empieza siempre en modo simulacro** (enseña qué cambiaría sin tocar nada) y no borra nada salvo que marques «limpiar».
9. Pasa la lista corta (§3) contra producción. Si todo está bien, has terminado.

**E. Si algo va mal: volver atrás (2 minutos)**
10. Extrae encima el `.zip` anterior (el del paso 5). Los datos no se han tocado; si por cualquier motivo hubo que restaurarlos, restaura la copia.

## 3. Lista corta de comprobación (5 minutos)

| Qué | Cómo | Debe dar |
|---|---|---|
| La web | Abrir `/`, `/en/`, `/fr/`, `/de/` | Candado, sin errores, el aspecto elegido |
| El API | `…/api/health` | `{"ok":true,…}` |
| Servidor | Panel → *Ajustes → Diagnóstico* | Sin ✗; fíjate en *Versión instalada*, *Servidor web* e *IP del visitante* |
| Cabeceras | `curl -sI https://DOMINIO/ \| grep -i -E 'content-security\|x-robots'` | CSP siempre; `x-robots-tag` solo en pruebas |
| Una ficha | Abrir un producto con precio | Precio de la hoja de Drive (o «Consultar») |
| Un pedido | Armar un presupuesto de 2 líneas y *Enviar pedido* | «Pedido registrado» y los correos en `info@` y `mzamora@` |
| Estilos | Recarga normal (no forzada) tras actualizar | La versión nueva a la primera, sin «mezclas» |

## 4. Por qué no se rompe (lo que hay de verdad)

- **El paquete se verifica antes de entregarse**: ficheros imprescindibles, nada prohibido (claves, tests, scripts), sin precios, PHP válido, URL del API, `noindex` coherente con pruebas/producción y que **todo CSS y JS lleve su huella**. Si algo no cuadra, no genera el `.zip`.
- **Sin caché vieja**: cada CSS y JS se pide como `archivo?v=<huella del contenido>`. El HTML no se guarda en caché y apunta a direcciones nuevas en cuanto cambian los archivos; lo que no cambió no se vuelve a descargar. Lo demuestra `node scripts/qa-update.mjs`: con una caché de una semana, la actualización se ve entera a la primera visita, volver atrás también funciona, y la prueba reproduce el problema sin huellas para asegurarse de que detecta lo que debe.
- **El servidor manda sobre el navegador**: el importe de cada pedido lo recalcula el servidor con sus precios (ignora cualquier precio que mande la página) y rechaza con un mensaje claro las referencias que ya no existen en su catálogo. Una página vieja abierta durante una actualización puede dar un error, nunca un precio equivocado.
- **Lo que importa está fuera del paquete**: configuración y datos no se sustituyen. El código tolera registros antiguos sin los campos nuevos (por ejemplo, pedidos sin el campo `emailed`).
- **Misma prueba en dos sitios**: pruebas y producción usan el mismo paquete y la misma versión; solo cambian la URL, `noindex` y `config.php`.
- **Sello de versión**: cada paquete lleva `api/generated/build.json` (commit, fecha del commit, URL base, pruebas/producción, aspecto) y el Diagnóstico lo enseña, de modo que siempre se sabe qué hay publicado y si coincide con lo que se probó.

## 5. Riesgos reales y cómo se evitan

| Riesgo | Qué pasa | Cómo se evita |
|---|---|---|
| Vaciar la carpeta antes de subir | Se borran `api/config.php` y los datos si están en `api/storage/` | **Extraer encima, no vaciar.** Si hay que vaciar, conserva `api/config.php` y la carpeta de datos |
| Subir el paquete de pruebas a producción (o al revés) | Producción con `noindex`, o pruebas indexables; CORS y direcciones no coinciden | El Diagnóstico avisa si la URL con la que se compiló no es la del sitio; el nombre del `.zip` lleva el dominio y `-pruebas` |
| Imagen o fuente cambiada con el mismo nombre | Se guardan un año en el navegador: unos visitantes ven la vieja | Cambia el nombre del archivo al sustituirlo (el CSS y el JS ya están protegidos con huella) |
| Plesk con nginx sirviendo los estáticos | El `.htaccess` (cabeceras, caché, restricción por IP) no se aplica a esos archivos | Ver [`DESPLIEGUE-PLESK.md`](DESPLIEGUE-PLESK.md) paso 2 y la comprobación de cabeceras de §3 |
| Cambiar el aspecto o el dominio base | Cambian el CSS y las URL absolutas | Siempre por el flujo completo (pruebas → producción), no editando archivos a mano |
| Cambiar `session_secret` | Se cierran todas las sesiones del panel | Aceptable y deliberado; avisa a los usuarios |
| Actualizar con un pedido en curso | Un visitante puede ver un instante archivos mezclados | Hora tranquila; el rsync de `deploy.yml` deja todo en su sitio al final (`--delay-updates`) |
| Un cambio que exigiera reescribir datos guardados | Los pedidos antiguos no se leerían | Regla del proyecto: los cambios de datos son compatibles hacia atrás (campos nuevos opcionales). Si alguna vez hiciera falta migrar, irá con un script propio, probado, y una copia de seguridad previa |

## 6. Qué viene (sesión 21)

Hoy el procedimiento es manual pero seguro. En la sesión 21 se automatiza: una publicación guiada con copia de seguridad previa en el servidor, comprobaciones de humo contra la URL real y vuelta atrás automática si fallan, y la versión instalada visible en el panel. Ver [`SESION-21.md`](SESION-21.md). **El panel nunca se actualizará a sí mismo**: que una web pueda reescribir su propio código es justo el tipo de puerta que no se debe abrir; la actualización la dispara siempre una persona desde GitHub o desde la línea de comandos.
