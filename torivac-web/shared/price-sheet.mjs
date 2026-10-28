// [PRICE-SHEET] Lectura tolerante de hojas de precios (Excel/CSV/Google Sheets) → objeto de precios. FUENTE ÚNICA de las reglas.
// Lo usan el Worker (workers/api), los scripts de Node (scripts/import_prices.mjs), el panel demo (se copia a assets/js/price-sheet.js al compilar)
// y tiene un port en PHP (backend-php/lib/PriceSheet.php) que se prueba contra los mismos casos (shared/price-sheet.fixtures.json).
//
// FORMATOS QUE ENTIENDE (la primera fila con una columna de referencia y una de precio es la cabecera; da igual el orden y las mayúsculas/acentos):
//   canónico     ref · product_id · name_es · unit · currency · price · qty2/price2 · qty3/price3 · qty4/price4 · note · active · updated_at
//   tarifa       Artículo · Descripción · Precio venta                       (p. ej. «tarifa trafos»: una fila por código de fabricante)
//   WooCommerce  SKU · Producto · Precio · Oferta · Stock                     (una fila por PRODUCTO; el SKU se resuelve a la línea genérica del producto)
//   por ID       ID (o product_id) · Precio                                    (una fila por PRODUCTO; el ID se resuelve a la línea genérica del producto)
// IDENTIFICADORES, en este orden por fila: 1) referencia/código técnico (columna ref, Artículo, Código, SKU…) tal cual está en el catálogo, incluida la genérica «P<id>»;
//   2) SKU de WooCommerce → línea genérica de su producto; 3) familia nueva por patrón (códigos nuevos de una tarifa); 4) si la fila NO trae referencia, el ID de producto de la columna ID/product_id.
//   Un producto con modelos propios no se puede valorar por SKU ni por ID (habría que elegir un modelo): se avisa y se pide la referencia de cada modelo.
// ACTUALIZACIONES PARCIALES: la hoja puede traer solo una parte del catálogo. Cada fila que se reconoce actualiza SOLO su referencia; `retire` lista las que la hoja pide dejar sin precio
//   (fila con active = 0 o con precio 0): el servidor las quita cuando actualiza «solo lo que trae la hoja» (applySheetItems, que usan el Worker y el panel de demostración).
// Alias de columnas: ver ALIASES. Las columnas «Oferta» y «Stock» no se usan (se avisa). Un precio vacío = «Consultar».
// Importes: se guardan con hasta `decimals` decimales (por defecto 4, máximo 6): lo que se muestra es lo que se calcula; el importe de línea se redondea a 2 en pedidos.
// Seguridad: «precio de relleno» (más del 60 % de las filas con el mismo precio) se avisa y el servidor lo rechaza salvo force=true.
export const DEFAULT_DECIMALS = 4;
export const ALIASES = {
  ref: ['ref', 'referencia', 'articulo', 'codigo', 'cod', 'sku', 'item', 'article', 'reference', 'partnumber', 'codigoarticulo', 'refarticulo'],
  price: ['price', 'precio', 'precioventa', 'pvp', 'tarifa', 'preciounitario', 'precioud', 'unitprice', 'importe', 'preciotarifa'],
  name: ['name_es', 'namees', 'nombre', 'descripcion', 'producto', 'product', 'description', 'concepto', 'denominacion'],
  product_id: ['productid', 'idproducto', 'idprod', 'pid', 'id'],
  unit: ['unit', 'unidad', 'ud'],
  currency: ['currency', 'moneda', 'divisa'],
  note: ['note', 'nota', 'notas', 'observaciones', 'comentario'],
  active: ['active', 'activo', 'visible'],
  updated_at: ['updatedat', 'actualizado', 'fechaactualizacion', 'fecha'],
  offer: ['oferta', 'offer', 'sale', 'preciooferta'],
  stock: ['stock', 'existencias', 'disponible'],
};
const IGNORED_COLS = { offer: 'Oferta', stock: 'Stock' };

/** cabecera → clave comparable: minúsculas, sin acentos ni signos («Precio venta» → precioventa) */
export const normHeader = (h) => String(h ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9_]/g, '').replace(/_/g, '');
/** referencia → clave de comparación: mayúsculas, sin espacios */
export const normRef = (r) => String(r ?? '').replace(/[\s ]+/g, '').toUpperCase();

