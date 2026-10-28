/**
 * [ADMIN-SECURITY] Partes del panel (solo con el servidor PHP) que cuidan el acceso y la recuperación de los datos:
 *   · Usuarios: último acceso, «código por correo» por cuenta (la casilla de las cuentas de confianza), bloqueos con su botón «Desbloquear», contraseña nueva para otra cuenta, alta y baja.
 *   · Actividad: quién entró y quién cambió qué (GET /api/activity), con filtros y descarga en CSV.
 *   · Ajustes → «Tu cuenta y tu seguridad»: si te pide código, olvidar los dispositivos recordados y cambiar tu contraseña.
 *   · Ajustes → «Copias de seguridad»: la lista, crear una ahora, descargar (enlace firmado de 2 minutos) y borrar.
 * Los textos que llegan del servidor (correos, nombres, detalles de la actividad) se escapan SIEMPRE antes de pintarlos; el CSV neutraliza las fórmulas de hoja de cálculo.
 * API (se pinta en admin-live.js): TV.AdminSecurity.usersView(ctx) · activityView(ctx) · settingsPanels(ctx, me) → Promise<HTML>; bind(root, ctx) engancha los eventos de lo pintado.
 * `ctx` es lo que da admin-live.js: { http, toast, when, session, render, relogin }.
 * Estas partes existen solo con el servidor PHP del hosting. Con el Worker de Cloudflare la API responde «no encontrado» y cada vista lo dice en vez de romperse (Usuarios sigue pudiendo listar, crear y borrar).
 * Secciones: [UTIL] [USUARIOS] [ACTIVIDAD] [AJUSTES] [COPIAS] [EVENTOS]
 */
