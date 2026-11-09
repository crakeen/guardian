// Service worker: guarda la app para que funcione sin conexión.
// Sube VERSION cada vez que publiques cambios.
const VERSION = 'gd-v8';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'src/styles.css', 'src/app.js', 'src/config.js', 'src/time.js', 'src/store.js', 'src/news.js', 'src/metrics.js',
  'src/rules/sizing.js', 'src/rules/account.js', 'src/rules/gate.js', 'src/rules/challenge.js',
  'src/ui/dom.js', 'src/ui/today.js', 'src/ui/entry.js', 'src/ui/close.js', 'src/ui/journal.js', 'src/ui/stats.js', 'src/ui/more.js', 'src/ui/routine.js', 'src/ui/schedule.js', 'src/ui/acctTabs.js', 'src/accounts.js', 'src/ui/money.js',
  'data/calendar.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Red primero (para recibir el calendario y las actualizaciones); sin conexión, la copia guardada.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Una petición de navegación no admite opciones extra: si se le pasan, falla y se servía la copia vieja.
  const req = e.request.mode === 'navigate' ? fetch(e.request) : fetch(e.request, { cache: 'no-cache' });
  e.respondWith(
    req
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
