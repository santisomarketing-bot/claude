#!/usr/bin/env node
// [QA-BLOG-PANEL] El editor del blog del panel, en un navegador de verdad (Chromium) sobre el paquete desplegado en un Apache real con PHP-FPM: entrar, escribir una entrada con la barra de herramientas y la
// vista previa en vivo, subir una imagen (se comprime en el navegador), rellenar el SEO y ver cómo sale en Google, publicarla, verla en la web, crear su traducción (hreflang en las dos), previsualizar un borrador
// con la dirección firmada, programar una entrada para el futuro, comprobar errores de validación, la protección de cambios sin guardar y el borrado; con axe-core (accesibilidad) sobre el listado y el editor.
// Necesita apache2, php-fpm y Playwright (npm i --no-save playwright); si falta Apache, avisa y sale sin fallo.
//   node scripts/qa-blog-panel.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { apacheAvailable } from './lib/apache.mjs';
import { deployPackage, png, MANAGER_PASS } from './lib/pkg-apache.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const why = apacheAvailable();
if (why) { console.log(`(se omite: ${why})`); process.exit(0); }
const AXE = [process.env.AXE_PATH, path.join(ROOT, 'node_modules/axe-core/axe.min.js'), '/tmp/axe-install/node_modules/axe-core/axe.min.js'].filter(Boolean).find((p) => fs.existsSync(p));

let fails = 0;
/** Registra una comprobación: muestra el mensaje m como acierto o error según c y, si falla, suma un fallo. */
const ok = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

