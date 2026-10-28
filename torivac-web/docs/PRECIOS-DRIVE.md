# Precios desde Drive (Excel u hoja de Google)

La web **no lleva precios dentro**: los lee del servidor (`GET /api/prices`), y el servidor los toma de **una hoja de Drive**. Así se cambian sin recompilar ni volver a subir la web.

```
Excel / Hoja de Google en Drive ──► servidor (API PHP de cPanel/Plesk o Worker) ──► web pública y panel
        ▲                              ▲  cron diario 03:00 UTC (24 h)
        │                              ▲  botón «Actualizar ahora» (panel → Precios)
        └── o subida a mano del .xlsx/.csv en el panel (con vista previa)
```

Cuando alguien pide un presupuesto, **el servidor vuelve a calcular el importe con SUS precios** (los que manda el navegador se ignoran). El PDF y el correo llevan esos importes.

**La hoja no tiene que traer todo el catálogo**: puede ser solo una parte (una familia, unas pocas referencias) siempre que cada fila se pueda reconocer por su referencia técnica, su SKU o su ID de producto; solo cambia el precio de lo que la hoja trae y el resto se queda como estaba (§2).

---

## 1. Formatos de hoja que se entienden

La primera fila que tenga una columna de **referencia** (o de **ID de producto**) y una de **precio** es la cabecera (puede haber filas de título encima). Da igual el orden de las columnas, las mayúsculas y los acentos.

| Formato | Cabeceras típicas | Una fila por… |
|---|---|---|
| **Tarifa** (la de «tarifa trafos») | `Artículo` · `Descripción` · `Precio venta` | código de fabricante (p. ej. `TT0150117EM`) |
| **Canónico** | `ref` · `product_id` · `name_es` · `unit` · `currency` · `price` · `qty2`/`price2` · `qty3`/`price3` · `qty4`/`price4` · `note` · `active` · `updated_at` | referencia pedible |
| **WooCommerce** | `SKU` · `Producto` · `Precio` · `Oferta` · `Stock` | producto (el precio vale para su línea genérica) |
| **Por ID de producto** | `ID` · `Precio` | producto (el precio vale para su línea genérica) |

Alias reconocidos (cualquiera de estos nombres sirve): referencia → `ref`, `referencia`, `artículo`, `código`, `sku`, `item`, `reference`, `part number`… · precio → `price`, `precio`, `precio venta`, `pvp`, `tarifa`, `precio unitario`, `importe`… · nombre → `descripción`, `producto`, `nombre`, `name_es`… · ID de producto → `ID`, `product_id`, `id producto` · `active`/`activo`/`visible` (0 = quita el precio de esa referencia).
Las columnas `Oferta` y `Stock` **no se usan** (se avisa en la vista previa).

## 2. Actualizar solo una parte del catálogo

La hoja **no tiene que traer todo el catálogo**: puede ser solo una familia (p. ej. los transformadores) o unas pocas referencias. Cada fila se reconoce por su identificador y **solo cambia el precio de esa referencia**; todo lo demás se queda como estaba. Es el modo por defecto, **«Actualizar solo lo que trae»**, y vale igual para una subida a mano que para la sincronización diaria de Drive.

**Cómo se reconoce cada fila** (en este orden; se usa la primera que coincide):

| | Identificador | Dónde va en la hoja | Qué precio actualiza |
|---|---|---|---|
| 1 | **Referencia técnica** (código de fabricante, p. ej. `TT0150117EM`, o la genérica `P8339`) | columna `ref`, `Referencia`, `Artículo`, `Código`… | esa referencia |
| 2 | **SKU** de WooCommerce | columna `SKU` | la línea genérica de su producto (si el producto tiene modelos propios no se puede: hay que poner la referencia de cada modelo) |
| 3 | **Código nuevo de una familia verificada** (§5) | la misma columna | se publica dentro de su producto |
| 4 | **ID de producto** (el número de WooCommerce, p. ej. `16633`, o `P16633`) | columna `ID`/`product_id`, **solo si la fila no trae referencia** | la línea genérica de su producto (igual que el SKU) |

Lo que no coincide con nada se lista en la vista previa («referencias de la hoja que no encajan en ningún producto») y **no se publica**. La vista previa cuenta además cómo se reconoció cada fila («9 por referencia · 3 por SKU · 2 por ID»).

**Qué hace cada fila:**

| Fila | Efecto |
|---|---|
| Con precio | Actualiza esa referencia: su precio, sus tramos y su nota (los tramos de antes se sustituyen por los de la fila) |
| Referencia que la hoja no trae | **No se toca** |
| Precio `0` o `active = 0` | **Quita** el precio de esa referencia (vuelve a «Consultar») |
| Precio vacío o ilegible | No toca nada (se avisa) |
| Referencia repetida con precios distintos | Se usa la primera y se avisa (si sale una vez con precio y otra para quitar, gana el precio) |

