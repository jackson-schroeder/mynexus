// myNexus service worker: lets the phone app open instantly and work offline.
// Network first (so updates arrive as soon as you're online), falling back to the saved copy.
const CACHE = 'mynexus-v1';
const SHELL = ['./', 'index.html', 'css/theme.css', 'css/layout.css', 'css/projects.css', 'css/time.css', 'css/fitness.css', 'css/mobile.css',
  'js/config.js', 'js/vendor/supabase.js', 'js/store.js', 'js/projects.js', 'js/personal.js', 'js/bin.js', 'js/link.js', 'js/time.js', 'js/authflow.js', 'js/account.js', 'js/gate.js', 'js/tour.js',
  'js/fitness.js', 'js/foods.js', 'js/diet.js', 'js/lift.js', 'js/app.js', 'js/search.js', 'pwa/icon-192.png', 'pwa/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || (u.origin !== location.origin && !/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname))) return; // Supabase calls go straight out
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
