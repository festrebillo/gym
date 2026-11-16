/* Gym · núcleo: datos locales, unidades, cálculos, discos, plantillas y sincronización.
   Todo funciona sin internet; la sincronización con la hoja de cálculo es un extra que se pone al día cuando hay red. */
(function (root) {
  "use strict";
  var KG_LB = 0.45359237;
  var DB_KEY = "gym_db";

  /* ---------- utilidades ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function hoy() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function r4(x) { return Math.round(x * 10000) / 10000; }
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

  /* ---------- unidades (internamente todo en kg) ---------- */
  function toDisp(kg, u) { return u === "lb" ? kg / KG_LB : kg; }
  function toKg(v, u) { return r4(u === "lb" ? v * KG_LB : v); }
  function fmt(kg, u) {
    var v = Math.round(toDisp(kg, u) * 10) / 10;   // 1 decimal; 135 lb guardado como 61.2349 kg vuelve a mostrar 135
    return String(v).replace(/\.0$/, "");
  }
  function defaults() {
    return { unidad: "kg", barra: 20, barraLb: 45, discosKg: [25, 20, 15, 10, 5, 2.5, 1.25], discosLb: [45, 35, 25, 10, 5, 2.5], saltoKg: 2.5, saltoLb: 5, descanso: 90, sonido: true };
  }

  /* ---------- cálculos de progreso ---------- */
  function e1rm(kg, reps) { if (!kg || !reps) return 0; if (reps === 1) return kg; return kg * (1 + Math.min(reps, 12) / 30); }   // Epley
  function setsHechas(sesionEj) { return (sesionEj.series || []).filter(function (s) { return s.ok && s.reps > 0 && s.kg >= 0; }); }
  function resumenEj(sesionEj) {
    var h = setsHechas(sesionEj), mejor = null, vol = 0, mx = 0, best1 = 0, mr = 0;
    h.forEach(function (s) { vol += s.kg * s.reps; if (s.kg > mx) mx = s.kg; if (s.reps > mr) mr = s.reps; var e = e1rm(s.kg, s.reps); if (e > best1) { best1 = e; mejor = s; } });
    if (!mejor && h.length) mejor = h[0];
    return { n: h.length, vol: vol, max: mx, e1rm: best1, mejor: mejor, reps: mr };
  }
  /* historial de un ejercicio: [{fecha, sesion, n, vol, max, e1rm, mejor}] ordenado por fecha */
  function historial(db, exId) {
    var out = [];
    Object.keys(db.sesiones).forEach(function (k) {
      var s = db.sesiones[k]; if (!s.fin) return;
      (s.ej || []).forEach(function (e) {
        if (e.ej !== exId) return;
        var r = resumenEj(e); if (!r.n) return;
        out.push({ fecha: s.fecha, sesion: s.id, n: r.n, vol: r.vol, max: r.max, e1rm: r.e1rm, reps: r.reps, mejor: r.mejor, series: setsHechas(e) });
      });
    });
    out.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
    return out;
  }
  /* récords: mejor peso, mejor 1RM estimado y mejor volumen en una sesión */
  function records(hist) {
    var r = { max: 0, e1rm: 0, vol: 0, reps: 0 };
    hist.forEach(function (h) { if (h.reps > r.reps) r.reps = h.reps; if (h.max > r.max) r.max = h.max; if (h.e1rm > r.e1rm) r.e1rm = h.e1rm; if (h.vol > r.vol) r.vol = h.vol; });
    return r;
  }
  /* sugerencia de peso para hoy (doble progresión) */
  function sugerir(item, hist, saltoKg) {
    if (!hist || !hist.length) return { kg: item.peso || 0, tipo: "inicio", texto: "" };
    var last = hist[hist.length - 1], objS = item.series || 3, objR = item.reps || 8;
    if (last.max === 0) return { kg: 0, tipo: "reps", texto: "Peso corporal: intenta 1 o 2 repeticiones más que la última vez (" + last.reps + ") o añade peso." };
    var topKg = last.max, topSets = last.series.filter(function (s) { return s.kg === topKg; });
    var cumple = last.series.length >= objS && last.series.every(function (s) { return s.reps >= objR; });
    if (cumple) return { kg: r4(topKg + saltoKg), tipo: "subir", base: topKg, texto: "Completaste " + objS + " × " + objR + ". Hoy prueba subir." };
    return { kg: topKg, tipo: "repetir", base: topKg, texto: "Mantén este peso hasta lograr " + objS + " × " + objR + "." };
  }
  /* ¿subió de peso respecto a la sesión anterior? devuelve diferencia en kg o 0 */
  function subida(hist) {
    if (!hist || hist.length < 2) return 0;
    var a = hist[hist.length - 1].max, b = hist[hist.length - 2].max;
    return a > b ? r4(a - b) : 0;
  }

  /* ---------- calculadora de discos (todo en la unidad mostrada) ---------- */
  function discos(objetivo, barra, disponibles) {
    var lado = (objetivo - barra) / 2, res = [], resto;
    if (objetivo < barra) return { lado: [], total: barra, exacto: false, falta: r4(barra - objetivo), solobarra: true };
    var pl = disponibles.slice().sort(function (a, b) { return b - a; });
    resto = lado;
    pl.forEach(function (p) { while (resto + 1e-9 >= p) { res.push(p); resto = r4(resto - p); } });
    var total = r4(barra + 2 * res.reduce(function (a, b) { return a + b; }, 0));
    return { lado: res, total: total, exacto: Math.abs(resto) < 1e-6, falta: r4(objetivo - total), solobarra: false };
  }

  /* ---------- plantillas ---------- */
  var PLANTILLAS = [
    { id: "ppl", nombre: "Push / Pull / Piernas", desc: "3 días · empuje, tirón y piernas", rutinas: [
      { nombre: "Push (empuje)", dias: [1], items: [["Barbell Bench Press - Medium Grip", 4, 8], ["Barbell Incline Bench Press - Medium Grip", 3, 10], ["Dumbbell Shoulder Press", 3, 10], ["Side Lateral Raise", 3, 15], ["Triceps Pushdown - Rope Attachment", 3, 12]] },
      { nombre: "Pull (tirón)", dias: [3], items: [["Pullups", 4, 8], ["Bent Over Barbell Row", 4, 8], ["Wide-Grip Lat Pulldown", 3, 10], ["Face Pull", 3, 15], ["Barbell Curl", 3, 10]] },
      { nombre: "Piernas", dias: [5], items: [["Barbell Squat", 4, 8], ["Romanian Deadlift", 3, 10], ["Leg Press", 3, 12], ["Lying Leg Curls", 3, 12], ["Standing Calf Raises", 4, 15]] }] },
    { id: "ul", nombre: "Torso / Pierna", desc: "4 días · torso y pierna alternados", rutinas: [
      { nombre: "Torso A", dias: [1], items: [["Barbell Bench Press - Medium Grip", 4, 6], ["Bent Over Barbell Row", 4, 6], ["Dumbbell Shoulder Press", 3, 10], ["Wide-Grip Lat Pulldown", 3, 10], ["Barbell Curl", 3, 12], ["Triceps Pushdown - Rope Attachment", 3, 12]] },
      { nombre: "Pierna A", dias: [2], items: [["Barbell Squat", 4, 6], ["Romanian Deadlift", 3, 8], ["Leg Press", 3, 12], ["Lying Leg Curls", 3, 12], ["Standing Calf Raises", 4, 15]] },
      { nombre: "Torso B", dias: [4], items: [["Barbell Incline Bench Press - Medium Grip", 4, 8], ["Seated Cable Rows", 4, 8], ["Dumbbell Flyes", 3, 12], ["Pullups", 3, 8], ["Hammer Curls", 3, 12], ["EZ-Bar Skullcrusher", 3, 12]] },
      { nombre: "Pierna B", dias: [5], items: [["Front Barbell Squat", 4, 8], ["Barbell Hip Thrust", 3, 10], ["Dumbbell Lunges", 3, 12], ["Leg Extensions", 3, 15], ["Seated Calf Raise", 4, 15]] }] },
    { id: "fb", nombre: "Cuerpo completo", desc: "3 días · todo el cuerpo cada sesión", rutinas: [
      { nombre: "Cuerpo completo A", dias: [1, 5], items: [["Barbell Squat", 3, 8], ["Barbell Bench Press - Medium Grip", 3, 8], ["Bent Over Barbell Row", 3, 8], ["Dumbbell Shoulder Press", 2, 10], ["Plank", 3, 1]] },
      { nombre: "Cuerpo completo B", dias: [3], items: [["Barbell Deadlift", 3, 5], ["Barbell Incline Bench Press - Medium Grip", 3, 8], ["Wide-Grip Lat Pulldown", 3, 10], ["Dumbbell Lunges", 3, 10], ["Barbell Curl", 2, 12]] }] }
  ];

  /* ---------- base de datos local ---------- */
  function vacia() { return { v: 1, ajustes: defaults(), rutinas: {}, sesiones: {}, notas: {}, custom: {}, activa: null, pend: {}, sync: { ult: 0 } }; }
  function cargar(store) {
    var db;
    try { db = JSON.parse(store.getItem(DB_KEY)); } catch (e) { db = null; }
    if (!db || typeof db !== "object") db = vacia();
    var d = vacia(); Object.keys(d).forEach(function (k) { if (db[k] === undefined) db[k] = d[k]; });
    var a = defaults(); Object.keys(a).forEach(function (k) { if (db.ajustes[k] === undefined) db.ajustes[k] = a[k]; });
    return db;
  }
  function guardar(store, db) { try { store.setItem(DB_KEY, JSON.stringify(db)); return true; } catch (e) { return false; } }
  function marcar(db, t, id) { db.pend[t + ":" + id] = Date.now(); }

  /* ---------- sincronización con la hoja (vía Fergard API) ---------- */
  function docsPendientes(db) {
    var out = [];
    Object.keys(db.pend).forEach(function (k) {
      var p = k.split(":"), t = p[0], id = p.slice(1).join(":"), d = null, del = false, upd = db.pend[k];
      if (t === "rutina") d = db.rutinas[id];
      else if (t === "sesion") d = db.sesiones[id];
      else if (t === "nota") d = db.notas[id];
      else if (t === "custom") d = db.custom[id];
      else if (t === "ajustes") d = db.ajustes;
      if (!d) { del = true; d = {}; }
      out.push({ t: t, id: id, upd: (d && d.upd) || upd, del: del, d: d });
    });
    return out;
  }
  function aplicarRemotos(db, docs) {
    var n = 0;
    (docs || []).forEach(function (r) {
      var mapa = { rutina: db.rutinas, sesion: db.sesiones, nota: db.notas, custom: db.custom }[r.t];
      if (r.t === "ajustes") { if (!db.ajustes.upd || r.upd > db.ajustes.upd) { var a = r.d || {}; Object.keys(a).forEach(function (k) { db.ajustes[k] = a[k]; }); db.ajustes.upd = r.upd; n++; } return; }
      if (!mapa) return;
      var local = mapa[r.id];
      if (db.pend[r.t + ":" + r.id] && local && (local.upd || 0) >= r.upd) return;   // lo local es más nuevo
      if (local && (local.upd || 0) >= r.upd) return;
      if (r.del) delete mapa[r.id]; else { r.d.upd = r.upd; mapa[r.id] = r.d; }
      n++;
    });
    return n;
  }
  /* pide al script: {docs:[...], ahora}. fetchFn(url, body) -> Promise<json> */
  function sincronizar(db, cfg, fetchFn) {
    if (!cfg.url || !cfg.token) return Promise.resolve({ ok: false, error: "sin_acceso" });
    var enviados = docsPendientes(db), claves = Object.keys(db.pend), t0 = Date.now();
    return fetchFn(cfg.url, { op: "gym_sync", token: cfg.token, since: db.sync.ult || 0, docs: enviados }).then(function (r) {
      if (!r || !r.ok) return { ok: false, error: (r && r.error) || "error" };
      claves.forEach(function (k) { if (db.pend[k] <= t0) delete db.pend[k]; });
      var n = aplicarRemotos(db, r.docs);
      db.sync.ult = r.ahora || t0; db.sync.ok = Date.now(); if (r.url) db.sync.url = r.url;
      return { ok: true, recibidos: n, enviados: enviados.length };
    });
  }

  var api = { KG_LB: KG_LB, uid: uid, hoy: hoy, norm: norm, r4: r4, toDisp: toDisp, toKg: toKg, fmt: fmt, defaults: defaults, e1rm: e1rm, setsHechas: setsHechas, resumenEj: resumenEj, historial: historial,
    records: records, sugerir: sugerir, subida: subida, discos: discos, PLANTILLAS: PLANTILLAS, vacia: vacia, cargar: cargar, guardar: guardar, marcar: marcar, docsPendientes: docsPendientes, aplicarRemotos: aplicarRemotos, sincronizar: sincronizar };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GymCore = api;
})(typeof window !== "undefined" ? window : this);
