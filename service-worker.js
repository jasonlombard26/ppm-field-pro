const PPM_CACHE_RESET_VERSION='36';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())await caches.delete(key);
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  await self.registration.unregister();
  await self.clients.claim();
  for(const client of clients){
    try{await client.navigate(new URL('./?v='+PPM_CACHE_RESET_VERSION,self.registration.scope).href);}catch(_){}
  }
})()));
