/* RG Hematología — service worker de la versión instalable.
   - La app (index.html) se busca SIEMPRE primero en internet, para tener la versión más reciente;
     si no hay conexión, se abre la última copia guardada.
   - Las librerías externas (PDF, Word, tipografías) se guardan para poder usarse sin internet.
   - Google Drive, inicio de sesión de Google y Claude.ai NUNCA pasan por aquí. */
const CACHE = 'rg-hematologia-v1';
const ARCHIVOS_BASE = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const LIBRERIAS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ARCHIVOS_BASE.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // La app y sus archivos: primero internet, si falla la copia guardada
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then(r => {
          if (r && r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
          return r;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then(r => r || (req.mode === 'navigate' ? caches.match('./') : undefined))
          .then(r => r || Response.error()))
    );
    return;
  }

  // Librerías externas: copia guardada al instante y se actualiza en segundo plano
  if (LIBRERIAS.includes(url.hostname)) {
    e.respondWith(
      caches.open(CACHE).then(c => c.match(req).then(guardada => {
        const red = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => guardada);
        return guardada || red;
      }))
    );
  }
  // Todo lo demás (Google Drive, inicio de sesión, Claude.ai) va directo a internet
});
