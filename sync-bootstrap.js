/* Acquire the cache lock before the compressed app or any overlays can write. */
(()=>{
  window.ppmCacheReady=new Promise(resolve=>{
    if(!navigator.locks?.request){resolve(false);return;}
    navigator.locks.request('ppm-local-cache-writer',{ifAvailable:true},async lock=>{
      if(!lock){resolve(false);return;}
      try{window.PPMSyncCore.recoverStorage(localStorage);}
      catch(error){window.ppmCacheError='Saved recovery data needs attention. Do not clear browser data.';resolve(false);return;}
      window.__ppmOwnsCacheLock=true;resolve(true);
      await new Promise(()=>{}); // released by the browser when this page closes
    }).catch(()=>resolve(false));
  });
})();
