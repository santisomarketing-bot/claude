# Precios desde Drive (Excel u hoja de Google)

La web **no lleva precios dentro**: los lee del servidor (`GET /api/prices`), y el servidor los toma de **una hoja de Drive**. Así se cambian sin recompilar ni volver a subir la web.

```
Excel / Hoja de Google en Drive ──► servidor (API PHP de cPanel/Plesk o Worker) ──► web pública y panel
        ▲                              ▲  cron diario 03:00 UTC (24 h)
        │                              ▲  botón «Actualizar ahora» (panel → Precios)
        └── o subida a mano del .xlsx/.csv en el panel (con vista previa)
```

Cuando alguien pide un presupuesto, **el servidor vuelve a calcular el importe con SUS precios** (los que manda el navegador se ignoran). El PDF y el correo llevan esos importes.

---

## 1. Formatos de hoja que se entienden

La primera fila que tenga una columna de **referencia** y una de **precio** es la cabecera (puede haber filas de título encima). Da igual el orden de las columnas, las mayúsculas y los acentos.

| Formato | Cabeceras típicas | Una fila por… |
|---|---|---|
| **Tarifa** (la de «tarifa trafos») | `Artículo` · `Descripción` · `Precio venta` | código de fabricante (p. ej. `TT0150117EM`) |
| **Canónico** | `ref` · `product_id` · `name_es` · `unit` · `currency` · `price` · `qty2`/`price2` · `qty3`/`price3` · `qty4`/`price4` · `note` · `active` · `updated_at` | referencia pedible |
| **WooCommerce** | `SKU` · `Producto` · `Precio` · `Oferta` · `Stock` | producto (el precio vale para su línea genérica) |

Alias reconocidos (cualquiera de estos nombres sirve): referencia → `ref`, `referencia`, `artículo`, `código`, `sku`, `item`, `reference`, `part number`… · precio → `price`, `precio`, `precio venta`, `pvp`, `tarifa`, `precio unitario`, `importe`… · nombre → `descripción`, `producto`, `nombre`, `name_es`… · `active`/`activo`/`visible` (0 = oculta la fila).
Las columnas `Oferta` y `Stock` **no se usan** (se avisa en la vista previa).

## 2. Decimales: lo que se muestra es lo que se calcula

- El **precio unitario** conserva hasta **4 decimales** por defecto (`27,75093203` → `27,7509`); se puede subir hasta 6 (`prices.decimals` en `api/config.php`, `PRICE_DECIMALS` en el Worker).
- El **importe de la línea** se redondea a **2 decimales**: `12 × 27,7509 = 333,01 €`.
- Entiende `27,75`, `27.75093203`, `1.234,56`, `1,234.56`, `22 000` y `€ 5`.

## 3. Tramos por cantidad

Columnas `qty2` + `price2`, `qty3` + `price3`, `qty4` + `price4`: a partir de esa cantidad se aplica el precio del tramo (`qty2 = 10`, `price2 = 11,90` → desde 10 uds. cuesta 11,90). Se muestran en la ficha («desde 10 uds. …») y se aplican en el presupuesto.

## 4. Referencias que la web no tiene todavía

Una tarifa puede traer códigos nuevos (`TT0330212`…). Se publican **dentro de su producto** solo si el código encaja con el patrón de una familia verificada en los PDF (`data/catalog/ref-rules.json`):

| Patrón | Se publica en | Ejemplo |
|---|---|---|
| `TT` + 7-8 dígitos + hasta 3 letras | Transformador Serie TT | `TT0150117EM` |
| `CA` + 7 dígitos | Carátulas graduadas | `CA0001234` |
| `BOS` + 3 dígitos | Startors / Estators | `BOS012` |
| `PC` + 2-4 dígitos | Reóstatos cerámicos serie PC | `PC1000` |

La descripción de la hoja pasa a ser el nombre de la línea. **Lo que no encaja se avisa y no se publica** («N referencias de la hoja no están en la web ni encajan en ninguna familia»). Para admitir otra familia: añadir su patrón a `ref-rules.json`, recompilar y volver a subir la web.

## 5. Qué pasa con las filas raras

| Fila | Resultado |
|---|---|
| Precio vacío | La referencia se muestra como **«Consultar»** (se cuenta en el aviso) |
| Precio `0` o negativo | Se ignora (se muestra «Consultar») |
| Precio ilegible (`consultar`, `—`) | Se ignora y se lista en la vista previa |
| `active = 0` / `no` / `inactivo` | Se ignora |
| Referencia repetida con precios distintos | Se usa la primera y se avisa |
| SKU de un producto con varios modelos | No se puede: hay que poner el precio en la referencia de cada modelo |

## 6. Protecciones (para que una hoja rota no deje la web sin precios)

