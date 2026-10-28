/**
 * [PDF] Generador del PDF de presupuesto en el navegador (jsPDF + autoTable, ambos locales en assets/vendor).
 * API: TV.makeQuotePdf({ customer, number }) → { doc, blob, filename }
 * Contenido: banda de marca, nº y fecha, datos del cliente, tabla con IMAGEN REFERENCIAL por línea, total, notas, aviso legal y marca DEMO si procede.
 * Las miniaturas de las líneas se embeben desde TV.thumbs (data-URL JPEG de 96 px generadas en build): así funciona también con file://.
 */
(function () {
  'use strict';
  var TV = window.TV, Q = TV.Quote;
  var INK = [16, 4, 4], COPPER = [156, 82, 15], AMBER = [255, 182, 83];

  TV.makeQuotePdf = function (opts) {
    // jsPDF usa Helvetica (WinAnsi): el espacio fino (U+202F) que usan fr/de en los miles sale como «/» → se cambia por espacio normal
    var fmt = { money: function (n) { return String(Q.money(n)).replace(/[\u202f\u2009\u00a0]/g, ' '); }, unit: function (n) { return String(Q.unitMoney(n)).replace(/[\u202f\u2009\u00a0]/g, ' '); } };
    opts = opts || {}; var c = opts.customer || {};
    var JS = window.jspdf && window.jspdf.jsPDF; if (!JS) throw new Error('jsPDF no cargado');
    var doc = new JS({ unit: 'mm', format: 'a4' });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    var d = opts.detail || Q.detail(), P = TV.prices || {};
    var number = opts.number || ('TV-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 9000) + 1000));
    var demo = P.mode === 'demo';

    // banda de marca
    doc.setFillColor.apply(doc, INK); doc.rect(0, 0, W, 30, 'F');
    if (TV.logo) { try { doc.addImage(TV.logo, 'PNG', 12, 3, 24, 24); /* el logotipo es CIRCULAR (1:1): nunca estirarlo */ } catch (e) { /* sin logo */ } } else { doc.setTextColor(255); doc.setFontSize(20); doc.text('TORIVAC', 12, 19); }
    doc.setTextColor(255); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(Q.t('quote').toUpperCase() + ' · ' + number, W - 12, 13, { align: 'right' });
    doc.text((opts.date ? new Date(opts.date) : new Date()).toLocaleDateString(Q.lang === 'en' ? 'en-GB' : Q.lang), W - 12, 19, { align: 'right' });
    doc.setFillColor.apply(doc, COPPER); doc.rect(0, 30, W, 1.2, 'F');
    doc.setTextColor(30);

    // cliente + emisor
    var y = 40; doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text(Q.t('your_data').toUpperCase(), 12, y); doc.setFont('helvetica', 'normal');
    var cust = [c.name, c.company, c.email, c.phone].filter(Boolean); cust.forEach(function (l, i) { doc.text(String(l), 12, y + 5 + i * 4.6); });
    var ct = (TV.meta && TV.meta.contact) || {}; doc.setFont('helvetica', 'bold'); doc.text('TORIVAC S.L.', W - 12, y, { align: 'right' }); doc.setFont('helvetica', 'normal');
    [].concat(ct.address || [], [ct.phone, ct.email]).filter(Boolean).forEach(function (l, i) { doc.text(String(l), W - 12, y + 5 + i * 4.6, { align: 'right' }); });
    y += 5 + Math.max(cust.length, 4) * 4.6 + 4;

    // tabla
    var body = d.lines.map(function (l) {
      return ['', (l.generic ? '' : l.ref + '\n') + l.name + (l.spec ? '\n' + l.spec : ''), String(l.qty), l.unit == null ? Q.t('on_request') : fmt.unit(l.unit), l.total == null ? Q.t('on_request') : fmt.money(l.total)];
    });
    var thumbs = d.lines.map(function (l) { var it = TV.items[l.ref] || {}; return it.th && TV.thumbs ? TV.thumbs[it.th] : null; });
    doc.autoTable({
      startY: y, margin: { left: 12, right: 12, bottom: 28 },
      head: [[Q.t('image'), Q.t('item'), Q.t('qty'), Q.t('unit_price'), Q.t('line_total')]],
      body: body, theme: 'grid', styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, valign: 'middle', lineColor: [225, 220, 214], lineWidth: 0.2, textColor: 30 },
      headStyles: { fillColor: INK, textColor: 255, fontSize: 8, halign: 'left' },
      columnStyles: { 0: { cellWidth: 20, minCellHeight: 18 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 16, halign: 'right' }, 3: { cellWidth: 28, halign: 'right' }, 4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' } },
      didDrawCell: function (data) {
        if (data.section === 'body' && data.column.index === 0 && thumbs[data.row.index]) {
          try { doc.addImage(thumbs[data.row.index], 'JPEG', data.cell.x + 2, data.cell.y + 2, 14, 14); } catch (e) { /* miniatura inválida */ }
        }
      },
    });
    var fy = doc.lastAutoTable.finalY + 6;
    if (fy > H - 50) { doc.addPage(); fy = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(Q.t('total'), W - 62, fy, { align: 'right' });
    doc.setFontSize(14); doc.text(fmt.money(d.total), W - 12, fy, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    var ny = fy + 7;
    if (d.unpriced) { doc.text(doc.splitTextToSize(Q.t('price_note_request'), W - 24), 12, ny); ny += 8; }
    if (c.notes) { doc.setFont('helvetica', 'bold'); doc.text(Q.t('notes'), 12, ny); doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(String(c.notes), W - 24), 12, ny + 4.5); }

    // pie en todas las páginas
    var pages = doc.internal.getNumberOfPages();
    for (var i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(110);
      doc.text(Q.t('pdf_footer') + (P.updated_at ? ' · ' + Q.t('price_updated') + ' ' + new Date(P.updated_at).toLocaleDateString() : ''), 12, H - 12);
      doc.text(i + ' / ' + pages, W - 12, H - 12, { align: 'right' });
      if (demo) { doc.setFillColor.apply(doc, AMBER); doc.rect(12, H - 9, W - 24, 5, 'F'); doc.setTextColor(16, 4, 4); doc.setFont('helvetica', 'bold'); doc.text(Q.t('demo_prices').toUpperCase(), W / 2, H - 5.4, { align: 'center' }); doc.setFont('helvetica', 'normal'); }
    }
    return { doc: doc, number: number, filename: number + '.pdf', blob: function () { return doc.output('blob'); } };
  };
})();