**Ejemplo.** Con 336 referencias con precio, subir esta hoja de tres filas:

```
ref;price;active
TT0150117EM;37,01;1       ← actualiza esta referencia
aaaa00000001;70;1         ← SKU de un producto: actualiza su línea genérica
TT0330212;0;1             ← quita su precio
```

deja las otras 333 referencias exactamente como estaban. La vista previa lo dice antes de aplicar: «1 cambian · 1 nuevas · 1 se quedan sin precio · … · 333 no vienen en la hoja y se conservan».

**Reemplazar toda la lista** es la otra opción («Reemplazar toda la lista» en el panel, o `prices.update_mode = 'replace'` / `PRICE_UPDATE_MODE=replace` para que lo haga también la sincronización de Drive): la hoja sustituye a todo y lo que no esté en ella se queda sin precio. Úsalo, por ejemplo, para empezar de cero. Por seguridad pide confirmar si la hoja trae menos de la mitad de las referencias que había (§7).

> Si el archivo de Drive es solo una parte del catálogo, la sincronización diaria no borra el resto (por ejemplo, lo cargado a mano desde otra hoja). Para que una referencia deje de tener precio, pon `0` en su fila o `active = 0`; no basta con borrar la fila.

## 3. Decimales: lo que se muestra es lo que se calcula

- El **precio unitario** conserva hasta **4 decimales** por defecto (`27,75093203` → `27,7509`); se puede subir hasta 6 (`prices.decimals` en `api/config.php`, `PRICE_DECIMALS` en el Worker).
- El **importe de la línea** se redondea a **2 decimales**: `12 × 27,7509 = 333,01 €`.
- Entiende `27,75`, `27.75093203`, `1.234,56`, `1,234.56`, `22 000` y `€ 5`.

## 4. Tramos por cantidad

Columnas `qty2` + `price2`, `qty3` + `price3`, `qty4` + `price4`: a partir de esa cantidad se aplica el precio del tramo (`qty2 = 10`, `price2 = 11,90` → desde 10 uds. cuesta 11,90). Se muestran en la ficha («desde 10 uds. …») y se aplican en el presupuesto.

## 5. Referencias que la web no tiene todavía

Una tarifa puede traer códigos nuevos (`TT0330212`…). Se publican **dentro de su producto** solo si el código encaja con el patrón de una familia verificada en los PDF (`data/catalog/ref-rules.json`):

| Patrón | Se publica en | Ejemplo |
|---|---|---|
| `TT` + 7-8 dígitos + hasta 3 letras | Transformador Serie TT | `TT0150117EM` |
| `CA` + 7 dígitos | Carátulas graduadas | `CA0001234` |
| `BOS` + 3 dígitos | Startors / Estators | `BOS012` |
| `PC` + 2-4 dígitos | Reóstatos cerámicos serie PC | `PC1000` |

La descripción de la hoja pasa a ser el nombre de la línea. **Lo que no encaja se avisa y no se publica** («N referencias de la hoja no están en la web ni encajan en ninguna familia»). Para admitir otra familia: añadir su patrón a `ref-rules.json`, recompilar y volver a subir la web.

## 6. Qué pasa con las filas raras

| Fila | Resultado |
|---|---|
| Precio vacío | No toca el precio que hubiera (con «Reemplazar toda la lista», la referencia queda como **«Consultar»**); se cuenta en el aviso |
| Precio `0` | **Quita** el precio de esa referencia («Consultar») |
| `active = 0` / `no` / `inactivo` | **Quita** el precio de esa referencia |
| Precio negativo | Se ignora |
| Precio ilegible (`consultar`, `—`) | Se ignora y se lista en la vista previa |
| Referencia repetida con precios distintos | Se usa la primera y se avisa |
| SKU o ID de un producto con varios modelos | No se puede: hay que poner el precio en la referencia de cada modelo |
| SKU, ID o código que no existe | Se lista como «no encaja en ningún producto» y no se publica |

## 7. Protecciones (para que una hoja rota no deje la web sin precios ni los cambie a ciegas)

La actualización **se rechaza** si:
- más del **60 %** de las filas tienen el mismo precio (típico de un valor de relleno como `22000`), o
- **cambio masivo**: de las referencias de la hoja que ya tenían precio (al menos 10), más de la mitad cambia **más de un 40 %** (hoja equivocada, columna movida, precio por 100 unidades…), o
- solo en «Reemplazar toda la lista»: la hoja nueva trae **menos de la mitad** de las referencias que había.

El panel muestra el motivo y pide marcar «Es intencionado: aplícalo» antes de dejar pulsar *Aplicar* (con «Actualizar solo lo que trae» no hace falta nada si no salta ninguna protección). La carga automática diaria **no** fuerza: si falla, deja los precios anteriores y lo registra. Cada cambio guarda el histórico (90 días) por si hay que volver atrás.

## 8. Conectar el Excel de Drive (elige una forma)

