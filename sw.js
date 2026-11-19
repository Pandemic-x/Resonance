// Resonance service worker: app werkt offline na het eerste bezoek.
// Verhoog VERSION bij elke nieuwe versie, dan halen telefoons de update op.
const VERSION = 'resonance-v8';
const CORE = [
 "./",
 "index.html",
 "manifest.json",
 "css/bibliotheek.css",
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
 "js/bibliotheek.js",
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
// Eigen bestanden: eerst het netwerk (altijd de nieuwste versie), de cache alleen als je offline bent.
// Geluiden en lettertypes: eerst uit de cache (groot en veranderen niet), op de achtergrond verversen.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!own && !fonts) return;
  const zwaar = fonts || url.pathname.includes('/sounds/');
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = () => c.match(req, { ignoreSearch: own });
    if (zwaar){
      const h = await hit();
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => h);
      return h || net;
    }
    try {
      const r = await fetch(req, { cache: 'no-cache' });
      if (r && r.ok) c.put(req, r.clone());
      return r;
    } catch(err){ return (await hit()) || Response.error(); }
  }));
});