La sincronización **se rechaza** si:
- más del **60 %** de las filas tienen el mismo precio (típico de un valor de relleno como `22000`), o
- la hoja nueva trae **menos de la mitad** de las referencias que había.

El panel muestra el motivo y, si es intencionado (p. ej. la primera carga de una tarifa que solo cubre transformadores), se marca «Es intencionado aunque desaparezcan muchas referencias o la hoja tenga precios de relleno» antes de aplicar. La carga automática diaria **no** fuerza: si falla, deja los precios anteriores y lo registra. Cada cambio guarda el histórico (90 días) por si hay que volver atrás.

## 7. Conectar el Excel de Drive (elige una forma)

| | Qué hace falta | Privacidad |
|---|---|---|
| **A. Descarga directa del .xlsx** (la más simple) | Drive → clic derecho en el archivo → *Compartir* → *Cualquier persona con el enlace* (Lector). Del enlace `https://drive.google.com/file/d/`**`ID`**`/view` se toma el `ID` y se pone `xlsx_url` = `https://drive.google.com/uc?export=download&id=ID` | El enlace no sale en la web, pero **quien lo tenga puede ver la tarifa** |
| **B. Cuenta de servicio de Google** (privada) | Proyecto en Google Cloud → activar *Google Drive API* y *Google Sheets API* → crear una cuenta de servicio y su clave JSON → **compartir el archivo con el correo de la cuenta** (Lector) → `google_service_account` (ruta del JSON, fuera de la web) + `sheet_id` (el `ID` del archivo) | Privada: solo la cuenta de servicio lee el archivo |
| **C. Hoja de Google publicada como CSV** | Hoja de Google compartida con enlace → `csv_url` = `https://docs.google.com/spreadsheets/d/ID/export?format=csv&gid=0` | Como A |
| **D. A mano** | Panel → Precios → arrastrar el .xlsx/.csv (vista previa) | Nada sale de tu equipo |

- **A y B leen el `.xlsx` tal cual está en Drive; no hace falta convertirlo a hoja de Google.** B también lee una hoja de Google directamente. Con A, si tu archivo *es* una hoja de Google, usa su URL de exportación: `https://docs.google.com/spreadsheets/d/ID/export?format=xlsx`. Si el libro tiene varias hojas, se usa la primera visible con columnas de referencia y precio; para fijarla: `sheet_name` (`PRICE_SHEET_NAME` en el Worker).
- Si editas el Excel con *Drive para escritorio* o lo reemplazas con *Administrar versiones*, el **ID no cambia** y el servidor lo seguirá leyendo. Si lo guardas como «copia» o «Guardar como hoja de Google», el ID es **otro**: hay que actualizar la configuración.
- Dónde se escribe cada ajuste: `api/config.php` (cPanel o Plesk, sección `prices`) o variables del Worker (`PRICE_XLSX_URL`, `PRICE_SHEET_ID` + secreto `GOOGLE_SERVICE_ACCOUNT`, `PRICE_SHEET_NAME`, `PRICE_CSV_URL`). Ver [`DESPLIEGUE-CPANEL.md`](DESPLIEGUE-CPANEL.md).

## 8. Actualización diaria y manual

- **Diaria (24 h)**: cron de cPanel (o *Tareas programadas* de Plesk) `php api/cron.php` a las 03:00 (o el cron del Worker). Si el hosting no deja programar por línea de comandos: URL `https://dominio/api/cron?token=…` con `cron_token`.
- **Manual**: Panel → Precios → **Actualizar ahora** (vuelve a leer Drive) o subir un archivo.
- **Por instrucción**: Panel → Precios → «Pedile cambios a la IA» (p. ej. «sube un 3 % las resistencias»): la IA **propone**, se revisa la vista previa y solo entonces se aplica; los cambios muy grandes piden confirmación.

## 9. Los precios son públicos

`GET /api/prices` lo lee cualquier visitante (la web los pinta). Es lo habitual en una tienda, pero la web original **no** publicaba tarifas. Si Torivac prefiere enseñarlos **solo a clientes registrados**, hay que decidirlo ahora: es un cambio pequeño (el servidor devolvería «Consultar» sin sesión y la web enviaría la sesión del cliente al pedir precios). Mientras tanto, en el entorno de pruebas **no cargues la tarifa real** salvo que el subdominio esté restringido por IP.

## 10. Cómo se prueba

`node scripts/qa-tarifa.mjs` (y `--php`) sube un Excel **sintético** en formato tarifa (nunca hay precios reales en el repositorio): reconoce columnas, publica las referencias nuevas dentro de la Serie TT, rechaza el código desconocido, muestra el precio en la ficha, hace el pedido y comprueba la lectura directa del `.xlsx` como si viniera de Drive. Los lectores de hojas (`shared/price-sheet.mjs` + port PHP) y de libros (`shared/xlsx.mjs` + port PHP) comparten casos de prueba.