| | Qué hace falta | Privacidad |
|---|---|---|
| **A. Descarga directa del .xlsx** (la más simple) | Drive → clic derecho en el archivo → *Compartir* → *Cualquier persona con el enlace* (Lector). Del enlace `https://drive.google.com/file/d/`**`ID`**`/view` se toma el `ID` y se pone `xlsx_url` = `https://drive.google.com/uc?export=download&id=ID` | El enlace no sale en la web, pero **quien lo tenga puede ver la tarifa** |
| **B. Cuenta de servicio de Google** (privada) | Proyecto en Google Cloud → activar *Google Drive API* y *Google Sheets API* → crear una cuenta de servicio y su clave JSON → **compartir el archivo con el correo de la cuenta** (Lector) → `google_service_account` (ruta del JSON, fuera de la web) + `sheet_id` (el `ID` del archivo) | Privada: solo la cuenta de servicio lee el archivo |
| **C. Hoja de Google publicada como CSV** | Hoja de Google compartida con enlace → `csv_url` = `https://docs.google.com/spreadsheets/d/ID/export?format=csv&gid=0` | Como A |
| **D. A mano** | Panel → Precios → arrastrar el .xlsx/.csv (vista previa) | Nada sale de tu equipo |

- **A y B leen el `.xlsx` tal cual está en Drive; no hace falta convertirlo a hoja de Google.** B también lee una hoja de Google directamente. Con A, si tu archivo *es* una hoja de Google, usa su URL de exportación: `https://docs.google.com/spreadsheets/d/ID/export?format=xlsx`. Si el libro tiene varias hojas, se usa la primera visible con columnas de referencia y precio; para fijarla: `sheet_name` (`PRICE_SHEET_NAME` en el Worker).
- Si editas el Excel con *Drive para escritorio* o lo reemplazas con *Administrar versiones*, el **ID no cambia** y el servidor lo seguirá leyendo. Si lo guardas como «copia» o «Guardar como hoja de Google», el ID es **otro**: hay que actualizar la configuración.
- Dónde se escribe cada ajuste: `api/config.php` (cPanel o Plesk, sección `prices`) o variables del Worker (`PRICE_XLSX_URL`, `PRICE_SHEET_ID` + secreto `GOOGLE_SERVICE_ACCOUNT`, `PRICE_SHEET_NAME`, `PRICE_CSV_URL`). Modo de actualización de la sincronización: `prices.update_mode` / `PRICE_UPDATE_MODE` = `merge` (por defecto) o `replace`. Ver [`DESPLIEGUE-CPANEL.md`](DESPLIEGUE-CPANEL.md).

## 9. Actualización diaria y manual

- **Diaria (24 h)**: cron de cPanel (o *Tareas programadas* de Plesk) `php api/cron.php` a las 03:00 (o el cron del Worker). Si el hosting no deja programar por línea de comandos: URL `https://dominio/api/cron?token=…` con `cron_token`. Usa el modo de `prices.update_mode` (por defecto «solo lo que trae la hoja»).
- **Manual**: Panel → Precios → **Actualizar ahora** (vuelve a leer Drive) o subir un archivo (elige antes si **actualiza solo lo que trae** o **reemplaza toda la lista**).
- **Por instrucción**: Panel → Precios → «Pedile cambios a la IA» (p. ej. «sube un 3 % las resistencias»): la IA **propone**, se revisa la vista previa y solo entonces se aplica; los cambios muy grandes piden confirmación.

## 10. Los precios son públicos

`GET /api/prices` lo lee cualquier visitante (la web los pinta). Es lo habitual en una tienda, pero la web original **no** publicaba tarifas. Si Torivac prefiere enseñarlos **solo a clientes registrados**, hay que decidirlo ahora: es un cambio pequeño (el servidor devolvería «Consultar» sin sesión y la web enviaría la sesión del cliente al pedir precios). Mientras tanto, en el entorno de pruebas **no cargues la tarifa real** salvo que el subdominio esté restringido por IP.

## 11. Cómo se prueba

`node scripts/qa-tarifa.mjs` (y `--php`) sube un Excel **sintético** en formato tarifa (nunca hay precios reales en el repositorio): reconoce columnas, publica las referencias nuevas dentro de la Serie TT, rechaza el código desconocido, muestra el precio en la ficha, hace el pedido y comprueba la lectura directa del `.xlsx` como si viniera de Drive. También sube una hoja parcial (solo 9 de 336 referencias): comprueba que las otras 330 se conservan, que «Reemplazar toda la lista» exige confirmar y que una hoja solo con el ID de producto actualiza únicamente su línea. Los lectores de hojas (`shared/price-sheet.mjs` + port PHP) y de libros (`shared/xlsx.mjs` + port PHP) comparten casos de prueba (incluidos los de SKU, ID y filas a quitar), y las pruebas de PHP y del Worker cubren la actualización parcial, el reemplazo y la protección de cambio masivo.
