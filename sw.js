// Resonance service worker: app werkt offline na het eerste bezoek.
// Verhoog VERSION bij elke nieuwe versie, dan halen telefoons de update op.
const VERSION = 'resonance-v4';
const CORE = [
 "./",
 "index.html",
 "manifest.json",
 "css/dictee.css",
 "css/donker.css",
 "css/drone.css",
 "css/harmonie.css",
 "css/intervallen.css",
 "css/intonatie.css",
 "css/lezen.css",
 "css/metronoom.css",
 "css/notatie.css",
 "css/partituren.css",
 "css/ritmetrainer.css",
 "css/style.css",
 "css/sync.css",
 "icons/apple-touch-icon.png",
 "icons/favicon-32.png",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/maskable-512.png",
 "js/absoluut.js",
 "js/akkoorden.js",
 "js/akkoordsymbolen.js",
 "js/audio.js",
 "js/dictee.js",
 "js/drone-melodie.js",
 "js/drone-trappen.js",
 "js/drone.js",
 "js/engine.js",
 "js/handleiding.js",
 "js/harmonie.js",
 "js/helpers.js",
 "js/iconen.js",
 "js/instellingen.js",
 "js/intervallen.js",
 "js/intonatie.js",
 "js/kwintcirkel.js",
 "js/luisteren.js",
 "js/main.js",
 "js/metronoom.js",
 "js/nav.js",
 "js/notatie.js",
 "js/notenleer.js",
 "js/opnames.js",
 "js/paneel.js",
 "js/partituren.js",
 "js/presets.js",
 "js/relatief.js",
 "js/ritme-catalogus.js",
 "js/ritme-tikken.js",
 "js/ritme.js",
 "js/ritmetrainer.js",
 "js/router.js",
 "js/samples.js",
 "js/score.js",
 "js/termen.js",
 "js/thema.js",
 "js/theorie.js",
 "js/toetsen.js",
 "js/toonladders.js",
 "js/toonsoorten.js",
 "js/vraag-app.js",
 "js/vraag.js",
 "js/sync.js",
 "js/vendor/supabase.js"
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Eerst uit de cache (snel en offline), op de achtergrond verversen.
// Geluidsbestanden en lettertypes worden bewaard zodra ze één keer gebruikt zijn.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!own && !fonts) return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: own });
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