/** número de una celda: acepta «27,75», «27.75093203», «1.234,56», «1,234.56», «22 000», «€ 5» y números ya numéricos; vacío/ilegible → null */
export function parseNumber(x) {
  if (x == null || x === '') return null;
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  let s = String(x).replace(/[\s  €$]/g, '');
  if (!s) return null;
  const c = s.lastIndexOf(','), d = s.lastIndexOf('.');
  if (c >= 0 && d >= 0) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');   // el último separador es el decimal
  else if (c >= 0) s = (s.match(/,/g) || []).length > 1 ? s.replace(/,/g, '') : s.replace(',', '.');   // «27,75» decimal · «1,234,567» miles
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');                                // «1.234.567» miles
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
/**
 * Aplica los precios que trae una hoja (`sheetItems`) a los vigentes (`prevItems`). «merge» (por defecto): quita las referencias de `retire` y pone o actualiza las que trae la hoja
 * (si una sale a la vez para quitar y con precio, gana el precio) y conserva todo lo demás; «replace»: devuelve solo lo que trae la hoja. No modifica los objetos recibidos.
 */
export function applySheetItems(prevItems, sheetItems, retire = [], mode = 'merge') {
  if (mode === 'replace') return { ...sheetItems };
  const items = { ...(prevItems || {}) };
  for (const ref of retire) delete items[ref];
  return Object.assign(items, sheetItems);
}
/** Redondea n a dec decimales (corrige los errores de coma flotante: 1.005 con 2 decimales da 1.01). */
const roundTo = (n, dec) => { const f = 10 ** dec; return Math.round((n + Number.EPSILON) * f) / f; };

/** índice de la fila de cabecera (primera con una columna de referencia —o de ID de producto— y una de precio) y mapa columna → posición */
export function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const keys = rows[i].map(normHeader), map = {};
    for (const [field, names] of Object.entries(ALIASES)) { const j = keys.findIndex((k, ix) => names.includes(k) && !Object.values(map).includes(ix)); if (j >= 0) map[field] = j; }
    keys.forEach((k, ix) => { const m = /^(qty|cant|cantidad)(\d)$/.exec(k); if (m) map['qty' + m[2]] = ix; const p = /^(price|precio)(\d)$/.exec(k); if (p) map['price' + p[2]] = ix; });
    if ((map.ref != null || map.product_id != null) && map.price != null) return { index: i, map, headers: rows[i].map((h) => String(h ?? '').trim()) };
  }
  return null;
}

/**
 * rows: matriz (primera fila = cabecera o con filas de título delante). ctx (todo opcional):
 *   lines   { ref: {n, pid} }     líneas pedibles del catálogo (código real o genérica P<id>)
 *   skus    { sku: pid }          SKU de WooCommerce → id de producto
 *   rules   [{pattern, pid}]       referencias nuevas que encajan en un producto por un patrón (RegExp, sin distinguir mayúsculas) de su familia (tarifas que añaden códigos)
 *   decimals                      decimales del precio unitario (4 por defecto, máx. 6)
 * Devuelve { items, warnings:[{code,message,count?}], ignored:[{ref,reason}], unknown:[ref], extras:[ref], retire:[ref], columns, stats:{rows,accepted,decimals,by:{ref,sku,id,rule}} }.
 *   retire = referencias (ya resueltas) cuya fila pide quitar el precio: active = 0 o precio 0; `by` cuenta las filas aceptadas según cómo se reconocieron.
 */