(function () {
  'use strict';
  var TV = (window.TV = window.TV || {});
  var S = (TV.AdminSecurity = {});
  /** Estado de la vista de actividad: los filtros y lo último cargado (para el CSV). */
  var act = { days: 7, u: '', cat: '', q: '', items: [], truncated: false };

  // ───────────────────────────────────────── [UTIL]
  /** Escapa & < > " para insertar texto en HTML; null y undefined dan cadena vacía. */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** Segundos de bloqueo → «54 min» o «1 h». */
  function lockText(secs) { return secs >= 3300 ? '1 h' : Math.max(1, Math.ceil(secs / 60)) + ' min'; }
  /** Bytes → «3,2 MB» / «840 KB». */
  function size(n) { return n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  /** Fecha ISO → «dd/mm/aaaa hh:mm» en la hora del navegador; «—» si no hay. */
  function when(iso) { if (!iso) return '—'; var d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  /** Aviso de error del servidor con su mensaje. */
  function fail(ctx, r) { ctx.toast('⚠ ' + ((r && r.error) || 'Error')); }
  /** Un mensaje de «no disponible en este servidor» (el Worker de Cloudflare no trae estas partes) o el error que devolvió el servidor. */
  function unavailable(title, r) { return '<h1>' + esc(title) + '</h1><p class="notice">' + esc(r && r.status === 404 ? 'Esta parte solo está disponible con el servidor PHP del hosting.' : (r && r.error) || 'No se pudo cargar.') + '</p>'; }

  // ───────────────────────────────────────── [USUARIOS]
  /** Texto y marca del estado de seguridad de un usuario: bloqueo, protección reforzada o nada. */
  function stateTags(u) {
    var t = [];
    if (u.locked_for > 0) t.push('<span class="tag warn">Bloqueada · ' + esc(lockText(u.locked_for)) + '</span>');
    if (u.reinforced_until) t.push('<span class="tag" title="Tras intentos repetidos, pide el código por correo en dispositivos nuevos">Protección reforzada hasta ' + esc(when(u.reinforced_until).slice(0, 10)) + '</span>');
    return t.length ? t.join(' ') : '<span class="muted small">—</span>';
  }
  /** La casilla «código por correo» de una cuenta de manager (los clientes no la usan salvo tras ataques repetidos). */
  function codeCell(u, meta) {
    if (u.role !== 'manager' || meta.enabled === undefined) return '<span class="muted small"' + (u.role !== 'manager' ? ' title="Los clientes solo lo piden si hay intentos repetidos contra su cuenta"' : '') + '>—</span>';
    if (meta.enabled === false) return '<span class="muted small">Desactivado en el servidor</span>';
    return '<select data-sec-two-step="' + esc(u.email) + '" aria-label="Código por correo de ' + esc(u.email) + '"><option value="1"' + (u.code === 'required' ? ' selected' : '') + '>Sí, lo pide</option><option value="0"' + (u.code === 'exempt' ? ' selected' : '') + '>No (cuenta de confianza)</option></select>';
  }
  /** Vista Usuarios (manager): la lista con su seguridad, alta de usuarios y contraseña nueva para una cuenta. */
  S.usersView = function (ctx) {
    return ctx.http('GET', '/api/users').then(function (r) {
      if (!r.ok) return unavailable('Usuarios', r);
      var me = (ctx.session() || {}).email, meta = r.two_step || {}, users = r.users || [];
      var rows = users.map(function (u) {
        var canUnlock = u.locked_for > 0 || u.reinforced_until;
        return '<tr><td>' + esc(u.name) + '</td><td class="mono">' + esc(u.email) + '</td><td>' + (u.role === 'manager' ? 'Manager' : 'Cliente') + '</td><td>' + esc(when(u.last_login)) + '</td><td>' + codeCell(u, meta) + '</td><td>' + stateTags(u) + '</td><td class="bl-actions">' +
          (canUnlock ? '<button class="btn sm ghost" data-sec-unlock="' + esc(u.email) + '"' + (u.reinforced_until ? ' data-sec-clear="1"' : '') + '>Desbloquear<span class="vh"> ' + esc(u.email) + '</span></button> ' : '') +
          (u.email !== me ? '<button class="btn sm ghost" data-sec-del-user="' + esc(u.email) + '">Borrar<span class="vh"> ' + esc(u.email) + '</span></button>' : '<span class="muted small">(tú)</span>') + '</td></tr>';
      }).join('');
      var warn = meta.enabled !== false && meta.mail === false ? '<p class="notice">El correo no está completo, así que de momento <strong>no se pide código a nadie</strong>. Se activa solo cuando el correo funcione (Ajustes → Correo).</p>' : '';
      var opts = users.map(function (u) { return '<option value="' + esc(u.email) + '">' + esc(u.name) + ' · ' + esc(u.email) + '</option>'; }).join('');
      return '<div data-sec-root data-sec-mode="users"><h1>Usuarios</h1>' + warn +
        '<p class="muted small">«Código por correo»: al entrar con la contraseña, a los managers se les manda un código de 6 cifras que hay que escribir; si marcan «recordar este dispositivo», no se les vuelve a pedir en él durante ' + Number(meta.remember_days || 30) + ' días. Una <strong>cuenta de confianza</strong> (la de quien administra la web) no lo pide nunca. Si una cuenta acumula bloqueos repetidos, se avisa por correo y se le pide el código en dispositivos nuevos durante 7 días.</p>' +
        '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Último acceso</th><th>Código por correo</th><th>Estado</th><th><span class="vh">Acciones</span></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<section class="panel"><h2>Nuevo usuario</h2><form class="form" data-sec-new-user><div class="grid2"><label>Nombre<input name="name" type="text" required autocomplete="off"></label><label>Correo<input name="email" type="email" required></label></div><div class="grid2"><label>Rol<select name="role"><option value="client">Cliente</option><option value="manager">Manager</option></select></label><label>Contraseña (mín. 12)<input name="password" type="password" minlength="12" required autocomplete="new-password"></label></div><p><button class="btn" type="submit">Crear usuario</button></p></form></section>' +
        '<section class="panel"><h2>Poner una contraseña nueva a una cuenta</h2><p class="muted small">Sirve si alguien la olvidó o si sospechas que la conocen otras personas. Se cierran todas sus sesiones y se olvidan sus dispositivos recordados. Díselo por un canal seguro: no la mandes por correo.</p><form class="form" data-sec-reset-pw><div class="grid2"><label>Cuenta<select name="email">' + opts + '</select></label><label>Contraseña nueva (mín. 12)<input name="password" type="password" minlength="12" required autocomplete="new-password"></label></div><p><button class="btn" type="submit">Guardar la contraseña nueva</button></p></form></section></div>';
    });
  };

  // ───────────────────────────────────────── [ACTIVIDAD]
  /** Categorías del filtro: lo que va antes del punto de la acción. */
  var CATS = [['', 'Todo'], ['login', 'Accesos'], ['logout', 'Salidas'], ['user', 'Usuarios'], ['prices', 'Precios'], ['proposal', 'Propuestas'], ['blog', 'Blog'], ['mail', 'Correo'], ['backup', 'Copias'], ['alert', 'Avisos de seguridad'], ['message', 'Mensajes']];
  /** Acciones que merecen un vistazo (intentos fallidos, bloqueos, avisos): salen marcadas. */
  var WARN = /^(login\.(fail|locked|pin_fail)|alert\.)/;
  /** Filas de la tabla de actividad. */
  function activityRows(items) {
    if (!items.length) return '<tr><td colspan="5" class="muted">No hay actividad con esos filtros.</td></tr>';
    return items.map(function (e) {
      var who = e.u || (e.a.indexOf('login.') === 0 ? '(sin cuenta)' : '—');
      return '<tr><td class="small">' + esc(when(e.t)) + '</td><td class="mono small">' + esc(who) + (e.r ? '<br><span class="muted">' + esc(e.r === 'manager' ? 'manager' : e.r === 'client' ? 'cliente' : e.r) + '</span>' : '') + '</td><td>' +
        (WARN.test(e.a) ? '<span class="tag warn">' + esc(e.label) + '</span>' : esc(e.label)) + '</td><td class="small">' + esc(e.d) + '</td><td class="mono small">' + esc(e.ip || '') + (e.ua ? '<br><span class="muted">' + esc(e.ua) + '</span>' : '') + '</td></tr>';
    }).join('');
  }
  /** Vista Actividad (manager): filtros, tabla y descarga. */
  S.activityView = function (ctx) {
    var q = '/api/activity?days=' + encodeURIComponent(act.days) + '&limit=500' + (act.u ? '&u=' + encodeURIComponent(act.u) : '') + (act.cat ? '&cat=' + encodeURIComponent(act.cat) : '') + (act.q ? '&q=' + encodeURIComponent(act.q) : '');
    return ctx.http('GET', q).then(function (r) {
      if (!r.ok) return unavailable('Actividad', r);
      act.items = r.items || []; act.truncated = !!r.truncated;
      var opt = function (v, t, cur) { return '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(t) + '</option>'; };
      return '<div data-sec-root data-sec-mode="activity"><h1>Actividad</h1><p class="muted">Quién entró al panel y quién cambió qué, con la hora y la dirección desde la que lo hizo. Se conserva ' + Number(r.keep_days || 180) + ' días y solo lo ven los managers. Los intentos de acceso fallidos se anotan de forma resumida (uno cada 10 minutos por visitante y cuenta).</p>' +
        '<form class="prop-bar" data-sec-filters><label>Período<select name="days">' + [[1, 'Hoy'], [7, 'Últimos 7 días'], [30, 'Últimos 30 días'], [180, 'Todo (180 días)']].map(function (d) { return opt(d[0], d[1], act.days); }).join('') + '</select></label>' +
        '<label>Tipo<select name="cat">' + CATS.map(function (c) { return opt(c[0], c[1], act.cat); }).join('') + '</select></label>' +
        '<label>Persona<input type="search" name="u" value="' + esc(act.u) + '" placeholder="correo" maxlength="120"></label><label>Buscar<input type="search" name="q" value="' + esc(act.q) + '" placeholder="en el detalle" maxlength="120"></label>' +
        '<button class="btn" type="submit">Aplicar</button> <button class="btn ghost" type="button" data-sec-csv>Descargar CSV</button></form>' +
        '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Detalle</th><th>Desde</th></tr></thead><tbody data-sec-rows>' + activityRows(act.items) + '</tbody></table></div>' +
        (act.truncated ? '<p class="muted small">Se muestran los 500 hechos más recientes; afina los filtros para ver más.</p>' : '<p class="muted small">' + act.items.length + ' hecho(s).</p>') + '</div>';
    });
  };
  /** Una celda de CSV: entre comillas y sin que una fórmula de hoja de cálculo (= + - @) se ejecute al abrirlo. */
  function csvCell(v) { var s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
  /** Descarga lo que se está viendo como CSV (con BOM para que Excel respete las tildes). */
  function downloadCsv() {
    var head = ['Cuándo (UTC)', 'Quién', 'Rol', 'Qué', 'Detalle', 'IP', 'Navegador'];
    var lines = [head.map(csvCell).join(';')].concat(act.items.map(function (e) { return [e.t, e.u, e.r, e.label, e.d, e.ip, e.ua].map(csvCell).join(';'); }));
    var a = document.createElement('a'); a.hidden = true; a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = 'actividad-torivac.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  // ───────────────────────────────────────── [AJUSTES]
  /** Texto de lo que le pasa a esta persona al entrar, según el estado que da el servidor (user.code en /api/auth/me). */
  function codeExplain(code) {
    if (code === 'required') return 'Al entrar con tu contraseña te mandamos un código por correo. Marcando «recordar este dispositivo» no te lo pide en ese navegador durante 30 días.';
    if (code === 'exempt') return 'Tu cuenta es de confianza: entras solo con la contraseña (otro manager puede cambiarlo en Usuarios).';
    if (code === 'off') return 'La verificación por correo está desactivada en el servidor: se entra solo con la contraseña.';
    return 'Los clientes entran con su contraseña; solo si hay intentos repetidos contra una cuenta se pide un código por correo en dispositivos nuevos.';
  }
  /** Panel «Tu cuenta y tu seguridad» de Ajustes: estado del código, olvidar dispositivos y cambiar la contraseña propia. */
  function accountPanel(me) {
    return '<section class="panel" data-sec-account><h2>Tu cuenta y tu seguridad</h2><p class="small">' + esc(codeExplain((me || {}).code)) + '</p>' +
      '<p><button class="btn sm ghost" type="button" data-sec-forget>Olvidar mis dispositivos recordados</button> <span class="muted small">Te volverá a pedir el código en todos los navegadores.</span></p>' +
      '<form class="form" data-sec-own-pw><h3 class="sec-sub">Cambiar mi contraseña</h3><div class="grid2"><label>Contraseña actual<input name="current" type="password" required autocomplete="current-password"></label><label>Contraseña nueva (mín. 12)<input name="password" type="password" minlength="12" required autocomplete="new-password"></label></div>' +
      '<p class="muted small">Al cambiarla se cierran tus sesiones y tendrás que entrar de nuevo.</p><p><button class="btn" type="submit">Cambiar la contraseña</button></p></form></section>';
  }
  /** Los paneles de seguridad de Ajustes (solo manager): tu cuenta y las copias de seguridad. Nunca rechaza. Cada uno sale solo si el servidor lo trae (el de la cuenta, si /api/auth/me da `code`; el de las copias, si /api/backups responde). */
  S.settingsPanels = function (ctx, me) {
    return backupsPanel(ctx).then(function (bk) { return ((me || {}).code ? accountPanel(me) : '') + bk; });
  };

  // ───────────────────────────────────────── [COPIAS]
  /** Panel «Copias de seguridad»: la lista, crear una ahora, descargar y borrar. '' si el servidor no las trae. */
  function backupsPanel(ctx) {
    return ctx.http('GET', '/api/backups').then(function (r) {
      if (!r.ok) return '';
      var rows = (r.backups || []).map(function (b) {
        return '<tr><td>' + esc(when(b.at)) + '</td><td class="small">' + esc(b.auto ? 'automática' : (b.by || 'a mano')) + '</td><td class="num">' + Number(b.keys) + '</td><td class="num">' + Number(b.media) + '</td><td class="num">' + esc(size(b.size)) + '</td><td class="bl-actions"><button class="btn sm ghost" data-sec-dl="' + esc(b.file) + '">Descargar<span class="vh"> la copia del ' + esc(when(b.at)) + '</span></button> <button class="btn sm ghost" data-sec-del-bk="' + esc(b.file) + '">Borrar<span class="vh"> la copia del ' + esc(when(b.at)) + '</span></button></td></tr>';
      }).join('');
      return '<section class="panel" data-sec-root data-sec-mode="backups"><h2>Copias de seguridad</h2><p class="small">Pedidos, mensajes, usuarios, precios, propuestas, entradas del blog e imágenes. ' + (r.auto ? 'Se hace <strong>una cada semana, sola</strong>' + (r.next ? ' (la próxima, a partir del ' + esc(when(r.next).slice(0, 10)) + ')' : '') + ' y se guardan las ' + Number(r.keep) + ' últimas' : 'Las copias automáticas están <strong>desactivadas</strong> (config.php)') + '. Descarga alguna de vez en cuando y guárdala fuera del servidor (el hosting suele tener además su propia copia diaria).</p>' +
        (rows ? '<div class="tbl-wrap"><table class="spec"><thead><tr><th>Cuándo</th><th>Quién</th><th>Registros</th><th>Imágenes</th><th>Tamaño</th><th><span class="vh">Acciones</span></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="muted">Todavía no hay copias.</p>') +
        '<p><button class="btn" type="button" data-sec-bk-now>Crear copia ahora</button></p><p class="muted small">Contiene datos personales y los hash de las contraseñas: guárdala en un sitio privado. Para restaurar, ver docs/SEGURIDAD.md (<span class="mono">php api/tools/restore.php</span>).</p></section>';
    });
  }
  /** Pide el enlace firmado de una copia y la descarga. */
  function downloadBackup(ctx, file) {
    ctx.http('POST', '/api/backups/' + encodeURIComponent(file) + '/link', {}).then(function (r) {
      if (!r.ok) return fail(ctx, r);
      var a = document.createElement('a'); a.hidden = true; a.href = TV.api.base() + '/api/backups/' + encodeURIComponent(r.file) + '?t=' + encodeURIComponent(r.token); a.download = r.file; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
    });
  }

  // ───────────────────────────────────────── [EVENTOS]
  /**
   * Engancha los eventos de lo que pinten usersView, activityView y settingsPanels (delegación sobre `root`, una sola vez). `ctx.render()` repinta la vista; `ctx.relogin(msg)` cierra
   * la sesión y vuelve a la pantalla de acceso con un aviso (tras cambiar la contraseña propia).
   */
  S.bind = function (root, ctx) {
    if (root.__secBound) return;
    root.__secBound = true;
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-sec-unlock')) {
        var em = b.getAttribute('data-sec-unlock'), clear = b.hasAttribute('data-sec-clear');
        ctx.http('POST', '/api/users/' + encodeURIComponent(em) + '/unlock', { clear_reinforced: clear }).then(function (r) { if (!r.ok) return fail(ctx, r); ctx.toast('Cuenta desbloqueada'); ctx.render(); });
      } else if (b.hasAttribute('data-sec-del-user')) {
        var who = b.getAttribute('data-sec-del-user');
        if (confirm('¿Borrar a ' + who + '? Se cierran sus sesiones y no se puede deshacer.')) ctx.http('DELETE', '/api/users/' + encodeURIComponent(who)).then(function (r) { if (!r.ok) return fail(ctx, r); ctx.toast('Usuario borrado'); ctx.render(); });
      } else if (b.hasAttribute('data-sec-csv')) downloadCsv();
      else if (b.hasAttribute('data-sec-forget')) {
        if (confirm('¿Olvidar tus dispositivos recordados? La próxima vez que entres desde cualquier navegador te pedirá el código.')) ctx.http('POST', '/api/auth/devices/forget', {}).then(function (r) { if (!r.ok) return fail(ctx, r); ctx.toast('Dispositivos olvidados'); });
      } else if (b.hasAttribute('data-sec-bk-now')) {
        b.disabled = true; b.textContent = 'Haciendo la copia…';
        ctx.http('POST', '/api/backups', {}).then(function (r) { if (!r.ok) { b.disabled = false; b.textContent = 'Crear copia ahora'; return fail(ctx, r); } ctx.toast('Copia creada · ' + Number(r.backup.keys) + ' registros, ' + Number(r.backup.media) + ' imágenes'); ctx.render(); });
      } else if (b.hasAttribute('data-sec-dl')) downloadBackup(ctx, b.getAttribute('data-sec-dl'));
      else if (b.hasAttribute('data-sec-del-bk')) {
        if (confirm('¿Borrar esta copia de seguridad? No se puede deshacer.')) ctx.http('DELETE', '/api/backups/' + encodeURIComponent(b.getAttribute('data-sec-del-bk'))).then(function (r) { if (!r.ok) return fail(ctx, r); ctx.toast('Copia borrada'); ctx.render(); });
      }
    });
    root.addEventListener('change', function (e) {
      var s = e.target; if (!s.hasAttribute || !s.hasAttribute('data-sec-two-step')) return;
      var em = s.getAttribute('data-sec-two-step'), on = s.value === '1';
      ctx.http('POST', '/api/users/' + encodeURIComponent(em) + '/two-step', { enabled: on }).then(function (r) { if (!r.ok) { fail(ctx, r); return ctx.render(); } ctx.toast(on ? 'Pedirá el código por correo' : 'Cuenta de confianza: no pide código'); });
    });
    root.addEventListener('submit', function (e) {
      var f = e.target;
      if (f.hasAttribute('data-sec-filters')) { e.preventDefault(); act.days = Number(f.days.value) || 7; act.cat = f.cat.value; act.u = f.u.value.trim(); act.q = f.q.value.trim(); ctx.render(); }
      else if (f.hasAttribute('data-sec-new-user')) {
        e.preventDefault();
        ctx.http('POST', '/api/users', { name: f.name.value, email: f.email.value, role: f.role.value, password: f.password.value }).then(function (r) { if (!r.ok) return fail(ctx, r); ctx.toast('Usuario creado'); ctx.render(); });
      } else if (f.hasAttribute('data-sec-reset-pw')) {
        e.preventDefault();
        if (!confirm('¿Poner una contraseña nueva a ' + f.email.value + '? Se cierran todas sus sesiones.')) return;
        ctx.http('POST', '/api/users/' + encodeURIComponent(f.email.value) + '/password', { password: f.password.value }).then(function (r) { if (!r.ok) return fail(ctx, r); f.reset(); ctx.toast('Contraseña nueva guardada'); });
      } else if (f.hasAttribute('data-sec-own-pw')) {
        e.preventDefault();
        ctx.http('POST', '/api/auth/password', { current: f.current.value, password: f.password.value }).then(function (r) { if (!r.ok) return fail(ctx, r); ctx.relogin('Contraseña cambiada: entra con la nueva.'); });
      }
    });
  };
})();
