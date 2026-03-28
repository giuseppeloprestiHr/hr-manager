// HR Manager — Service Worker v7
const CACHE = 'hr-manager-v7';

// Risorse CDN pesanti — cachate al primo avvio
const PRECACHE_CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.development.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.development.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
  'https://cdn.tailwindcss.com',
];

// Risorse locali — cachate al primo avvio
const PRECACHE_LOCAL = [
  '/hr-manager/',
  '/hr-manager/index.html',
  '/hr-manager/manifest.json',
  '/hr-manager/icon-192.png',
  '/hr-manager/icon-512.png',
  '/hr-manager/sw.js',
];

// ── Install: precache CDN + risorse locali ───────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.all([
      c.addAll(PRECACHE_CDN).catch(() => {}),   // CDN: ignora errori di rete
      c.addAll(PRECACHE_LOCAL).catch(() => {}),  // Locali: ignora errori
    ])).then(() => self.skipWaiting())
  );
});

// ── Activate: rimuovi cache vecchie ─────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;

  // Supabase API → sempre rete (mai cache)
  if (url.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // index.html e radice app → network-first, fallback cache offline
  if (url.endsWith('/') || url.endsWith('.html') || (url.includes('/hr-manager') && !url.includes('.'))) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r && r.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          }
          return r;
        })
        .catch(() => caches.match(e.request) || caches.match('/hr-manager/index.html'))
    );
    return;
  }

  // Font Google → stale-while-revalidate (usa cache subito, aggiorna in background)
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(e.request).then(cached => {
          const network = fetch(e.request).then(r => {
            if (r && r.status === 200) c.put(e.request, r.clone());
            return r;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // CDN e tutto il resto → cache-first, poi rete, poi aggiorna cache
  e.respondWith(
    caches.open(CACHE).then(c =>
      c.match(e.request).then(cached => {
        const network = fetch(e.request).then(r => {
          if (r && r.status === 200) c.put(e.request, r.clone());
          return r;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});
