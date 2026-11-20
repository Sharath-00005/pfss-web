// Public Force: lets the tool be installed on a phone. Pages and the app's own files are always fetched from the network
// first (so a new build is picked up at once); the saved copy is only a fallback when there is no signal.
// Data is never kept here: it comes from the database each time, so without signal the page opens but shows no data.
var CACHE='pfss-main-v2';
var SHELL=['./','index.html','config.js','pfss-backend.js','icon-192.png','manifest.webmanifest'];
self.addEventListener('install',function(e){ self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(function(c){ return Promise.all(SHELL.map(function(u){ return c.add(u).catch(function(){}); })); })); });
self.addEventListener('activate',function(e){ e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); })); });
self.addEventListener('fetch',function(e){
  var r=e.request; if(r.method!=='GET') return; var u=new URL(r.url); if(u.origin!==location.origin) return;
  e.respondWith(fetch(r).then(function(res){ if(res && res.ok){ var copy=res.clone(); caches.open(CACHE).then(function(c){ c.put(r,copy); }); } return res; }).catch(function(){
    return caches.match(r).then(function(m){ if(m) return m; if(r.mode==='navigate') return caches.match('./'); return Response.error(); });
  }));
});
