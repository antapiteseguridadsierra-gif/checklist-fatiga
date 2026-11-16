const CACHE = 'checklist-v7';
const ICONS_CSS = 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css';
const LOCAL = ['./', 'index.html', 'manifest.json', 'icon.svg'];

// Guarda el CSS de íconos y sus fuentes para que se vean sin internet
async function precachearIconos(cache){
  const res = await fetch(ICONS_CSS);
  const css = await res.clone().text();
  await cache.put(ICONS_CSS, res);
  const fuentes = [...css.matchAll(/url\(([^)]+)\)/g)]
    .map(m => m[1].replace(/['"]/g, '').trim())
    .filter(u => /\.woff2?(\?|#|$)/.test(u))
    .map(u => new URL(u, ICONS_CSS).href);
  await Promise.all([...new Set(fuentes)].map(u => cache.add(u).catch(() => {})));
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(LOCAL.map(u => cache.add(u).catch(() => {})));
    try { await precachearIconos(cache); } catch (err) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  // Nunca interceptar el envío a Google Sheets
  if (url.includes('script.google.com') || url.includes('googleusercontent.com')) return;

  // Cache primero (abre rápido y sin internet) y se actualiza en segundo plano
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      const red = fetch(req).then(res => {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia));
        }
        return res;
      }).catch(() => cached || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
      return cached || red;
    })
  );
});
