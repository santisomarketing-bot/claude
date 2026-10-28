// Pruebas de la lectura tolerante de hojas de precios (shared/price-sheet.mjs) con los casos compartidos (shared/price-sheet.fixtures.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readSheet, parseNumber } from '../../../shared/price-sheet.mjs';
const FX = JSON.parse(fs.readFileSync(new URL('../../../shared/price-sheet.fixtures.json', import.meta.url), 'utf8'));

for (const c of FX.cases) {
  test(`hoja de precios · ${c.name}`, () => {
    const r = readSheet(c.rows, c.ctx);
    const e = c.expect;
    if (e.items) for (const [ref, want] of Object.entries(e.items)) assert.deepEqual(r.items[ref], want, `item ${ref}`);
    if (e.itemSample) for (const [ref, want] of Object.entries(e.itemSample)) assert.equal(r.items[ref].p, want.p);
    if (e.acceptedCount != null) assert.equal(Object.keys(r.items).length, e.acceptedCount);
    if (e.unknown) assert.deepEqual(r.unknown, e.unknown);
    if (e.extras) assert.deepEqual(r.extras, e.extras);
    if (e.ignoredReasons) assert.deepEqual([...new Set(r.ignored.map((x) => x.reason))].sort(), [...new Set(e.ignoredReasons)].sort());
    assert.deepEqual(r.warnings.map((w) => w.code).sort(), [...e.warningCodes].sort(), 'avisos');
  });
}
test('hoja de precios · números en formato español, inglés, con miles y símbolos', () => {
  for (const [raw, want] of FX.numbers) assert.equal(parseNumber(raw), want, `«${raw}»`);
});
test('hoja de precios · sin cabecera reconocible se explica qué columnas hacen falta', () => {
  assert.throws(() => readSheet(FX.no_header), /columnas de referencia/);
  assert.throws(() => readSheet([['ref', 'price']]), /vacía/);
});
