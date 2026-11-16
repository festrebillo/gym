/* Service worker de Gym: guarda SOLO la cáscara de la app (≈0,5 MB) para que abra aunque no haya señal.
   No guarda fotos (se piden en línea cada vez) ni datos. Al actualizar borra cualquier caché antiguo, incluido el de fotos. */
const CACHE = "gym-v0.4.0";
const FILES = ["./", "index.html", "gym.css", "gym.js", "core.js", "acceso.js", "config.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "data/exercises.json"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (/\/(img|t)\/[^/]+\.jpg$/.test(u.pathname) || /\/data\/instr/.test(u.pathname)) return;   // fotos e instrucciones: solo en línea (no se guardan)
  e.respondWith(fetch(e.request).then((r) => { if (r.ok && FILES.some((f) => u.pathname.endsWith(f.replace("./", "")) || u.pathname.endsWith("/"))) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
