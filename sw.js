// HR Manager — Service Worker v3
const CACHE = 'hr-manager-v3';

// Solo risorse CDN pesanti: vengono cachate per performance
const PRECACHE = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.development.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.development.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
  'https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap',
];

// ── Install: metti in cache solo le risorse CDN ──────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: rimuovi cache vecchie ─────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Supabase API → sempre rete (mai cache)
  if (url.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // index.html e pagine HTML → network-first (sempre aggiornato)
  // fallback su cache solo se offline
  if (url.endsWith('/') || url.endsWith('.html') || url.includes('/hr-manager') && !url.includes('.')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r && r.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          }
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Font Google → stale-while-revalidate
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const network = fetch(e.request).then(r => {
          caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          return r;
        });
        return cached || network;
      })
    );
    return;
  }

  // CDN e tutto il resto → cache-first, fallback rete
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
      if (r && r.status === 200 && e.request.method === 'GET') {
        caches.open(CACHE).then(c => c.put(e.request, r.clone()));
      }
      return r;
    }))
  );
});