const d = await deployPackage({ staging: true, local: true });
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-ES' });          // español: con otro idioma, la web redirige en la primera visita a la portada de ese idioma (es lo que debe hacer)
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  let dialogs = [];
  page.on('dialog', async (dl) => { dialogs.push(dl.message()); await (page.__dialogAnswer === false ? dl.dismiss() : dl.type() === 'prompt' ? dl.accept(page.__promptValue || '') : dl.accept()); });
  /** Texto del aviso emergente del panel (#toast), tras una pausa corta para que aparezca. */
  const toast = async () => { await page.waitForTimeout(300); return page.locator('#toast').innerText(); };
  /** Espera a que el editor esté pintado. */
  const editor = () => page.waitForSelector('[data-bl-mode=edit]', { timeout: 8000 });
  /** Analiza con axe la pantalla actual y anota las violaciones graves. */
  const axe = async (label) => {
    if (!AXE) return;
    await page.mouse.move(0, 0); await page.waitForTimeout(400);
    await page.evaluate(fs.readFileSync(AXE, 'utf8'));
    const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }));
    const bad = res.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    ok(bad.length === 0, `accesibilidad (axe) en ${label}: ${bad.length} problemas graves` + (bad.length ? ' — ' + bad.map((v) => `${v.id} (${v.nodes[0].target.join(' ')})`).join('; ') : ''));
  };

  console.log(`panel: ${d.BASE}/admin/ (Apache real + PHP-FPM)`);
  console.log('\n1) acceso y menú');
  await page.goto(d.BASE + '/admin/index.html');
  await page.fill('[name=email]', 'jefa@torivac.com'); await page.fill('[name=pass]', MANAGER_PASS); await page.click('button[type=submit]');
  await page.waitForSelector('.side nav a');
  const nav = await page.$$eval('.side nav a', (a) => a.map((x) => x.textContent.replace(/[^\p{L} ]/gu, '').trim()));
  ok(nav.includes('Blog'), `el manager ve «Blog» en el menú (${nav.join(' · ')})`);

  console.log('\n2) listado vacío y entrada nueva');
  await page.click('.side nav a[href="#blog"]');
  await page.waitForSelector('[data-bl-mode=list]');
  ok(/Todavía no hay entradas/.test(await page.locator('[data-bl-rows]').innerText()), 'listado vacío con una indicación clara');
  ok((await page.locator('.kpi strong').allInnerTexts()).join() === '0,0,0', 'contadores a cero');
  await axe('el listado del blog');
  await page.click('a[href="#blog/nueva"]');
  await editor();
  await page.fill('[data-bl-f=title]', 'Cómo elegir un transformador toroidal');
  ok(await page.inputValue('[data-bl-f=slug]') === 'como-elegir-un-transformador-toroidal', 'la dirección sale sola del título, sin acentos');
  ok(/Será: http:\/\/127\.0\.0\.1:\d+\/blog\/como-elegir-un-transformador-toroidal\//.test(await page.locator('[data-bl-url]').innerText()), 'y enseña la dirección completa');
  ok((await page.locator('[data-bl-count=title]').innerText()) === '37/120', 'contador de caracteres del título');
  await page.fill('[data-bl-f=title]', 'Cómo elegir un transformador toroidal para tu equipo');
  await page.fill('[data-bl-f=slug]', 'elegir-toroidal'); await page.fill('[data-bl-f=title]', 'Cómo elegir un transformador toroidal');
  ok(await page.inputValue('[data-bl-f=slug]') === 'elegir-toroidal', 'si la persona escribe su dirección, el título deja de cambiarla');
  await page.fill('[data-bl-f=excerpt]', 'Guía rápida para elegir la potencia de un transformador toroidal.');

  console.log('\n3) texto: barra de herramientas y vista previa en vivo');
  const ta = page.locator('[data-bl-f=markdown]');
  await ta.fill('Elegir un transformador toroidal empieza por la potencia.\n\nSuma la potencia de todo lo que va a alimentar y deja un margen.');
  await page.waitForTimeout(150);
  ok(await page.locator('[data-bl-prev] p').count() === 2, 'la vista previa muestra los dos párrafos al escribir');
  await ta.evaluate((el) => { const i = el.value.indexOf('un margen'); el.focus(); el.setSelectionRange(i, i + 9); });
  await page.click('[data-tool=bold]');
  ok((await ta.inputValue()).includes('deja **un margen**'), 'Negrita rodea la selección con **');
  ok(await page.locator('[data-bl-prev] strong').innerText() === 'un margen', 'y la vista previa la muestra en negrita');
  await ta.evaluate((el) => { el.focus(); el.setSelectionRange(0, 0); });
  await page.click('[data-tool=h2]');
  ok((await ta.inputValue()).startsWith('## Elegir un transformador'), 'Título pone ## delante de la línea');
  await ta.evaluate((el) => { el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
  await page.click('[data-tool=table]');
  await page.click('[data-tool=ul]');
  await ta.press('Control+i');
  ok(await page.locator('[data-bl-prev] .tbl-wrap table').count() === 1 && /<th>Columna 1<\/th>/.test(await page.locator('[data-bl-prev]').innerHTML()), 'Tabla inserta una tabla y se ve en la vista previa');
  await page.__setPrompt;
  page.__promptValue = '/product/transformadores-toroidales/';
  await ta.evaluate((el) => { const i = el.value.indexOf('potencia de todo'); el.focus(); el.setSelectionRange(i, i + 8); });
  await page.click('[data-tool=link]');
  ok((await ta.inputValue()).includes('[potencia](/product/transformadores-toroidales/)'), 'Enlace pide la dirección y envuelve la selección');
  ok(await page.locator('[data-bl-prev] a[href="/product/transformadores-toroidales/"]').count() === 1, 'el enlace sale en la vista previa');
  ok(/\d+ palabras/.test(await page.locator('[data-bl-words]').innerText()), 'cuenta de palabras');
  await page.click('[data-bl=tab][data-v=write]');
  ok(!(await page.locator('[data-bl-prev]').isVisible()), '«Escribir» oculta la vista previa');
  await page.click('[data-bl=tab][data-v=both]');
  // un texto hostil se escribe tal cual, no se ejecuta
  await ta.fill('Texto <script>window.__xss = 1</script> y <img src=x onerror="window.__xss = 2"> y [x](javascript:window.__xss=3)');
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => window.__xss === undefined) && await page.locator('[data-bl-prev] script').count() === 0 && await page.locator('[data-bl-prev] img').count() === 0, 'HTML y javascript: escritos en el texto no se ejecutan ni salen como etiquetas en la vista previa');
  await ta.fill('Elegir un transformador toroidal empieza por la potencia: suma la de todo lo que va a alimentar y deja un **margen del 20 %**.\n\n## Potencia y margen\n\nCon una carga de 120 VA conviene un transformador de 150 VA. Consulta [nuestros toroidales](/product/transformadores-toroidales/).\n\n### Series habituales\n\n| Serie | Potencia (VA) |\n|---|---|\n| TT | 20 |\n| TTE | 300 |\n\n- Menos calentamiento\n- Menos ruido\n\n> Un margen del 20 % alarga la vida útil.');

  console.log('\n4) imágenes: subir comprimiendo en el navegador, destacada y dentro del texto');
  await page.click('[data-bl=pick-cover]');
  await page.waitForSelector('dialog[open] [data-bl-file]', { state: 'attached' });
  const big = png(2000, 1000, [30, 90, 160]);
  await page.setInputFiles('dialog[open] [data-bl-file]', { name: 'Foto Toroidal.png', mimeType: 'image/png', buffer: big });
  await page.waitForSelector('dialog[open] [data-bl-picked]:not([hidden])', { timeout: 15000 });
  ok(await page.locator('dialog[open] .bl-thumb').count() === 1, 'la imagen subida aparece en el cuadro de imágenes');
  const files = fs.readdirSync(path.join(d.ap.dataDir, 'media'));
  ok(files.length === 1 && /^foto-toroidal-|^como-elegir-un-transformador-toroidal-[0-9a-f]{12}\.webp$/.test(files[0]), `se guardó una sola imagen con nombre de contenido: ${files[0]}`);
  const sz = fs.statSync(path.join(d.ap.dataDir, 'media', files[0])).size;
  ok(sz < big.length && sz < 200000, `comprimida en el navegador: ${Math.round(big.length / 1024)} KB → ${Math.round(sz / 1024)} KB`);
  await page.click('dialog[open] [data-bl=use]');
  ok(await page.locator('dialog[open] [data-bl-pickalt][aria-invalid=true]').count() === 1, 'sin texto alternativo no se puede usar la imagen (se marca el campo)');
  await page.fill('dialog[open] [data-bl-pickalt]', 'Transformador toroidal azul');
  await page.click('dialog[open] [data-bl=use]');
  await page.waitForSelector('[data-bl-cover] img');
  ok(await page.inputValue('[data-bl-f=image_alt]') === 'Transformador toroidal azul', 'la imagen destacada queda con su texto alternativo');
  await ta.evaluate((el) => { el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
  await page.click('[data-tool=image]');
  await page.waitForSelector('dialog[open] .bl-thumb');
  await page.click('dialog[open] .bl-thumb');
  await page.fill('dialog[open] [data-bl-pickalt]', 'Detalle del bobinado');
  await page.fill('dialog[open] [data-bl-pickcap]', 'Bobinado de cobre');
  await page.click('dialog[open] [data-bl=use]');
  ok(/!\[Detalle del bobinado\]\(\/media\/blog\/[a-z0-9-]+-[0-9a-f]{12}\.webp "Bobinado de cobre"\)/.test(await ta.inputValue()), 'insertar imagen en el texto: ![alt](ruta "pie")');
  await page.waitForTimeout(250);
  ok(await page.locator('[data-bl-prev] figure img[alt="Detalle del bobinado"]').count() === 1 && await page.locator('[data-bl-prev] figcaption').innerText() === 'Bobinado de cobre', 'y la vista previa la enseña con su pie');

  console.log('\n5) SEO: vista previa de Google y lista de comprobación');
  await page.fill('[data-bl-f=seo_title]', 'Cómo elegir un transformador toroidal | Torivac');
  await page.fill('[data-bl-f=seo_description]', 'Guía para elegir la potencia de un transformador toroidal: margen del 20 %, series habituales y errores frecuentes.');
  const serp = await page.locator('[data-bl-serp]').innerText();
  ok(serp.includes('Cómo elegir un transformador toroidal | Torivac') && /127\.0\.0\.1:\d+\/blog\/elegir-toroidal\//.test(serp) && serp.includes('margen del 20 %'), 'la vista previa de Google enseña título, dirección y descripción');
  const chk = await page.locator('[data-bl-check] li').allInnerTexts();
  ok(chk.length >= 8 && chk.some((t) => /Título para buscadores/.test(t) && t.startsWith('✓')) && chk.some((t) => /300 palabras/.test(t) && t.startsWith('⚠')) && chk.some((t) => /imágenes del texto llevan texto alternativo/.test(t) && t.startsWith('✓')), `lista de comprobación: ${chk.length} puntos, con aciertos y avisos`);

  console.log('\n6) guardar como publicada, ver en la web');
  await page.selectOption('[data-bl-f=status]', 'published');
  ok(/Al guardar se publica con la fecha de ahora/.test(await page.locator('[data-bl-when]').innerText()), 'el panel explica que se publicará ahora');
  await axe('el editor del blog');
  await page.click('[data-bl=save]');
  await page.waitForFunction(() => /^#blog\/bp-[0-9a-f]{12}$/.test(location.hash), null, { timeout: 8000 });
  await editor();
  // identificador de la primera entrada creada (sale de la dirección del panel: #blog/<id>)
  const id1 = (await page.evaluate(() => location.hash)).slice(6);
  ok(true, 'creada: ' + id1);
  ok(await page.inputValue('[data-bl-f=title]') === 'Cómo elegir un transformador toroidal' && await page.inputValue('[data-bl-f=markdown]') !== '', 'al volver a abrirla conserva todo lo escrito');
  const view = page.locator('[data-bl-view]');
  ok(!(await view.isHidden()) && /\/blog\/elegir-toroidal\/$/.test(await view.getAttribute('href')), '«Ver en la web» aparece con su dirección');
  const pub = await ctx.newPage();
  const r1 = await pub.goto(await view.getAttribute('href'));
  ok(r1.status() === 200 && await pub.locator('h1').count() === 1 && (await pub.locator('h1').textContent()) === 'Cómo elegir un transformador toroidal', 'la entrada se ve en la web con su h1');
  ok((await pub.locator('.prose h2').first().textContent()) === 'Potencia y margen' && await pub.locator('.prose table').count() === 1 && await pub.locator('.prose figure img').count() === 2 && await pub.locator('.prose > .o-dup figure img').count() === 1, 'con su texto, tabla, la imagen destacada al principio y la imagen del texto');
  ok(await pub.locator('.page-hero').evaluate((el) => /media\/blog\//.test(el.style.backgroundImage)), 'y la imagen destacada de fondo en la cabecera');
  const imgOk = await pub.locator('.prose figure img').evaluateAll((imgs) => imgs.every((img) => img.complete && img.naturalWidth > 0));
  ok(imgOk, 'las dos imágenes cargan de verdad (200 y se decodifican)');
  ok(await pub.locator('link[rel=canonical]').getAttribute('href') === d.BASE + '/blog/elegir-toroidal/', 'canonical correcto');
  ok(await pub.locator('header.site-header').count() === 1 && await pub.locator('footer.site-footer').count() === 1, 'con la cabecera y el pie de la web');
  await pub.close();
  // si la web no sirviera la entrada (el servidor no aplica las reglas del .htaccess del blog), el panel lo avisa al guardar y lo dice con claridad
  await page.route('**/blog/elegir-toroidal/', (route) => route.fulfill({ status: 404, body: 'no' }));
  await page.fill('[data-bl-f=excerpt]', 'Guía rápida para elegir la potencia de un transformador toroidal.');
  await page.click('[data-bl=save]');
  await page.waitForFunction(() => /todavía no la muestra \(error 404\)/.test((document.querySelector('[data-bl-msg]') || {}).textContent || ''), null, { timeout: 8000 });
  ok(/docs\/BLOG\.md/.test(await page.locator('[data-bl-msg]').innerText()), 'si la web no sirve la entrada guardada, el panel avisa (error 404) y remite a la guía');
  await page.unroute('**/blog/elegir-toroidal/');
  await page.click('[data-bl=save]');
  await page.waitForFunction(() => (document.querySelector('[data-bl-msg]') || {}).hidden === true, null, { timeout: 8000 });
  ok(true, 'y al guardarla otra vez con la web funcionando, el aviso desaparece');

  console.log('\n7) traducción: crear, enlazar y comprobar el hreflang');
  await page.click('a[href^="#blog/nueva?lang=en"]');
  await editor();
  ok(await page.inputValue('[data-bl-f=lang]') === 'en' && await page.locator('[data-bl-tr=es] option[selected]').count() === 1, 'la traducción nace en inglés y ya enlazada con la original');
  await page.fill('[data-bl-f=title]', 'How to choose a toroidal transformer');
  await page.fill('[data-bl-f=markdown]', 'Choosing a toroidal transformer starts with power: add up everything it will supply and leave a **20 %** margin.\n\n## Power and margin\n\nA 120 VA load calls for a 150 VA transformer.');
  await page.selectOption('[data-bl-f=status]', 'published');
  await page.click('[data-bl=save]');
  await page.waitForFunction(() => /^#blog\/bp-[0-9a-f]{12}$/.test(location.hash), null, { timeout: 8000 });
  await editor();
  // identificador de la entrada en inglés (traducción de la primera)
  const id2 = (await page.evaluate(() => location.hash)).slice(6);
  const esPage = await ctx.newPage(); await esPage.goto(d.BASE + '/blog/elegir-toroidal/'); await esPage.reload();          // las páginas se guardan 1 minuto en la caché del navegador: recargar las revalida
  ok(await esPage.locator('link[rel=alternate][hreflang=en]').getAttribute('href') === d.BASE + '/en/blog/how-to-choose-a-toroidal-transformer/', 'la entrada en español ya apunta a la inglesa (hreflang en)');
  ok(await esPage.locator('.lang a[hreflang=en]').getAttribute('href') === '/en/blog/how-to-choose-a-toroidal-transformer/', 'y el selector de idioma lleva a la traducción');
  const enPage = await ctx.newPage(); await enPage.goto(d.BASE + '/en/blog/how-to-choose-a-toroidal-transformer/');
  ok(await enPage.locator('link[rel=alternate][hreflang=es]').getAttribute('href') === d.BASE + '/blog/elegir-toroidal/' && await enPage.locator('link[rel=alternate][hreflang=x-default]').getAttribute('href') === d.BASE + '/blog/elegir-toroidal/', 'la inglesa apunta a la española (es y x-default)');
  ok(/Published/i.test(await enPage.locator('.post-meta').textContent()), 'y su cabecera está en inglés');
  await esPage.close(); await enPage.close();
  // desde el editor de la española se ve la traducción elegida
  await page.goto(d.BASE + '/admin/index.html#blog/' + id1); await editor();
  ok(await page.inputValue('[data-bl-tr=en]') === id2, 'en el editor de la española, la traducción inglesa aparece elegida');

  console.log('\n8) borrador: «Ver como saldrá» con dirección firmada, sin indexar');
  await page.goto(d.BASE + '/admin/index.html#blog/nueva'); await editor();
  await page.fill('[data-bl-f=title]', 'Borrador de prueba');
  await page.fill('[data-bl-f=markdown]', 'Texto del borrador que todavía no se publica.');
  const [popup] = await Promise.all([ctx.waitForEvent('page'), page.click('[data-bl=preview]')]);
  await popup.waitForURL(/tvp=bp-[0-9a-f]{12}\.\d+\.[0-9a-f]{64}/, { timeout: 10000 });
  await popup.waitForLoadState('domcontentloaded');
  ok((await popup.locator('h1').textContent()) === 'Borrador de prueba' && /noindex/.test(await popup.locator('meta[name=robots]').getAttribute('content')), 'se abre la página real del borrador, con noindex');
  const draftUrl = popup.url().split('?')[0];
  await popup.close();
  const anon = await browser.newContext({ locale: 'es-ES' }); const ap = await anon.newPage();
  ok((await ap.goto(draftUrl)).status() === 404, 'sin la firma, el borrador es un 404 para cualquiera');
  await anon.close();

  console.log('\n9) validación, programación y cambios sin guardar');
  await page.goto(d.BASE + '/admin/index.html#blog/nueva'); await editor();
  await page.fill('[data-bl-f=title]', ''); await page.click('[data-bl=save]');
  await page.waitForSelector('[data-bl-msg]:not([hidden])');
  ok(/título es obligatorio/i.test(await page.locator('[data-bl-msg]').innerText()) && await page.locator('[data-bl-f=title][aria-invalid=true]').count() === 1, 'sin título: el servidor lo dice y el campo queda marcado');
  await page.fill('[data-bl-f=title]', 'Entrada programada'); await page.fill('[data-bl-f=markdown]', 'Saldrá dentro de unos días.');
  await page.fill('[data-bl-f=slug]', 'Elegir-Toroidal'); await page.click('[data-bl=save]');
  await page.waitForTimeout(500);
  ok(/slug|dirección/i.test(await page.locator('[data-bl-msg]').innerText()) && /ya hay una entrada/i.test(await page.locator('[data-bl-msg]').innerText()), 'una dirección repetida se rechaza con un mensaje claro');
  await page.fill('[data-bl-f=slug]', 'entrada-programada');
  await page.selectOption('[data-bl-f=status]', 'published');
  const in3 = new Date(Date.now() + 3 * 864e5); const pad = (n) => String(n).padStart(2, '0');
  await page.fill('[data-bl-f=date]', `${in3.getFullYear()}-${pad(in3.getMonth() + 1)}-${pad(in3.getDate())}T10:00`);
  ok(/queda programada/.test(await page.locator('[data-bl-when]').innerText()), 'con fecha futura el panel dice que queda programada');
  await page.click('[data-bl=save]');
  await page.waitForFunction(() => /^#blog\/bp-[0-9a-f]{12}$/.test(location.hash), null, { timeout: 8000 });
  const anon2 = await browser.newContext({ locale: 'es-ES' }); const ap2 = await anon2.newPage();
  ok((await ap2.goto(d.BASE + '/blog/entrada-programada/')).status() === 404, 'la programada no se ve todavía en la web');
  await anon2.close();
  // cambios sin guardar
  await editor(); await page.fill('[data-bl-f=title]', 'Entrada programada (cambiada)');
  ok(await page.locator('[data-bl-dirty]').innerText() !== '', 'el panel avisa de que hay cambios sin guardar');
  page.__dialogAnswer = false; dialogs = [];
  await page.click('.side nav a[href="#mensajes"]');
  ok(dialogs.some((m) => /cambios sin guardar/.test(m)) && (await page.evaluate(() => location.hash)).startsWith('#blog/'), 'salir con cambios sin guardar pide confirmación y, si se cancela, se queda');
  page.__dialogAnswer = true;
  await page.click('.side nav a[href="#mensajes"]');
  await page.waitForFunction(() => location.hash === '#mensajes');
  ok(true, 'si se acepta, se sale');

  console.log('\n10) listado con filtros y borrado');
  await page.click('.side nav a[href="#blog"]');
  await page.waitForSelector('[data-bl-mode=list]');
  const rows = await page.locator('[data-bl-rows] tr').count();
  ok(rows === 4, `el listado muestra las 4 entradas guardadas: 2 publicadas, el borrador y la programada (${rows})`);
  const tags = await page.locator('[data-bl-rows] .bl-state').allTextContents();
  ok(tags.filter((t) => t === 'Publicada').length === 2 && tags.filter((t) => t === 'Borrador').length === 1 && tags.filter((t) => /^Programada/.test(t)).length === 1, `estados: ${tags.join(' · ')}`);
  await page.selectOption('[data-bl-filter=lang]', 'en');
  ok(await page.locator('[data-bl-rows] tr').count() === 1, 'filtro por idioma: solo la inglesa');
  await page.selectOption('[data-bl-filter=lang]', ''); await page.selectOption('[data-bl-filter=status]', 'scheduled');
  ok(await page.locator('[data-bl-rows] tr').count() === 1 && /programada/i.test(await page.locator('[data-bl-rows]').innerText()), 'filtro por estado: la programada');
  await page.selectOption('[data-bl-filter=status]', ''); await page.fill('[data-bl-filter=q]', 'toroidal');
  ok(await page.locator('[data-bl-rows] tr').count() === 2, 'buscar por texto («toroidal»: la española y la inglesa)');
  await page.fill('[data-bl-filter=q]', '');
  dialogs = [];
  await page.locator('[data-bl-rows] tr', { hasText: 'Entrada programada' }).locator('[data-bl=del-row]').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-bl-rows] tr').length === 3);
  ok(dialogs.some((m) => /Borrar la entrada «Entrada programada»/.test(m)), 'borrar pide confirmación con el título');
  const del = await d.req('/blog/entrada-programada/'); ok(del.s === 404, 'y deja de existir');
  await axe('el listado con entradas');
  ok(errs.length === 0, 'sin errores de JavaScript en el panel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));

  console.log('\n11) la web pública vista en un navegador');
  const sm = await d.req('/blog/'); ok(sm.s === 200 && sm.t.includes('elegir-toroidal') && sm.t.includes('post-card'), 'el listado público muestra la entrada nueva');
  const list = await ctx.newPage(); errs.length = 0;
  list.on('pageerror', (e) => errs.push(e.message));
  await list.goto(d.BASE + '/blog/');
  ok((await list.locator('.post-card').first().locator('h3').textContent()) === 'Cómo elegir un transformador toroidal', 'es la primera tarjeta (la más reciente)');
  const firstImg = await list.locator('.post-card').first().locator('img').evaluate((i) => i.complete || new Promise((r) => { i.onload = () => r(true); i.onerror = () => r(false); }));
  ok(firstImg === true || firstImg, 'su miniatura carga');
  await list.locator('.post-card').first().click();
  await list.waitForURL(/\/blog\/elegir-toroidal\/$/);
  ok(errs.length === 0, 'sin errores de JavaScript al navegar de la tarjeta a la entrada');
  await list.close();
  const errLog = d.ap.log(); ok(!/PHP (Fatal|Parse|Warning|Notice|Deprecated)/.test(errLog), 'PHP sin errores ni avisos');
  await ctx.close();
} catch (e) {
  fails++; console.error('  ✗ error en la prueba: ' + (e && e.stack || e)); console.error(d.ap.log());
} finally { await browser.close(); await d.stop(); }

console.log(fails ? `\n✗ ${fails} comprobaciones fallidas` : '\n✓ Editor del blog en el navegador: escribir, imagen, SEO, publicar, traducir, previsualizar, programar, validar y borrar correctos');
process.exit(fails ? 1 : 0);
