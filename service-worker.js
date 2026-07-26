const CACHE_NAME = 'generador-kml-v1';
const ARCHIVOS_APP = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(ARCHIVOS_APP);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(nombres){
      return Promise.all(
        nombres.filter(function(n){ return n !== CACHE_NAME; })
               .map(function(n){ return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event){
  const url = new URL(event.request.url);

  // Las teselas satelitales (Esri) y cualquier otro origen externo van directo a la red,
  // no las cacheamos aca (cambian segun donde mires el mapa).
  if(url.origin !== self.location.origin){
    return;
  }

  // App shell: cache primero, si no esta, va a la red y lo guarda para la proxima.
  event.respondWith(
    caches.match(event.request).then(function(respuestaCache){
      if(respuestaCache) return respuestaCache;
      return fetch(event.request).then(function(respuestaRed){
        return caches.open(CACHE_NAME).then(function(cache){
          cache.put(event.request, respuestaRed.clone());
          return respuestaRed;
        });
      });
    }).catch(function(){
      return caches.match('./index.html');
    })
  );
});
