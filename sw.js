/* Service worker de Gym: guarda la cáscara de la app para abrir sin conexión.
   Los datos NUNCA pasan por el caché. Las fotos se guardan al verlas (primero caché) en un caché propio que no se borra al actualizar. */
const CACHE = "gym-v0.2.0";
const IMG = "gym-img-v1";
const FILES = ["./", "index.html", "gym.css", "gym.js", "core.js", "acceso.js", "config.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "data/exercises.json", "data/instr_es.json"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== IMG).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (/\/(img|t)\/[^/]+\.jpg$/.test(u.pathname)) {
    e.respondWith(caches.open(IMG).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }))));
    return;
  }
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