export function readSheet(rows, ctx = {}) {
  const dec = Math.min(6, Math.max(0, Number.isInteger(ctx.decimals) ? ctx.decimals : DEFAULT_DECIMALS));
  const lines = ctx.lines || null, skus = ctx.skus || {}, rules = ctx.rules || [];
  if (!rows || rows.length < 2) throw new Error('La hoja está vacía');
  const h = findHeader(rows);
  if (!h) throw new Error('No encuentro la cabecera: la hoja necesita las columnas de referencia (ref, Referencia, Artículo, Código, SKU… o ID de producto) y de precio (price, Precio, Precio venta, PVP…)');
  const { map, headers } = h;
  const warnings = [], ignored = [], unknown = [], extras = [], retire = [], items = {}, seen = new Map(), by = { ref: 0, sku: 0, id: 0, rule: 0 };
  const norm = lines ? new Map(Object.keys(lines).map((r) => [normRef(r), r])) : null;
  /** Celda de la fila r en la columna del campo f; cadena vacía si la hoja no tiene esa columna. */
  const col = (r, f) => (map[f] == null ? '' : r[map[f]]);
  for (const f of Object.keys(IGNORED_COLS)) if (map[f] != null) warnings.push({ code: 'columna_no_usada', message: `La columna «${headers[map[f]]}» no se usa (los precios de oferta y el stock no se publican)` });
  const MODELS = 'el producto tiene modelos: poner el precio en la referencia de cada modelo';
  /** Resuelve la fila a una línea del catálogo: { target, kind:'ref'|'sku'|'id'|'rule', extra? } · { skip: motivo } · { unknown: true }. Primero la referencia, luego el SKU, luego la familia nueva; el ID solo si la fila no trae referencia. */
  const resolve = (refRaw, idRaw, r) => {
    if (!norm) return { target: refRaw || 'P' + idRaw, kind: refRaw ? 'ref' : 'id' };
    if (refRaw) {
      const hit = norm.get(normRef(refRaw));
      if (hit) return { target: hit, kind: 'ref' };
      const pid = skus[refRaw] ?? skus[refRaw.toLowerCase()];
      if (pid != null) { const gen = norm.get(normRef('P' + pid)); return gen ? { target: gen, kind: 'sku' } : { skip: MODELS }; }       // fila por PRODUCTO (WooCommerce): precio de su línea genérica
      const rule = rules.find((x) => new RegExp(x.pattern, 'i').test(normRef(refRaw)));
      if (rule) return { target: normRef(refRaw), kind: 'rule', extra: { pid: rule.pid, n: String(col(r, 'name') || '').replace(/\s+/g, ' ').trim() || refRaw } };
      return { unknown: true };
    }
    const m = /^P?(\d+)$/i.exec(idRaw);                                                                                                        // fila identificada solo por el ID del producto
    if (m) {
      const gen = norm.get(normRef('P' + m[1]));
      if (gen) return { target: gen, kind: 'id' };
      if (Object.values(lines).some((l) => String(l.pid) === m[1])) return { skip: MODELS };
    }
    return { unknown: true };
  };
  /** Anota para retirar la línea a la que apunta la fila (si se reconoce); las desconocidas no cuentan como tales. */
  const retireRow = (refRaw, idRaw, r) => { const rs = resolve(refRaw, idRaw, r); if (rs.target && !retire.includes(rs.target)) retire.push(rs.target); };
  let rowsRead = 0, empty = 0;
  for (const r of rows.slice(h.index + 1)) {
    if (!r || r.every((c) => c === '' || c == null)) continue;
    rowsRead++;
    const refRaw = String(col(r, 'ref') ?? '').replace(/[\s ]+/g, ' ').trim(), idRaw = String(col(r, 'product_id') ?? '').replace(/[\s ]+/g, ' ').trim();
    const ref = refRaw || idRaw;
    if (!ref) continue;
    if (map.active != null && ['0', 'no', 'false', 'n', 'inactivo'].includes(String(col(r, 'active')).trim().toLowerCase())) { ignored.push({ ref, reason: 'desactivada (active = 0)' }); retireRow(refRaw, idRaw, r); continue; }
    const p0 = parseNumber(col(r, 'price'));
    if (p0 == null) { empty++; if (String(col(r, 'price') ?? '').trim() !== '') ignored.push({ ref, reason: `precio ilegible «${String(col(r, 'price')).slice(0, 20)}»` }); continue; }
    if (p0 < 0) { ignored.push({ ref, reason: 'precio negativo' }); continue; }
    if (p0 === 0) { ignored.push({ ref, reason: 'precio 0 (se muestra «Consultar»)' }); retireRow(refRaw, idRaw, r); continue; }
    const price = roundTo(p0, dec);
    const rs = resolve(refRaw, idRaw, r);
    if (rs.skip) { ignored.push({ ref, reason: rs.skip }); continue; }
    if (rs.unknown) { unknown.push(ref); continue; }
    const { target, extra = null } = rs;
    const t = [];
    for (const k of [2, 3, 4]) { const q = parseNumber(map['qty' + k] == null ? null : r[map['qty' + k]]), pp = parseNumber(map['price' + k] == null ? null : r[map['price' + k]]); if (q && q > 1 && pp != null && pp >= 0) t.push([Math.floor(q), roundTo(pp, dec)]); }
    t.sort((a, b) => a[0] - b[0]);
    const note = map.note != null && col(r, 'note') ? String(col(r, 'note')).slice(0, 120) : '';
    if (seen.has(target)) {                                                                     // referencia repetida (p. ej. las filas EN/FR/DE de WooCommerce)
      if (seen.get(target) !== price) warnings.push({ code: 'duplicada', message: `«${target}» aparece varias veces con precios distintos (${seen.get(target)} y ${price}); se usa el primero` });
      continue;
    }
    seen.set(target, price); by[rs.kind]++;
    items[target] = { p: price, ...(t.length ? { t } : {}), ...(note ? { note } : {}), ...(extra ? extra : {}) };
    if (extra) extras.push(target);
  }
  const n = Object.keys(items).length;
  if (n >= 10) {                                                                                // precio de relleno (p. ej. 22000 en todas las filas)
    const freq = new Map(); for (const v of Object.values(items)) freq.set(v.p, (freq.get(v.p) || 0) + 1);
    const [top, cnt] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
    if (cnt / n > 0.6) warnings.push({ code: 'precio_de_relleno', message: `El ${Math.round((100 * cnt) / n)} % de los precios es ${top}: parece un valor de relleno, no una tarifa`, count: cnt });
  }
  if (unknown.length) warnings.push({ code: 'referencias_desconocidas', message: `${unknown.length} referencias de la hoja no están en la web ni encajan en ninguna familia (no se publican)`, count: unknown.length });
  if (extras.length) warnings.push({ code: 'referencias_nuevas', message: `${extras.length} referencias nuevas se publican dentro de su producto (códigos de la tarifa que el catálogo de la web no tenía)`, count: extras.length });
  if (empty) warnings.push({ code: 'sin_precio', message: `${empty} filas sin precio: se muestran como «Consultar»`, count: empty });
  return { items, warnings, ignored, unknown, extras, retire, columns: Object.fromEntries(Object.entries(map).map(([f, i]) => [f, headers[i]])), stats: { rows: rowsRead, accepted: n, decimals: dec, by } };
}
