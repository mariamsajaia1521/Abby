// Retire the old cache-first application worker without touching personal data.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('petlog-cache-')).map(name => caches.delete(name)));
    const scope = self.registration.scope;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await self.registration.unregister();
    await Promise.all(windows.filter(client => client.url.startsWith(scope)).map(client => client.navigate(client.url)));
  })());
});
