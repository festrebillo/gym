/* Gym · pantallas y comportamiento. Funciona sin conexión; la hoja de cálculo se pone al día cuando hay red. */
(function () {
  "use strict";
  var C = window.GymCore, CFG = window.FG_CFG || {}, VERSION = "0.3.0";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LS = (function () { try { localStorage.setItem("_t", "1"); localStorage.removeItem("_t"); return localStorage; } catch (e) { var m = {}; return { getItem: function (k) { return m[k] || null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } }; } })();
  var db = C.cargar(LS), EX = [], BYEN = {}, INSTR = null;
  var S = { q: "", grupo: "Todos", equipo: "Todos", cat: "Fuerza", lim: 50, sel: {}, exp: {}, rng: "6m", met: "e1rm", rest: null, pl: null, sync: "", syncT: 0 };
  var DIAS = ["L", "M", "X", "J", "V", "S", "D"], DIAS_L = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

  /* ---------- utilidades ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function U() { return db.ajustes.unidad; }
  function fw(kg) { return C.fmt(kg, U()); }
  function fwu(kg) { return C.fmt(kg, U()) + " " + U(); }
  function salto() { return U() === "lb" ? C.toKg(db.ajustes.saltoLb, "lb") : db.ajustes.saltoKg; }
  function num(v) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : NaN; }
  function toast(t) { var e = $("#toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove("on"); }, 2800); }
  function cfg() { return window.FergardAcceso ? FergardAcceso.config() : { token: null, url: null }; }
  function save() { C.guardar(LS, db); }
  function touch(t, id, o) { if (o) o.upd = Date.now(); C.marcar(db, t, id); save(); schedSync(); }
  function ex(id) {
    if (typeof id === "number") return EX[id] || { i: id, n: "Ejercicio", e: "", g: "Otros", q: "", m: "", s: [], c: "Fuerza", t: 0, k: 0 };
    var c = db.custom[id]; return c ? { i: id, n: c.n, e: c.n, g: c.g, q: c.q, m: c.g, s: [], c: "Fuerza", t: 2, k: 0, custom: true } : { i: id, n: "Ejercicio eliminado", e: "", g: "Otros", q: "", s: [], k: 0 };
  }
  function thumb(id, cls) {
    var x = ex(id);
    if (x.custom) return '<div class="' + (cls || "th-i") + '" style="display:grid;place-items:center;color:#66666C"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/></svg></div>';
    return '<img class="' + (cls || "th-i") + '" loading="lazy" alt="" src="t/' + id + '.jpg" onerror="this.style.visibility=\'hidden\'">';
  }
  function photo(id, k) { return '<img alt="" loading="lazy" src="img/' + id + (k ? "b" : "a") + '.jpg" onerror="this.style.display=\'none\'">'; }
  function fechaLarga(d) { var s = d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }); return s.charAt(0).toUpperCase() + s.slice(1); }
  function dow(d) { var x = d.getDay(); return x === 0 ? 7 : x; }
  function fcorta(f) { var p = f.split("-"); return p[2] + "/" + p[1]; }
  function hhmm(ms) { var s = Math.max(0, Math.round(ms / 1000)), m = Math.floor(s / 60); return m + ":" + ("0" + (s % 60)).slice(-2); }
  function rutinasArr() { return Object.keys(db.rutinas).map(function (k) { return db.rutinas[k]; }).sort(function (a, b) { return (a.orden || 0) - (b.orden || 0) || (a.upd || 0) - (b.upd || 0); }); }
  function sesionesHechas() { return Object.keys(db.sesiones).map(function (k) { return db.sesiones[k]; }).filter(function (s) { return s.fin; }).sort(function (a, b) { return a.fin - b.fin; }); }
  function inicioSemana(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (dow(x) - 1)); return x; }
  function fstr(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function ico(n) {
    var P = { chev: '<path d="M9 6l6 6-6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7"/>', back: '<path d="M15 6l-6 6 6 6"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
      up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01"/>', note: '<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8 9h8M8 13h5"/>' };
    return '<svg viewBox="0 0 24 24">' + (P[n] || "") + "</svg>";
  }

  /* ---------- sincronización ---------- */
  function post(url, body) { return fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }); }
  var syncTimer = null, syncing = false;
  function schedSync() { clearTimeout(syncTimer); syncTimer = setTimeout(function () { sync(false); }, 1200); }
  function sync(manual) {
    var c = cfg();
    if (!c.token || !c.url) { if (manual) toast("Este dispositivo no está vinculado a Fergard"); return Promise.resolve(); }
    if (syncing) return Promise.resolve(); syncing = true; S.sync = "Sincronizando…";
    return C.sincronizar(db, c, post).then(function (r) {
      save();
      if (r.ok) { S.sync = "Al día · " + new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }); if (manual) toast("Sincronizado (" + r.enviados + " enviados, " + r.recibidos + " recibidos)"); if (r.recibidos && !db.activa) render(); }
      else { S.sync = r.error === "no_autorizado" ? "Dispositivo no autorizado" : r.error === "operacion_desconocida" ? "El script no tiene la versión con Gym (actualízalo)" : "Pendiente (" + r.error + ")"; if (manual) toast(S.sync); }
    }).catch(function () { S.sync = "Sin conexión · se enviará después"; if (manual) toast("Sin conexión"); }).then(function () { syncing = false; });
  }
  window.addEventListener("online", function () { sync(false); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) sync(false); });   // al volver a la app se pone al día con la nube

  /* ---------- descanso entre series ---------- */
  var restInt = null;
  var AC = null;
  function audioUnlock() { try { if (!AC) { var A0 = window.AudioContext || window.webkitAudioContext; AC = new A0(); } if (AC.state === "suspended") AC.resume(); } catch (e) {} }
  function restStart(sec) { audioUnlock(); S.rest = { fin: Date.now() + sec * 1000, total: sec }; restShow(); if (!restInt) restInt = setInterval(restTick, 250); }
  function restShow() {
    var r = $("#resting"); if (!S.rest) { r.hidden = true; return; }
    r.hidden = false; r.innerHTML = '<span class="t" id="rt"></span><div class="bar"><i id="rb"></i></div><button data-a="rmenos">−15</button><button data-a="rmas">+15</button><button data-a="rfin">Saltar</button>'; restTick();
  }
  function restTick() {
    if (!S.rest) { clearInterval(restInt); restInt = null; return; }
    var left = S.rest.fin - Date.now();
    if (left <= 0) { S.rest = null; $("#resting").hidden = true; clearInterval(restInt); restInt = null; beep(); toast("Descanso terminado"); return; }
    var t = $("#rt"); if (t) t.textContent = hhmm(left); var b = $("#rb"); if (b) b.style.width = Math.round(left / (S.rest.total * 10)) + "%";
  }
  function beep() {
    if (db.ajustes.sonido) try { audioUnlock(); var a = AC, o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.value = .25; o.connect(g); g.connect(a.destination); o.start(); setTimeout(function () { o.frequency.value = 1175; }, 180); setTimeout(function () { o.stop(); }, 420); } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
  }

  /* ---------- gráficos ---------- */
  function chart(pts, fmtv) {
    var W = 354, H = 190, L = 8, R = 8, T = 16, B = 26;
    if (!pts.length) return '<div class="empty" style="padding:30px 0">Todavía no hay datos para graficar.</div>';
    var xs = pts.map(function (p) { return p.t; }), ys = pts.map(function (p) { return p.v; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1; } var pad = (y1 - y0) * .12; y0 -= pad; y1 += pad;
    function X(t) { return x1 === x0 ? W / 2 : L + (t - x0) / (x1 - x0) * (W - L - R); }
    function Y(v) { return T + (1 - (v - y0) / (y1 - y0)) * (H - T - B); }
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + X(p.t).toFixed(1) + " " + Y(p.v).toFixed(1); }).join(" ");
    var area = d + " L" + X(pts[pts.length - 1].t).toFixed(1) + " " + (H - B) + " L" + X(pts[0].t).toFixed(1) + " " + (H - B) + "Z";
    var grid = [0, 1, 2].map(function (i) { var y = T + i * (H - T - B) / 2; return '<path d="M' + L + " " + y + "H" + (W - R) + '" stroke="rgba(255,255,255,.08)"/>'; }).join("");
    var dots = pts.map(function (p, i) { return '<circle cx="' + X(p.t).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="' + (i === pts.length - 1 ? 5.5 : 3) + '" fill="' + (i === pts.length - 1 ? "#0C0C0D" : "#FF5A47") + '" stroke="#FF5A47" stroke-width="' + (i === pts.length - 1 ? 3 : 0) + '"/>'; }).join("");
    var f = function (t) { var dd = new Date(t); return dd.getDate() + "/" + (dd.getMonth() + 1); };
    var yl = '<text x="' + (W - R) + '" y="' + (T - 4) + '" text-anchor="end" font-size="11" fill="#9A9AA2">máx ' + fmtv(Math.max.apply(null, ys)) + '</text>';
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '"><defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5A47" stop-opacity=".38"/><stop offset="1" stop-color="#FF5A47" stop-opacity="0"/></linearGradient></defs>' + grid +
      '<path d="' + area + '" fill="url(#ar)"/><path d="' + d + '" fill="none" stroke="#FF5A47" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' + dots + yl +
      '<text x="' + L + '" y="' + (H - 6) + '" font-size="11" fill="#9A9AA2">' + f(x0) + '</text><text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end" font-size="11" fill="#9A9AA2">' + f(x1) + "</text></svg>";
  }
  function serie(hist, met, rng) {
    var lim = { "4s": 28, "3m": 92, "6m": 183, "1a": 366, "todo": 99999 }[rng] || 183, desde = Date.now() - lim * 86400000;
    return hist.filter(function (h) { return new Date(h.fecha + "T12:00:00").getTime() >= desde; }).map(function (h) {
      var v = met === "peso" ? h.max : met === "vol" ? h.vol : met === "reps" ? h.reps : h.e1rm;
      return { t: new Date(h.fecha + "T12:00:00").getTime(), v: (met === "reps") ? v : C.toDisp(v, U()) };
    }).filter(function (p) { return p.v > 0; });
  }
  function chartBlock(id, hist) {
    var peso = hist.some(function (h) { return h.max > 0; }), met = peso ? S.met : "reps";
    if (!peso && S.met !== "reps") met = "reps";
    var mets = peso ? [["e1rm", "1RM estimado"], ["peso", "Peso"], ["vol", "Volumen"]] : [["reps", "Repeticiones"]];
    if (peso && mets.every(function (m) { return m[0] !== S.met; })) met = "e1rm";
    var unit = (met === "reps") ? "" : " " + U();
    var h = '<div class="seg">' + mets.map(function (m) { return '<button class="' + (met === m[0] ? "on" : "") + '" data-a="met" data-v="' + m[0] + '">' + m[1] + "</button>"; }).join("") + "</div>";
    h += '<div class="rng">' + [["4s", "4 sem"], ["3m", "3 m"], ["6m", "6 m"], ["1a", "1 año"], ["todo", "Todo"]].map(function (r) { return '<button class="' + (S.rng === r[0] ? "on" : "") + '" data-a="rng" data-v="' + r[0] + '">' + r[1] + "</button>"; }).join("") + "</div>";
    h += chart(serie(hist, met, S.rng), function (v) { return (Math.round(v * 10) / 10) + unit; });
    return h;
  }

  /* ---------- vistas ---------- */
  var views = {};
  function hasToken() { return !!cfg().token; }
  function bannerVinculo() { return ""; }

  function nube() {
    var n = Object.keys(db.pend).length;
    if (n) return '<span class="up" style="margin:0;color:#FFD34D;background:rgba(255,211,77,.14)">⏳ ' + n + (n === 1 ? " pendiente de subir" : " pendientes de subir") + "</span>";
    return db.sync.ok ? '<span class="up" style="margin:0">☁ En la nube</span>' : "";
  }
  views.hoy = function () {
    var d = new Date(), h = '<div class="hd"><div><div class="k">' + esc(fechaLarga(d)) + "</div><h1>Hoy</h1></div>" + nube() + "</div>" + bannerVinculo();
    if (S.cargando) return h + '<div class="card empty"><b>Cargando tus datos…</b>Se están bajando de tu hoja de cálculo.</div>';
    var rs = rutinasArr();
    if (db.activa && db.sesiones[db.activa]) {
      var s = db.sesiones[db.activa];
      h += '<div class="card"><div class="k">Entrenamiento en curso</div><h2 style="margin:4px 0 2px">' + esc(s.nombre) + '</h2><div class="k" id="el0">Empezó hace ' + hhmm(Date.now() - s.inicio) + '</div><a class="cta" href="#/sesion">Continuar</a></div>';
    } else if (!rs.length) {
      h += '<div class="card empty"><b>Arma tu primera rutina</b>Elige una plantilla lista o crea la tuya con ejercicios con foto.<a class="cta" href="#/rutinas">Ver plantillas y rutinas</a></div>';
    } else {
      var hoyR = rs.filter(function (r) { return (r.dias || []).indexOf(dow(d)) >= 0; });
      if (hoyR.length) h += hoyR.map(todayCard).join("");
      else h += '<div class="card empty"><b>Hoy no tienes rutina asignada</b>Puedes entrenar igual: elige una.</div>';
      var otras = rs.filter(function (r) { return hoyR.indexOf(r) < 0; });
      if (otras.length) {
        h += '<div class="sec"><span>Otras rutinas</span></div><div class="card" style="padding:4px 16px">' + otras.map(function (r) { return '<div class="it"><div class="grow"><div class="n">' + esc(r.nombre) + '</div><div class="s">' + r.items.length + ' ejercicios</div></div><button class="btn sec" data-a="iniciar" data-id="' + r.id + '">Iniciar</button></div>'; }).join("") + "</div>";
      }
    }
    var ses = sesionesHechas(), ini = inicioSemana(d), semana = {};
    ses.forEach(function (s) { semana[s.fecha] = 1; });
    var strip = "", nsem = 0;
    for (var i = 0; i < 7; i++) { var dd = new Date(ini); dd.setDate(ini.getDate() + i); var k = fstr(dd), hecho = !!semana[k]; if (hecho) nsem++; strip += '<div>' + DIAS[i] + '<span class="' + (hecho ? "d" : "") + (k === C.hoy() ? " h" : "") + '">' + dd.getDate() + "</span></div>"; }
    var vol = 0; ses.forEach(function (s) { if (s.fecha >= fstr(ini)) (s.ej || []).forEach(function (e) { vol += C.resumenEj(e).vol; }); });
    h += '<div class="sec"><span>Esta semana</span></div><div class="card"><div class="wk">' + strip + "</div></div>";
    h += '<div class="stats" style="margin-top:12px"><div class="card"><small>Entrenos</small><b>' + nsem + '</b></div><div class="card"><small>Volumen</small><b>' + Math.round(C.toDisp(vol, U())).toLocaleString("es") + '<small> ' + U() + '</small></b></div><div class="card"><small>Total</small><b>' + ses.length + "</b></div></div>";
    if (ses.length) {
      var u = ses[ses.length - 1], nser = 0; (u.ej || []).forEach(function (e) { nser += C.setsHechas(e).length; });
      h += '<div class="sec"><span>Última sesión</span></div><div class="card"><div class="n" style="font-weight:600">' + esc(u.nombre) + '</div><div class="s k" style="margin-top:3px">' + fcorta(u.fecha) + " · " + (u.ej || []).length + " ejercicios · " + nser + " series · " + hhmm((u.fin - u.inicio)) + "</div></div>";
    }
    h += '<div class="acts" style="margin-top:16px"><button class="btn sec" data-a="discos">' + ico("calc") + ' Calculadora de discos</button></div>';
    return h;
  };
  function todayCard(r) {
    var th = r.items.slice(0, 3).map(function (it) { return '<img alt="" src="img/' + it.ej + 'a.jpg" onerror="this.style.display=\'none\'">'; }).join("");
    var ser = 0; r.items.forEach(function (i) { ser += i.series; });
    return '<div class="card today"><div class="mos">' + (typeof r.items[0] !== "undefined" && typeof r.items[0].ej === "number" ? th : "") + '</div><div class="in"><div class="k">Rutina de hoy</div><h2 style="margin:2px 0">' + esc(r.nombre) + '</h2><div class="k">' + r.items.length + " ejercicios · " + ser + " series</div>" +
      '<button class="cta" data-a="iniciar" data-id="' + r.id + '"><svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>Iniciar entrenamiento</button></div></div>';
  }

  views.rutinas = function () {
    var rs = rutinasArr(), h = '<div class="hd"><div><div class="k">Mis rutinas</div><h1>Rutinas</h1></div><button class="btn" data-a="nueva">' + ico("plus") + " Nueva</button></div>";
    if (!rs.length) h += '<div class="card empty"><b>Aún no tienes rutinas</b>Crea una desde cero o empieza con una plantilla.</div>';
    rs.forEach(function (r) {
      var dias = (r.dias || []).map(function (x) { return DIAS_L[x - 1]; }).join(" · ");
      h += '<div class="card"><a href="#/rutina/' + r.id + '" style="display:block"><h2>' + esc(r.nombre) + '</h2><div class="k" style="margin-top:3px">' + (dias || "Sin día asignado") + " · " + r.items.length + " ejercicios</div></a>" +
        '<div class="mos2" style="display:flex;gap:6px;margin:12px 0 4px">' + r.items.slice(0, 5).map(function (i) { return thumb(i.ej, "th-i").replace('class="th-i"', 'class="th-i" style="width:48px;height:48px"'); }).join("") + "</div>" +
        '<div class="acts"><button class="btn" data-a="iniciar" data-id="' + r.id + '">Iniciar</button><a class="btn sec" href="#/rutina/' + r.id + '">Editar</a></div></div>';
    });
    h += '<div class="sec"><span>Plantillas listas</span></div>';
    C.PLANTILLAS.forEach(function (p) { h += '<div class="card"><div class="n" style="font-weight:700;font-size:17px">' + esc(p.nombre) + '</div><div class="k" style="margin:3px 0 10px">' + esc(p.desc) + "</div>" + p.rutinas.map(function (r) { return '<div class="s k">• ' + esc(r.nombre) + " (" + r.items.length + " ejercicios)</div>"; }).join("") + '<button class="btn sec full" data-a="plantilla" data-id="' + p.id + '">Usar esta plantilla</button></div>'; });
    return h;
  };

  views.rutina = function (r) {
    var rt = db.rutinas[r.arg]; if (!rt) return '<div class="empty"><b>Rutina no encontrada</b><a class="link" href="#/rutinas">Volver</a></div>';
    var h = '<div class="hd"><div><a class="link" href="#/rutinas">‹ Rutinas</a><h1 style="margin-top:6px">Editar rutina</h1></div></div>';
    h += '<label class="lbl">Nombre</label><input data-f="rnom" value="' + esc(rt.nombre) + '" maxlength="40">';
    h += '<label class="lbl">Días de la semana (opcional)</label><div class="days">' + DIAS.map(function (n, i) { return '<button class="' + ((rt.dias || []).indexOf(i + 1) >= 0 ? "on" : "") + '" data-a="dia" data-v="' + (i + 1) + '">' + n + "</button>"; }).join("") + "</div>";
    var ser = 0; rt.items.forEach(function (i) { ser += i.series; });
    h += '<div class="sec"><span>' + rt.items.length + ' ejercicios · ' + ser + ' series</span><span class="k">arrastra ⋮⋮ para ordenar</span></div><div class="card" id="rlist" style="padding:4px 14px">';
    if (!rt.items.length) h += '<div class="empty">Aún no hay ejercicios. Añade el primero.</div>';
    rt.items.forEach(function (it, i) {
      var X = ex(it.ej), hist = C.historial(db, it.ej), sb = C.subida(hist), open = S.exp[rt.id + i];
      h += '<div class="ritem" data-i="' + i + '"><div class="row1"><span class="hdl" data-a="drag">⋮⋮</span><a href="#/ej/' + it.ej + '">' + thumb(it.ej) + '</a><div class="grow" data-a="abrir" data-i="' + i + '" style="flex:1;min-width:0;cursor:pointer"><div class="n" style="font-size:15.5px;font-weight:600">' + esc(X.n) + '</div><div class="s k" style="margin-top:2px">' + it.series + " × " + it.reps + (it.peso ? " · " + fwu(it.peso) : "") + (sb ? '<span class="up">↑ +' + fw(sb) + "</span>" : "") + "</div></div>" +
        '<div style="display:flex;flex-direction:column;gap:4px"><button class="ibtn" style="width:30px;height:24px;border-radius:8px" data-a="mover" data-i="' + i + '" data-d="-1">' + ico("up") + '</button><button class="ibtn" style="width:30px;height:24px;border-radius:8px" data-a="mover" data-i="' + i + '" data-d="1">' + ico("down") + "</button></div></div>";
      if (open) h += '<div class="edit"><div><label>Series</label><div class="step"><button data-a="st" data-i="' + i + '" data-k="series" data-d="-1">−</button><input data-f="ri" data-i="' + i + '" data-k="series" inputmode="numeric" value="' + it.series + '"><button data-a="st" data-i="' + i + '" data-k="series" data-d="1">+</button></div></div>' +
        '<div><label>Repeticiones</label><div class="step"><button data-a="st" data-i="' + i + '" data-k="reps" data-d="-1">−</button><input data-f="ri" data-i="' + i + '" data-k="reps" inputmode="numeric" value="' + it.reps + '"><button data-a="st" data-i="' + i + '" data-k="reps" data-d="1">+</button></div></div>' +
        '<div><label>Peso inicial (' + U() + ')</label><div class="step"><button data-a="st" data-i="' + i + '" data-k="peso" data-d="-1">−</button><input data-f="ri" data-i="' + i + '" data-k="peso" inputmode="decimal" value="' + (it.peso ? fw(it.peso) : "") + '" placeholder="0"><button data-a="st" data-i="' + i + '" data-k="peso" data-d="1">+</button></div></div>' +
        '<div><label>Descanso (seg)</label><div class="step"><button data-a="st" data-i="' + i + '" data-k="desc" data-d="-1">−</button><input data-f="ri" data-i="' + i + '" data-k="desc" inputmode="numeric" value="' + (it.desc || db.ajustes.descanso) + '"><button data-a="st" data-i="' + i + '" data-k="desc" data-d="1">+</button></div></div>' +
        '<div class="full"><button class="btn bad" style="height:38px" data-a="quitar" data-i="' + i + '">' + ico("trash") + " Quitar de la rutina</button></div></div>";
      h += "</div>";
    });
    h += "</div>";
    h += '<a class="btn sec full" href="#/biblioteca?add=' + rt.id + '" style="height:50px">' + ico("plus") + " Añadir ejercicio</a>";
    h += '<button class="cta" data-a="iniciar" data-id="' + rt.id + '"><svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>Iniciar entrenamiento</button>';
    h += '<div class="acts" style="margin-top:14px"><button class="btn sec" data-a="duplicar" data-id="' + rt.id + '">Duplicar</button><button class="btn bad" data-a="borrarR" data-id="' + rt.id + '">Eliminar rutina</button></div>';
    return h;
  };

  /* biblioteca */
  var FUERZA = { "Fuerza": 1, "Powerlifting": 1, "Halterofilia": 0 };
  function lista() {
    var q = C.norm(S.q).split(/\s+/).filter(Boolean), out = [];
    function ok(x) {
      if (S.cat === "Fuerza" && !FUERZA[x.c]) return false;
      if (S.grupo !== "Todos" && x.g !== S.grupo) return false;
      if (S.equipo !== "Todos" && x.q !== S.equipo) return false;
      if (q.length) { var s = x._s || (x._s = C.norm(x.n + " " + x.e + " " + x.q + " " + x.g + " " + x.m)); for (var i = 0; i < q.length; i++) if (s.indexOf(q[i]) < 0) return false; }
      return true;
    }
    EX.forEach(function (x) { if (ok(x)) out.push(x); });
    Object.keys(db.custom).forEach(function (k) { var x = ex(k); if (ok(x)) out.unshift(x); });
    out.sort(function (a, b) { return (b.custom ? 1 : 0) - (a.custom ? 1 : 0) || (b.t === 2 ? 1 : 0) - (a.t === 2 ? 1 : 0) || a.n.localeCompare(b.n, "es"); });
    return out;
  }
  views.biblioteca = function (r) {
    var add = r.q.add, ses = r.q.ses, h = '<div class="hd"><div><div class="k">' + (add && db.rutinas[add] ? "Añadir a «" + esc(db.rutinas[add].nombre) + "»" : ses ? "Añadir a la sesión" : "Biblioteca") + "</div><h1>Ejercicios</h1></div></div>";
    h += '<div class="sr">' + ico("search") + '<input id="q" placeholder="Buscar en español o inglés" value="' + esc(S.q) + '" autocomplete="off" autocapitalize="off"></div>';
    var G = ["Todos", "Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Piernas", "Core", "Antebrazo", "Otros"];
    h += '<div class="chips">' + G.map(function (g) { return '<button class="chip ' + (S.grupo === g ? "on" : "") + '" data-a="grupo" data-v="' + g + '">' + g + "</button>"; }).join("") + "</div>";
    var Q = ["Todos", "Barra", "Mancuernas", "Polea", "Máquina", "Peso corporal", "Barra Z", "Pesa rusa", "Banda"];
    h += '<div class="chips" style="margin-top:0">' + Q.map(function (g) { return '<button class="chip ' + (S.equipo === g ? "on" : "") + '" data-a="equipo" data-v="' + g + '">' + g + "</button>"; }).join("") + '<button class="chip ' + (S.cat === "Todo" ? "on" : "") + '" data-a="cat">' + (S.cat === "Todo" ? "Incluye estiramientos y más" : "Solo fuerza") + "</button></div>";
    var L = lista(), show = L.slice(0, S.lim);
    h += '<div class="k" style="margin:6px 2px">' + L.length + " ejercicios" + (S.q || S.grupo !== "Todos" ? "" : " · los más usados primero") + "</div>";
    h += '<div class="card" style="padding:4px 14px">' + (show.length ? show.map(function (x) {
      var sel = S.sel[x.i], right = (add || ses) ? '<span class="plus ' + (sel ? "ok" : "") + '">' + ico(sel ? "check" : "plus") + "</span>" : '<span style="color:#66666C">' + ico("chev").replace("<svg", '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"') + "</span>";
      var inner = '<div class="it" ' + ((add || ses) ? 'data-a="sel" data-id="' + x.i + '"' : "") + ">" + thumb(x.i) + '<div class="grow"><div class="n">' + esc(x.n) + '</div><div class="s">' + esc(x.g) + " · " + esc(x.q) + (x.t === 0 || (x.t === 1 && x.n !== x.e) ? "" : "") + "</div></div>" + right + "</div>";
      return (add || ses) ? inner : '<a href="#/ej/' + x.i + '" style="display:block">' + inner + "</a>";
    }).join("") : '<div class="empty"><b>Sin resultados</b>Prueba con otra palabra o crea tu propio ejercicio.</div>') + "</div>";
    if (L.length > show.length) h += '<button class="btn sec full" data-a="mas">Mostrar más (' + (L.length - show.length) + ")</button>";
    h += '<button class="btn sec full" data-a="custom">' + ico("plus") + " Crear ejercicio propio</button>";
    var nsel = Object.keys(S.sel).length;
    if ((add || ses) && nsel) h += '<div class="addbar"><button class="cta" data-a="agregar" data-add="' + (add || "") + '" data-ses="' + (ses ? 1 : "") + '">Añadir ' + nsel + (nsel === 1 ? " ejercicio" : " ejercicios") + "</button></div>";
    return h;
  };

  views.ej = function (r) {
    var id = /^\d+$/.test(r.arg) ? parseInt(r.arg, 10) : r.arg, X = ex(id), hist = C.historial(db, id), rec = C.records(hist);
    var h = '<div class="hd"><div><a class="link" href="javascript:history.back()">‹ Atrás</a><h1 style="margin-top:6px;font-size:27px">' + esc(X.n) + "</h1>" + (X.e && X.e !== X.n ? '<div class="k">' + esc(X.e) + "</div>" : "") + "</div></div>";
    if (!X.custom) h += '<div class="photos">' + photo(id, 0) + (X.k > 1 ? photo(id, 1) : "") + "</div>";
    h += '<div class="tags"><span>' + esc(X.g) + "</span><span>" + esc(X.q) + "</span>" + (X.m && X.m !== X.g ? "<span>" + esc(X.m) + "</span>" : "") + (X.s || []).slice(0, 3).map(function (s) { return "<span>+ " + esc(s) + "</span>"; }).join("") + "</div>";
    h += '<div class="acts"><button class="btn" data-a="aRutina" data-id="' + id + '">' + ico("plus") + ' A una rutina</button><button class="btn sec" data-a="discos">' + ico("calc") + " Discos</button></div>";
    h += '<div class="sec"><span>Mi nota</span></div><textarea data-f="nota" data-id="' + id + '" rows="2" placeholder="Ej.: altura del banco 4, agarre estrecho, pies atrás">' + esc((db.notas[id] || {}).texto || "") + "</textarea>";
    h += '<div class="sec"><span>Mi progreso</span></div>';
    if (hist.length) {
      h += '<div class="stats"><div class="card"><small>Mejor peso</small><b>' + fw(rec.max) + "<small> " + U() + '</small></b></div><div class="card"><small>1RM est.</small><b>' + fw(rec.e1rm) + "<small> " + U() + '</small></b></div><div class="card"><small>Sesiones</small><b>' + hist.length + "</b></div></div>";
      h += '<div class="card" style="margin-top:12px">' + chartBlock(id, hist) + "</div>";
      h += '<div class="sec"><span>Últimas sesiones</span></div><div class="card" style="padding:4px 16px">' + hist.slice(-6).reverse().map(function (x) { return '<div class="it"><div class="grow"><div class="n">' + fcorta(x.fecha) + '</div><div class="s">' + x.series.map(function (s) { return fw(s.kg) + "×" + s.reps; }).join("  ") + "</div></div></div>"; }).join("") + "</div>";
    } else h += '<div class="card empty" style="padding:18px">Aún no hay registros. Aparecerán aquí cuando lo entrenes.</div>';
    if (!X.custom) h += '<div class="sec"><span>Cómo se hace</span></div><div class="card" id="ins"><div class="k">Cargando instrucciones…</div></div>';
    if (X.custom) h += '<div class="acts" style="margin-top:14px"><button class="btn bad" data-a="borrarCustom" data-id="' + id + '">Eliminar ejercicio propio</button></div>';
    return h;
  };
  var INSTR_ES = null;
  function cargarInstr(id) {
    var pintar = function () {
      var el = $("#ins"); if (!el) return;
      var e = INSTR_ES && INSTR_ES[id], en = INSTR && INSTR[id], usarEn = S.ing || !e, pasos = usarEn ? en : e.t;
      if (!pasos || !pasos.length) { el.innerHTML = '<div class="k">Sin instrucciones disponibles (se cargan con internet la primera vez).</div>'; return; }
      el.innerHTML = '<ol class="ins">' + pasos.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ol><div class="k" style="margin-top:6px;line-height:1.5">' + (usarEn ? "Instrucciones en inglés." : e.r ? "Traducidas y revisadas." : "Traducción automática: puede tener errores.") + ' <a class="link" data-a="ing" style="cursor:pointer">' + (usarEn ? "Ver en español" : "Ver original en inglés") + "</a></div>";
    }, need = [];
    if (!INSTR_ES) need.push(fetch("data/instr_es.json").then(function (r) { return r.json(); }).then(function (d) { INSTR_ES = d; }).catch(function () { INSTR_ES = {}; }));
    if ((S.ing || !INSTR_ES || true) && !INSTR && S.ing) need.push(fetch("data/instr.json").then(function (r) { return r.json(); }).then(function (d) { INSTR = d; }).catch(function () {}));
    Promise.all(need).then(function () { if (!INSTR_ES[id] && !INSTR) return fetch("data/instr.json").then(function (r) { return r.json(); }).then(function (d) { INSTR = d; }).catch(function () {}); }).then(pintar);
  }

  /* progreso */
  views.progreso = function () {
    var ses = sesionesHechas(), h = '<div class="hd"><div><div class="k">Cómo vas</div><h1>Progreso</h1></div></div>';
    if (!ses.length) return h + '<div class="card empty"><b>Todavía no hay sesiones</b>Termina tu primer entrenamiento y aquí verás tu evolución: pesos, récords, volumen y constancia.</div>';
    var ini = inicioSemana(new Date()), w = [];
    for (var i = 7; i >= 0; i--) { var a = new Date(ini); a.setDate(a.getDate() - 7 * i); var b = new Date(a); b.setDate(a.getDate() + 7); w.push({ a: fstr(a), b: fstr(b), v: 0, n: 0, l: a.getDate() + "/" + (a.getMonth() + 1) }); }
    ses.forEach(function (s) { w.forEach(function (x) { if (s.fecha >= x.a && s.fecha < x.b) { x.n++; (s.ej || []).forEach(function (e) { x.v += C.resumenEj(e).vol; }); } }); });
    var mx = Math.max.apply(null, w.map(function (x) { return x.v; })) || 1;
    h += '<div class="card"><div class="k">Volumen por semana (' + U() + ")</div>" + '<div class="bars" style="margin-bottom:22px">' + w.map(function (x, i) { return '<div class="' + (i === 7 ? "cur" : "") + '" style="height:' + Math.max(3, Math.round(x.v / mx * 90)) + 'px"><small>' + x.l + "</small></div>"; }).join("") + "</div></div>";
    var ids = {}; ses.forEach(function (s) { (s.ej || []).forEach(function (e) { ids[e.ej] = 1; }); });
    var rows = Object.keys(ids).map(function (k) { var id = /^\d+$/.test(k) ? parseInt(k, 10) : k; var hist = C.historial(db, id); return { id: id, hist: hist }; }).filter(function (r) { return r.hist.length; })
      .sort(function (a, b) { return b.hist[b.hist.length - 1].fecha.localeCompare(a.hist[a.hist.length - 1].fecha); });
    h += '<div class="sec"><span>Mis ejercicios</span><span>' + rows.length + "</span></div><div class='card' style='padding:4px 16px'>";
    rows.forEach(function (r) {
      var last = r.hist[r.hist.length - 1], first = r.hist[0], delta = last.e1rm - first.e1rm, X = ex(r.id);
      h += '<a class="it" href="#/ej/' + r.id + '" style="display:flex">' + thumb(r.id) + '<div class="grow"><div class="n">' + esc(X.n) + '</div><div class="s">' + r.hist.length + (r.hist.length === 1 ? " sesión" : " sesiones") + " · último " + (last.max ? fwu(last.max) : last.reps + " reps") + "</div></div>" + (r.hist.length > 1 && last.max ? '<span class="' + (delta >= 0 ? "up" : "pr") + '" style="margin:0">' + (delta >= 0 ? "↑ +" : "↓ ") + fw(Math.abs(delta)) + "</span>" : "") + "</a>";
    });
    return h + "</div>";
  };

  /* sesión */
  views.sesion = function () {
    var s = db.activa && db.sesiones[db.activa];
    if (!s) return '<div class="card empty"><b>No hay un entrenamiento en curso</b><a class="cta" href="#/hoy">Ir a Hoy</a></div>';
    var h = '<div class="hd"><div><a class="link" href="#/hoy">‹ Hoy</a><h1 style="margin-top:6px;font-size:28px">' + esc(s.nombre) + '</h1><div class="k" id="el">' + hhmm(Date.now() - s.inicio) + '</div></div><button class="btn" data-a="terminar">Terminar</button></div>';
    s.ej.forEach(function (e, i) {
      var X = ex(e.ej), hist = C.historial(db, e.ej), last = hist[hist.length - 1], nota = (db.notas[e.ej] || {}).texto;
      h += '<div class="card"><div class="exh"><a href="#/ej/' + e.ej + '">' + (X.custom ? thumb(e.ej) : '<img alt="" src="img/' + e.ej + 'a.jpg" onerror="this.style.visibility=\'hidden\'">') + '</a><div><h2 style="font-size:18px;line-height:1.2">' + esc(e.n || X.n) + '</h2><div class="k" style="margin-top:3px">Objetivo ' + e.obj.series + " × " + e.obj.reps + (e.sug && e.sug.kg ? " · " + fwu(e.sug.kg) : "") + "</div></div></div>";
      if (e.sug && e.sug.texto) h += '<div class="sug">' + (e.sug.tipo === "subir" ? "<b>Sube de peso.</b> " : e.sug.tipo === "repetir" ? "<b>Repite el peso.</b> " : "") + esc(e.sug.texto) + (e.sug.tipo === "subir" ? " Sugerido: <b>" + fwu(e.sug.kg) + "</b>." : "") + "</div>";
      if (nota) h += '<div class="note"><b>Mi nota</b>' + esc(nota) + "</div>";
      h += '<div class="tbl"><div class="tr h"><span>SERIE</span><span>ANTERIOR</span><span style="text-align:center">' + U().toUpperCase() + '</span><span style="text-align:center">REPS</span><span></span></div>';
      e.series.forEach(function (st, j) {
        var prev = last && last.series[j] ? fw(last.series[j].kg) + "×" + last.series[j].reps : "—";
        h += '<div class="tr ' + (st.ok ? "ok" : "") + '" data-i="' + i + '" data-j="' + j + '"><span>' + (j + 1) + '</span><span class="a">' + prev + '</span><input data-f="kg" inputmode="decimal" value="' + (st.kg ? fw(st.kg) : "") + '" placeholder="0"><input data-f="reps" inputmode="numeric" value="' + (st.reps || "") + '" placeholder="0"><button class="ck" data-a="ck" aria-label="Serie hecha">' + ico("check") + "</button></div>";
      });
      h += '</div><div class="acts"><button class="btn sec" data-a="masSerie" data-i="' + i + '">' + ico("plus") + ' Serie</button><button class="btn sec" data-a="menosSerie" data-i="' + i + '">− Serie</button><button class="btn sec" data-a="discos" data-i="' + i + '">' + ico("calc") + ' Discos</button><button class="btn sec" data-a="notaEj" data-i="' + i + '">' + ico("note") + ' Nota</button><button class="btn bad" data-a="quitarEj" data-i="' + i + '">Quitar</button></div></div>';
    });
    h += '<a class="btn sec full" href="#/biblioteca?ses=1" style="height:50px">' + ico("plus") + " Añadir ejercicio</a>";
    h += '<button class="btn bad full" data-a="descartar" style="height:46px">Descartar entrenamiento</button>';
    return h;
  };

  /* ajustes */
  views.ajustes = function () {
    var a = db.ajustes, u = a.unidad, c = cfg(), h = '<div class="hd"><div><div class="k">Preferencias</div><h1>Ajustes</h1></div></div>';
    h += '<div class="card"><div class="row2"><div>Unidad de peso<small>Los datos se guardan en kg y se muestran en la unidad que elijas.</small></div></div><div class="seg" style="margin-bottom:6px"><button class="' + (u === "kg" ? "on" : "") + '" data-a="unidad" data-v="kg">Kilos (kg)</button><button class="' + (u === "lb" ? "on" : "") + '" data-a="unidad" data-v="lb">Libras (lb)</button></div></div>';
    var barras = u === "kg" ? [20, 15, 10] : [45, 35, 25], bv = u === "kg" ? a.barra : a.barraLb, discos = u === "kg" ? [25, 20, 15, 10, 5, 2.5, 1.25, 1] : [55, 45, 35, 25, 10, 5, 2.5, 1.25], dsel = u === "kg" ? a.discosKg : a.discosLb;
    h += '<div class="sec"><span>Barra y discos</span></div><div class="card"><div class="k">Peso de la barra (' + u + ')</div><div class="seg" style="margin:8px 0 14px">' + barras.map(function (b) { return '<button class="' + (bv === b ? "on" : "") + '" data-a="barra" data-v="' + b + '">' + b + "</button>"; }).join("") + '</div><div class="k">Discos disponibles</div><div class="chips" style="flex-wrap:wrap;overflow:visible;margin:8px 0 0;padding:0">' + discos.map(function (d) { return '<button class="chip ' + (dsel.indexOf(d) >= 0 ? "on" : "") + '" data-a="disco" data-v="' + d + '">' + d + "</button>"; }).join("") + "</div></div>";
    var saltos = u === "kg" ? [1, 1.25, 2, 2.5, 5] : [2.5, 5, 10], sv = u === "kg" ? a.saltoKg : a.saltoLb;
    h += '<div class="sec"><span>Entrenamiento</span></div><div class="card"><div class="k">Cuánto subir cuando cumples todas las series (' + u + ')</div><div class="seg" style="margin:8px 0 14px">' + saltos.map(function (b) { return '<button class="' + (sv === b ? "on" : "") + '" data-a="salto" data-v="' + b + '">' + b + "</button>"; }).join("") + '</div><div class="k">Descanso por defecto</div><div class="seg" style="margin:8px 0 6px">' + [60, 90, 120, 180].map(function (b) { return '<button class="' + (a.descanso === b ? "on" : "") + '" data-a="desc" data-v="' + b + '">' + (b / 60 >= 1 && b % 60 === 0 ? b / 60 + " min" : b + " s") + "</button>"; }).join("") + '</div><div class="row2" style="margin-top:6px"><div>Sonido al terminar el descanso<small>En iPhone una web no puede vibrar, pero sí sonar.</small></div><button class="sw ' + (a.sonido ? "on" : "") + '" data-a="sonido" aria-label="Sonido"></button></div></div>';
    h += '<div class="sec"><span>Sincronización</span></div><div class="card"><div class="row2"><div>Hoja de cálculo<small>' + esc(!c.token ? "Sin vincular: solo se guarda en este dispositivo" : S.sync || "Lista para sincronizar") + "</small></div><button class=\"btn sec\" data-a=\"sync\">Sincronizar</button></div><div class=\"k\" style=\"margin-top:8px\">Pendientes de enviar: " + Object.keys(db.pend).length + "</div>" + (db.sync.url ? '<a class="btn sec full" target="_blank" rel="noopener" href="' + esc(db.sync.url) + '">Abrir mi hoja de cálculo de Gym</a><div class="k" style="margin-top:8px;line-height:1.4">Se llama «Fergard · Gym» y vive en tu Google Drive. «Series» tiene una fila por serie que hiciste.</div>' : "") + "</div>";
    h += '<div class="sec"><span>Espacio en este dispositivo</span></div><div class="card"><div class="k" style="line-height:1.5">Tus datos viven en tu hoja de cálculo. Aquí solo se guarda una copia pequeña (texto) y lo que no se haya podido subir todavía. Las fotos <b>no</b> se guardan: se piden en línea.</div><div class="row2"><div>Usado ahora<small id="uso">calculando…</small></div></div><div class="acts" style="margin-top:0"><button class="btn sec" data-a="liberar">Liberar espacio</button></div><div class="k" style="margin-top:8px;line-height:1.4">«Liberar espacio» borra la copia de este dispositivo y la vuelve a bajar de tu hoja. Solo funciona si todo está subido.</div></div>';
    h += '<div class="sec"><span>Acceso</span></div><div id="acc"></div><div class="sec"><span>Mis datos</span></div><div class="card"><div class="acts" style="margin-top:0"><button class="btn sec" data-a="exportar">Exportar copia (JSON)</button><button class="btn bad" data-a="reset">Borrar datos de este dispositivo</button></div></div>';
    h += '<p class="k" style="text-align:center;margin-top:24px">Gym v' + VERSION + " · base de ejercicios free-exercise-db (dominio público)</p>";
    return h;
  };

  function usoEspacio() {
    var el = $("#uso"); if (!el) return;
    var ls = 0; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); ls += (k.length + (localStorage.getItem(k) || "").length) * 2; } } catch (e) {}
    var f = function (b) { return b < 1048576 ? Math.max(1, Math.round(b / 1024)) + " KB" : (b / 1048576).toFixed(1) + " MB"; };
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (e) { el.textContent = "≈ " + f(e.usage || ls) + " (datos: " + f(ls) + ")"; }).catch(function () { el.textContent = "datos: " + f(ls); });
    else el.textContent = "datos: " + f(ls);
  }

  /* ---------- enrutador ---------- */
  function parse() {
    var h = location.hash.replace(/^#\/?/, ""), q = {}, i = h.indexOf("?");
    if (i >= 0) { h.slice(i + 1).split("&").forEach(function (p) { var kv = p.split("="); q[kv[0]] = decodeURIComponent(kv[1] || ""); }); h = h.slice(0, i); }
    var p = h.split("/"); return { name: p[0] || "hoy", arg: decodeURIComponent(p.slice(1).join("/")), q: q };
  }
  var lastKey = "";
  function render(keepScroll) {
    var r = parse(), v = views[r.name] || views.hoy, y = keepScroll ? window.scrollY : 0;
    if (r.name === "sesion" && !db.activa) { location.hash = "#/hoy"; return; }
    var key = r.name + "/" + r.arg + "?" + JSON.stringify(r.q);
    if (key !== lastKey && !keepScroll) { S.sel = {}; S.lim = 50; if (r.name !== "biblioteca") S.q = ""; }
    lastKey = key;
    $("#view").innerHTML = v(r);
    $$("#tabs a").forEach(function (a) { var t = a.getAttribute("data-t"); a.classList.toggle("on", t === r.name || (t === "hoy" && r.name === "sesion") || (t === "rutinas" && r.name === "rutina") || (t === "biblioteca" && r.name === "ej") || (t === "progreso" && r.name === "ej" && false)); });
    window.scrollTo(0, y);
    if (r.name === "ajustes") { usoEspacio(); if (window.FergardAcceso && $("#acc")) FergardAcceso.panel($("#acc")); }
    if (r.name === "ej") cargarInstr(/^\d+$/.test(r.arg) ? parseInt(r.arg, 10) : r.arg);
    if (r.name === "sesion" || r.name === "hoy") { clearInterval(render.tm); render.tm = setInterval(function () { var s = db.activa && db.sesiones[db.activa], e = $("#el") || $("#el0"); if (s && e) e.textContent = (e.id === "el0" ? "Empezó hace " : "") + hhmm(Date.now() - s.inicio); }, 1000); }
    var rs = $("#resting"); if (rs && (!db.activa || !S.rest)) { if (!S.rest) rs.hidden = true; }
  }
  window.addEventListener("hashchange", function () { render(); });

  /* ---------- acciones ---------- */
  function sheet(html) { var s = $("#sheet"); s.hidden = false; s.innerHTML = '<div class="sheet"><div class="grab"></div>' + html + "</div>"; s.onclick = function (e) { if (e.target === s) cerrar(); }; }
  function cerrar() { var s = $("#sheet"); s.hidden = true; s.innerHTML = ""; }
  function nuevoEj(it) {
    var hist = C.historial(db, it.ej), sg = C.sugerir(it, hist, salto()), series = [], n = it.series || 3;
    for (var i = 0; i < n; i++) series.push({ kg: sg.kg || it.peso || 0, reps: it.reps || 10, ok: false });
    return { ej: it.ej, n: ex(it.ej).n, obj: { series: n, reps: it.reps || 10, desc: it.desc || db.ajustes.descanso }, sug: { tipo: sg.tipo, kg: sg.kg || 0, texto: sg.texto }, series: series };
  }
  function iniciar(rid) {
    if (db.activa && db.sesiones[db.activa]) { location.hash = "#/sesion"; return; }
    var r = db.rutinas[rid]; if (!r || !r.items.length) { toast("Añade ejercicios a la rutina primero"); return; }
    var s = { id: C.uid(), fecha: C.hoy(), rutina: rid, nombre: r.nombre, inicio: Date.now(), fin: 0, ej: r.items.map(nuevoEj) };
    db.sesiones[s.id] = s; db.activa = s.id; touch("sesion", s.id, s); location.hash = "#/sesion";
  }
  function leerFila(row) {
    var i = +row.dataset.i, j = +row.dataset.j, s = db.sesiones[db.activa], st = s.ej[i].series[j];
    var kg = num($('[data-f="kg"]', row).value), reps = num($('[data-f="reps"]', row).value);
    st.kg = isFinite(kg) && kg >= 0 ? C.toKg(kg, U()) : 0; st.reps = isFinite(reps) && reps >= 0 ? Math.round(reps) : 0;
    return { s: s, e: s.ej[i], st: st, i: i, j: j };
  }
  function resumenFin(s) {
    var prs = [], total = 0, series = 0;
    s.ej.forEach(function (e) {
      var r = C.resumenEj(e); if (!r.n) return; total += r.vol; series += r.n;
      var antes = C.historial(db, e.ej).filter(function (h) { return h.sesion !== s.id; }), rec = C.records(antes);
      if (antes.length) { if (r.max > rec.max && r.max > 0) prs.push({ n: ex(e.ej).n, t: "Nuevo récord de peso: " + fwu(r.max) }); else if (r.e1rm > rec.e1rm * 1.001 && r.e1rm > 0) prs.push({ n: ex(e.ej).n, t: "Nuevo 1RM estimado: " + fwu(r.e1rm) }); else if (r.max === 0 && r.reps > rec.reps) prs.push({ n: ex(e.ej).n, t: "Nuevo récord de repeticiones: " + r.reps }); }
    });
    return { prs: prs, vol: total, series: series };
  }
  function terminar() {
    var s = db.sesiones[db.activa], r = resumenFin(s);
    if (!r.series) { sheet('<h3>Sin series hechas</h3><div class="k">No marcaste ninguna serie. ¿Descartar este entrenamiento?</div><button class="btn bad full" data-a="descartarYa">Descartar</button><button class="btn sec full" data-a="cerrar">Seguir entrenando</button>'); return; }
    sheet("<h3>¿Terminar entrenamiento?</h3><div class='k'>" + r.series + " series · volumen " + Math.round(C.toDisp(r.vol, U())).toLocaleString("es") + " " + U() + "</div>" + (r.prs.length ? '<div class="sug" style="margin-top:12px"><b>Récords de hoy</b><br>' + r.prs.map(function (p) { return esc(p.n) + ": " + esc(p.t); }).join("<br>") + "</div>" : "") + '<button class="cta" data-a="terminarYa">Guardar y terminar</button><button class="btn sec full" data-a="cerrar">Seguir entrenando</button>');
  }
  function terminarYa() {
    var s = db.sesiones[db.activa], r = resumenFin(s);
    s.fin = Date.now();
    var rt = db.rutinas[s.rutina];
    if (rt) s.ej.forEach(function (e) {   // si cumpliste todo, el peso de la rutina sube al que lograste
      var it = rt.items.filter(function (x) { return x.ej === e.ej; })[0], res = C.resumenEj(e);
      if (it && res.n >= (e.obj.series || 1) && C.setsHechas(e).every(function (x) { return x.reps >= (e.obj.reps || 1); }) && res.max > (it.peso || 0)) { it.peso = res.max; touch("rutina", rt.id, rt); }
    });
    db.activa = null; S.rest = null; restShow(); touch("sesion", s.id, s); cerrar(); sync(false);
    sheet("<h3>¡Entrenamiento guardado!</h3><div class='k'>" + r.series + " series · volumen " + Math.round(C.toDisp(r.vol, U())).toLocaleString("es") + " " + U() + "</div>" + (r.prs.length ? '<div class="sug" style="margin-top:12px"><b>Récords de hoy</b><br>' + r.prs.map(function (p) { return esc(p.n) + ": " + esc(p.t); }).join("<br>") + "</div>" : "") + '<a class="cta" href="#/progreso" data-a="cerrar">Ver mi progreso</a><button class="btn sec full" data-a="cerrar">Cerrar</button>');
    location.hash = "#/hoy";
  }
  function pushItems(rt, ids) { ids.forEach(function (id) { rt.items.push({ ej: id, series: 3, reps: 10, peso: lastPeso(id), desc: db.ajustes.descanso }); }); touch("rutina", rt.id, rt); }
  function lastPeso(id) { var h = C.historial(db, id); return h.length ? h[h.length - 1].max : 0; }
  function idDe(v) { return /^\d+$/.test(v) ? parseInt(v, 10) : v; }
  function platesSheet(kgObj) {
    var u = U(), a = db.ajustes; S.pl = { obj: kgObj ? C.toDisp(kgObj, u) : (u === "kg" ? 60 : 135), barra: u === "kg" ? a.barra : a.barraLb };
    sheet('<h3>Calculadora de discos</h3><label class="lbl">Peso total que quieres levantar (' + u + ')</label><input id="plobj" inputmode="decimal" value="' + (Math.round(S.pl.obj * 10) / 10) + '"><label class="lbl">Barra (' + u + ')</label><div class="seg">' + (u === "kg" ? [20, 15, 10] : [45, 35, 25]).map(function (b) { return '<button class="' + (S.pl.barra === b ? "on" : "") + '" data-a="plbarra" data-v="' + b + '">' + b + "</button>"; }).join("") + '</div><div id="plres"></div><button class="btn sec full" data-a="cerrar">Cerrar</button>');
    platesCalc();
  }
  var PCOL = { 25: "#E5322D", 20: "#2F6BFF", 15: "#F2C230", 10: "#2EB26A", 5: "#EDEDED", 2.5: "#333", 1.25: "#9A9AA2", 1: "#666", 55: "#E5322D", 45: "#2F6BFF", 35: "#F2C230" };
  function platesCalc() {
    var u = U(), a = db.ajustes, el = $("#plres"); if (!el) return;
    var obj = num($("#plobj").value); if (!isFinite(obj)) { el.innerHTML = ""; return; }
    var r = C.discos(obj, S.pl.barra, u === "kg" ? a.discosKg : a.discosLb);
    var viz = '<div class="plates"><div class="bar"></div>' + r.lado.map(function (p) { return '<i style="height:' + (40 + Math.min(80, p * (u === "kg" ? 3.2 : 1.6))) + "px;background:" + (PCOL[p] || "#777") + '"></i>'; }).join("") + "</div>";
    var txt = r.solobarra ? "Es menos que la barra (" + S.pl.barra + " " + u + ")." : r.lado.length ? "Por cada lado: <b>" + r.lado.join(" + ") + " " + u + "</b>" : "Solo la barra.";
    el.innerHTML = viz + '<div style="text-align:center;font-size:17px;line-height:1.5">' + txt + '</div><div class="k" style="text-align:center;margin-top:4px">Total real: ' + r.total + " " + u + (r.exacto ? "" : " · con tus discos no se llega exacto (faltan " + Math.abs(r.falta) + " " + u + ")") + "</div>";
  }

  var A = {
    cerrar: function () { cerrar(); },
    ing: function () { S.ing = !S.ing; var r = parse(); cargarInstr(/^\d+$/.test(r.arg) ? parseInt(r.arg, 10) : r.arg); },
    iniciar: function (el) { iniciar(el.dataset.id); },
    nueva: function () { var id = C.uid(); db.rutinas[id] = { id: id, nombre: "Nueva rutina", dias: [], items: [], orden: Date.now() }; touch("rutina", id, db.rutinas[id]); location.hash = "#/rutina/" + id; },
    plantilla: function (el) {
      var p = C.PLANTILLAS.filter(function (x) { return x.id === el.dataset.id; })[0], n = 0;
      p.rutinas.forEach(function (r) { var id = C.uid() + n, items = r.items.map(function (i) { var X = EX.filter(function (e) { return e.e === i[0]; })[0]; return X ? { ej: X.i, series: i[1], reps: i[2], peso: 0, desc: db.ajustes.descanso } : null; }).filter(Boolean); db.rutinas[id] = { id: id, nombre: r.nombre, dias: r.dias.slice(), items: items, orden: Date.now() + n }; touch("rutina", id, db.rutinas[id]); n++; });
      toast("Plantilla añadida: " + n + " rutinas"); render();
    },
    dia: function (el) { var r = db.rutinas[parse().arg], d = +el.dataset.v, i = r.dias.indexOf(d); if (i >= 0) r.dias.splice(i, 1); else r.dias.push(d); r.dias.sort(); touch("rutina", r.id, r); render(true); },
    abrir: function (el) { var r = parse().arg, k = r + el.dataset.i; S.exp[k] = !S.exp[k]; render(true); },
    mover: function (el) { var r = db.rutinas[parse().arg], i = +el.dataset.i, j = i + (+el.dataset.d); if (j < 0 || j >= r.items.length) return; var t = r.items[i]; r.items[i] = r.items[j]; r.items[j] = t; touch("rutina", r.id, r); render(true); },
    quitar: function (el) { var r = db.rutinas[parse().arg]; r.items.splice(+el.dataset.i, 1); S.exp = {}; touch("rutina", r.id, r); render(true); },
    st: function (el) {
      var r = db.rutinas[parse().arg], it = r.items[+el.dataset.i], k = el.dataset.k, d = +el.dataset.d;
      if (k === "peso") it.peso = Math.max(0, C.r4((it.peso || 0) + d * salto())); else if (k === "desc") it.desc = Math.max(15, (it.desc || db.ajustes.descanso) + d * 15); else it[k] = Math.max(1, (it[k] || 1) + d);
      touch("rutina", r.id, r); render(true);
    },
    duplicar: function (el) { var r = db.rutinas[el.dataset.id], id = C.uid(); db.rutinas[id] = JSON.parse(JSON.stringify(r)); db.rutinas[id].id = id; db.rutinas[id].nombre = r.nombre + " (copia)"; db.rutinas[id].orden = Date.now(); touch("rutina", id, db.rutinas[id]); location.hash = "#/rutina/" + id; },
    borrarR: function (el) { sheet("<h3>¿Eliminar la rutina?</h3><div class='k'>Tus entrenamientos ya guardados no se borran.</div><button class='btn bad full' data-a='borrarRYa' data-id='" + el.dataset.id + "'>Eliminar rutina</button><button class='btn sec full' data-a='cerrar'>Cancelar</button>"); },
    borrarRYa: function (el) { delete db.rutinas[el.dataset.id]; C.marcar(db, "rutina", el.dataset.id); save(); schedSync(); cerrar(); location.hash = "#/rutinas"; },
    grupo: function (el) { S.grupo = el.dataset.v; S.lim = 50; render(true); },
    equipo: function (el) { S.equipo = el.dataset.v; S.lim = 50; render(true); },
    cat: function () { S.cat = S.cat === "Todo" ? "Fuerza" : "Todo"; render(true); },
    mas: function () { S.lim += 60; render(true); },
    sel: function (el) { var id = idDe(el.dataset.id); if (S.sel[id]) delete S.sel[id]; else S.sel[id] = 1; render(true); },
    agregar: function (el) {
      var ids = Object.keys(S.sel).map(idDe);
      if (el.dataset.add) { var rt = db.rutinas[el.dataset.add]; pushItems(rt, ids); S.sel = {}; location.hash = "#/rutina/" + rt.id; }
      else if (el.dataset.ses && db.activa) { var s = db.sesiones[db.activa]; ids.forEach(function (id) { s.ej.push(nuevoEj({ ej: id, series: 3, reps: 10, peso: lastPeso(id) })); }); touch("sesion", s.id, s); S.sel = {}; location.hash = "#/sesion"; }
    },
    custom: function () {
      sheet('<h3>Ejercicio propio</h3><label class="lbl">Nombre</label><input id="cn" maxlength="50" placeholder="Ej.: Press en banco con agarre neutro"><label class="lbl">Grupo muscular</label><select id="cg">' + ["Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Piernas", "Core", "Antebrazo", "Otros"].map(function (g) { return "<option>" + g + "</option>"; }).join("") + '</select><label class="lbl">Equipo</label><select id="cq">' + ["Barra", "Mancuernas", "Polea", "Máquina", "Peso corporal", "Otro"].map(function (g) { return "<option>" + g + "</option>"; }).join("") + '</select><button class="btn full" data-a="customOk">Guardar ejercicio</button><button class="btn sec full" data-a="cerrar">Cancelar</button>');
    },
    customOk: function () { var n = $("#cn").value.trim(); if (!n) { toast("Escribe un nombre"); return; } var id = "c" + C.uid(); db.custom[id] = { id: id, n: n, g: $("#cg").value, q: $("#cq").value }; touch("custom", id, db.custom[id]); cerrar(); render(true); toast("Ejercicio creado"); },
    borrarCustom: function (el) { delete db.custom[el.dataset.id]; C.marcar(db, "custom", el.dataset.id); save(); schedSync(); location.hash = "#/biblioteca"; },
    aRutina: function (el) {
      var rs = rutinasArr(); if (!rs.length) { toast("Crea una rutina primero"); return; }
      sheet("<h3>Añadir a una rutina</h3>" + rs.map(function (r) { return '<button class="btn sec full" data-a="aRutinaOk" data-r="' + r.id + '" data-id="' + el.dataset.id + '">' + esc(r.nombre) + "</button>"; }).join("") + '<button class="btn sec full" data-a="cerrar" style="background:none">Cancelar</button>');
    },
    aRutinaOk: function (el) { pushItems(db.rutinas[el.dataset.r], [idDe(el.dataset.id)]); cerrar(); toast("Añadido a la rutina"); },
    met: function (el) { S.met = el.dataset.v; render(true); },
    rng: function (el) { S.rng = el.dataset.v; render(true); },
    ck: function (el) {
      var row = el.closest(".tr"), o = leerFila(row);
      if (!o.st.ok && !(o.st.reps > 0)) { toast("Escribe las repeticiones"); return; }
      o.st.ok = !o.st.ok;
      if (o.st.ok) {
        var nx = o.e.series[o.j + 1]; if (nx && !nx.ok && !nx.tocado) { nx.kg = o.st.kg; nx.reps = o.st.reps || nx.reps; }
        restStart(o.e.obj.desc || db.ajustes.descanso);
      } else { S.rest = null; restShow(); }
      touch("sesion", o.s.id, o.s); render(true);
    },
    masSerie: function (el) { var s = db.sesiones[db.activa], e = s.ej[+el.dataset.i], l = e.series[e.series.length - 1] || { kg: 0, reps: 10 }; e.series.push({ kg: l.kg, reps: l.reps, ok: false }); touch("sesion", s.id, s); render(true); },
    menosSerie: function (el) { var s = db.sesiones[db.activa], e = s.ej[+el.dataset.i]; if (e.series.length > 1) e.series.pop(); touch("sesion", s.id, s); render(true); },
    quitarEj: function (el) { var s = db.sesiones[db.activa]; s.ej.splice(+el.dataset.i, 1); touch("sesion", s.id, s); render(true); },
    notaEj: function (el) { var s = db.sesiones[db.activa], e = s.ej[+el.dataset.i]; sheet("<h3>Nota de " + esc(ex(e.ej).n) + '</h3><textarea id="nt" rows="3" placeholder="Ej.: altura del banco 4, agarre estrecho">' + esc((db.notas[e.ej] || {}).texto || "") + '</textarea><button class="btn full" data-a="notaOk" data-id="' + e.ej + '">Guardar nota</button><button class="btn sec full" data-a="cerrar">Cancelar</button>'); },
    notaOk: function (el) { var id = el.dataset.id; db.notas[id] = { texto: $("#nt").value.trim() }; touch("nota", id, db.notas[id]); cerrar(); render(true); },
    terminar: function () { terminar(); }, terminarYa: function () { terminarYa(); },
    descartar: function () { sheet("<h3>¿Descartar el entrenamiento?</h3><div class='k'>Se perderán las series de esta sesión.</div><button class='btn bad full' data-a='descartarYa'>Descartar</button><button class='btn sec full' data-a='cerrar'>Seguir entrenando</button>"); },
    descartarYa: function () { var id = db.activa; delete db.sesiones[id]; C.marcar(db, "sesion", id); db.activa = null; S.rest = null; restShow(); save(); schedSync(); cerrar(); location.hash = "#/hoy"; },
    rmenos: function () { if (S.rest) { S.rest.fin -= 15000; S.rest.total = Math.max(S.rest.total, 1); restTick(); } },
    rmas: function () { if (S.rest) { S.rest.fin += 15000; S.rest.total += 15; restTick(); } },
    rfin: function () { S.rest = null; restShow(); },
    discos: function (el) { var kg = 0; if (el.dataset.i !== undefined && db.activa) { var e = db.sesiones[db.activa].ej[+el.dataset.i], st = e.series.filter(function (x) { return !x.ok; })[0] || e.series[0]; kg = st ? st.kg : 0; } platesSheet(kg); },
    plbarra: function (el) { S.pl.barra = +el.dataset.v; $$("#sheet .seg button").forEach(function (b) { b.classList.toggle("on", +b.dataset.v === S.pl.barra); }); platesCalc(); },
    unidad: function (el) { db.ajustes.unidad = el.dataset.v; touch("ajustes", "ajustes", db.ajustes); render(true); },
    barra: function (el) { var v = +el.dataset.v; if (U() === "kg") db.ajustes.barra = v; else db.ajustes.barraLb = v; touch("ajustes", "ajustes", db.ajustes); render(true); },
    disco: function (el) { var v = +el.dataset.v, l = U() === "kg" ? db.ajustes.discosKg : db.ajustes.discosLb, i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v); l.sort(function (a, b) { return b - a; }); touch("ajustes", "ajustes", db.ajustes); render(true); },
    salto: function (el) { var v = +el.dataset.v; if (U() === "kg") db.ajustes.saltoKg = v; else db.ajustes.saltoLb = v; touch("ajustes", "ajustes", db.ajustes); render(true); },
    desc: function (el) { db.ajustes.descanso = +el.dataset.v; touch("ajustes", "ajustes", db.ajustes); render(true); },
    sonido: function () { audioUnlock(); db.ajustes.sonido = !db.ajustes.sonido; touch("ajustes", "ajustes", db.ajustes); render(true); if (db.ajustes.sonido) beep(); },
    sync: function () { sync(true).then(function () { render(true); }); },
    liberar: function () {
      if (Object.keys(db.pend).length) { toast("Hay datos sin subir: espera a que se sincronicen"); return; }
      if (!hasToken() || !db.sync.ok) { toast("Todavía no se ha sincronizado con tu hoja: no se puede liberar"); return; }
      sheet("<h3>¿Liberar espacio?</h3><div class='k'>Se borra la copia de este dispositivo y se vuelve a bajar de tu hoja de cálculo. Tarda unos segundos.</div><button class='btn full' data-a='liberarYa'>Liberar espacio</button><button class='btn sec full' data-a='cerrar'>Cancelar</button>");
    },
    liberarYa: function () {
      cerrar(); LS.removeItem("gym_db"); db = C.cargar(LS); S.cargando = true;
      if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { if (k.indexOf("gym-img") === 0) caches.delete(k); }); });
      render(); sync(true).then(function () { S.cargando = false; render(); usoEspacio(); });
    },
    exportar: function () {
      var blob = new Blob([JSON.stringify(db, null, 1)], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = "gym-copia-" + C.hoy() + ".json"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
    },
    reset: function () { sheet("<h3>¿Borrar los datos de este dispositivo?</h3><div class='k'>Rutinas, entrenamientos y notas de este celular. Si ya sincronizaste, siguen en tu hoja de cálculo.</div><button class='btn bad full' data-a='resetYa'>Borrar</button><button class='btn sec full' data-a='cerrar'>Cancelar</button>"); },
    resetYa: function () { LS.removeItem("gym_db"); db = C.cargar(LS); cerrar(); toast("Datos borrados"); location.hash = "#/hoy"; render(); }
  };
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-a]"); if (!el || el.dataset.a === "drag") return;
    var f = A[el.dataset.a]; if (!f) return;
    if (el.tagName === "A" && el.dataset.a === "cerrar") { cerrar(); return; }
    e.preventDefault(); f(el);
  });
  document.addEventListener("input", function (e) {
    if (e.target.id === "q") { S.q = e.target.value; S.lim = 50; clearTimeout(input.t); input.t = setTimeout(function () { var pos = e.target.selectionStart; render(true); var q = $("#q"); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) {} } }, 160); }
    if (e.target.id === "plobj") platesCalc();
  });
  function input() {}
  document.addEventListener("change", function (e) {
    var t = e.target, f = t.dataset && t.dataset.f; if (!f) return;
    if (f === "kg" || f === "reps") { if (!db.activa) return; var row = t.closest(".tr"), i = +row.dataset.i, j = +row.dataset.j, s = db.sesiones[db.activa], st = s.ej[i].series[j], v = num(t.value); if (isFinite(v) && v >= 0) { if (f === "kg") st.kg = C.toKg(v, U()); else st.reps = Math.round(v); st.tocado = true; touch("sesion", s.id, s); } }
    else if (f === "rnom") { var r = db.rutinas[parse().arg]; r.nombre = t.value.trim() || "Rutina"; touch("rutina", r.id, r); }
    else if (f === "ri") { var rt = db.rutinas[parse().arg], it = rt.items[+t.dataset.i], k = t.dataset.k, v2 = num(t.value); if (isFinite(v2) && v2 >= 0) { if (k === "peso") it.peso = C.toKg(v2, U()); else it[k] = Math.max(1, Math.round(v2)); touch("rutina", rt.id, rt); render(true); } }
    else if (f === "nota") { var id = idDe(t.dataset.id); db.notas[id] = { texto: t.value.trim() }; touch("nota", id, db.notas[id]); toast("Nota guardada"); }
  });
  /* arrastrar para ordenar ejercicios de la rutina */
  document.addEventListener("pointerdown", function (e) {
    var h = e.target.closest('[data-a="drag"]'); if (!h) return;
    var row = h.closest(".ritem"), list = row.parentNode, rt = db.rutinas[parse().arg]; if (!rt) return;
    e.preventDefault(); var y0 = e.clientY, i0 = +row.dataset.i, hgt = row.offsetHeight, to = i0;
    row.classList.add("drag"); try { h.setPointerCapture(e.pointerId); } catch (x) {}
    function mv(ev) { var dy = ev.clientY - y0; row.style.transform = "translateY(" + dy + "px)"; to = Math.max(0, Math.min(rt.items.length - 1, i0 + Math.round(dy / hgt))); }
    function up() { h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); row.classList.remove("drag"); row.style.transform = ""; if (to !== i0) { var it = rt.items.splice(i0, 1)[0]; rt.items.splice(to, 0, it); touch("rutina", rt.id, rt); S.exp = {}; render(true); } }
    h.addEventListener("pointermove", mv); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
  });

  /* ---------- arranque ---------- */
  function boot() {
    var vacio = !db.sync.ult && !Object.keys(db.rutinas).length && !Object.keys(db.sesiones).length;
    if (vacio && hasToken()) S.cargando = true;
    render();
    sync(false).then(function () { if (S.cargando) { S.cargando = false; render(); } });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  }
  function cargarTodo() {
  fetch("data/exercises.json").then(function (r) { return r.json(); }).then(function (d) {
      EX = d; d.forEach(function (x) { BYEN[x.e] = x; }); window.GYM_DEBUG = { db: function () { return db; }, EX: EX }; boot();
    }).catch(function () { $("#view").innerHTML = '<div class="card empty"><b>No se pudo cargar la biblioteca</b>Abre la app con internet una vez para guardar los ejercicios en este dispositivo.</div>'; });
  }
  FergardAcceso.iniciar({
    app: "gym", nombre: "Gym", clientId: CFG.CLIENT_ID, onListo: cargarTodo,
    tema: { bg: "#141112", fg: "#F4F4F5", mut: "#9A9AA2", acento: "#FF7262", btnBg: "#F4F4F5", btnFg: "#0C0C0D" },
    marca: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#FF5A47" stroke-width="2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/></svg>'
  });
})();
