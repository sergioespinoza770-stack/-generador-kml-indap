const CACHE_NAME = 'generador-kml-v2';
const CACHE_COMPARTIDOS = 'generador-kml-compartidos';
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
        nombres.filter(function(n){ return n !== CACHE_NAME && n !== CACHE_COMPARTIDOS; })
               .map(function(n){ return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event){
  const url = new URL(event.request.url);

  // Cuando Android comparte un archivo .kml/.kmz hacia la app, llega como
  // POST a ./compartido.html (definido en manifest.json -> share_target).
  if(event.request.method === 'POST' && url.pathname.endsWith('/compartido.html')){
    event.respondWith(manejarArchivoCompartido(event));
    return;
  }

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

async function manejarArchivoCompartido(event){
  try{
    const datosFormulario = await event.request.formData();
    const archivos = datosFormulario.getAll('archivosCompartidos');
    const cache = await caches.open(CACHE_COMPARTIDOS);

    // Guardamos cada archivo compartido bajo una clave propia para que
    // index.html los pueda leer apenas termine de abrir.
    let indice = 0;
    for(const archivo of archivos){
      const nombre = (archivo && archivo.name) ? archivo.name : ('compartido_' + indice + '.kml');
      const respuesta = new Response(archivo, {
        headers: { 'X-Nombre-Original': nombre }
      });
      await cache.put('./compartido-' + indice, respuesta);
      indice++;
    }
    await cache.put('./compartido-cantidad', new Response(String(indice)));

    return Response.redirect('./index.html?compartido=1', 303);
  }catch(err){
    return Response.redirect('./index.html?compartido=error', 303);
  }
}
