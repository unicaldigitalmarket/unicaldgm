// Version 5: The Bulletproof Failsafe
const CACHE_NAME = 'unical-market-v5';
const OFFLINE_URL = 'offline.html';

// 1. INSTALL EVENT - ONLY cache the offline page to guarantee 100% success.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Failsafe engaged: Caching offline page independently.');
            // Using a new Request with 'reload' forces the browser to get the freshest copy
            return cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
        })
    );
    self.skipWaiting();
});

// 2. ACTIVATE EVENT - Clean out all the old, broken caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 3. FETCH EVENT - The Smart Interceptor
self.addEventListener('fetch', (event) => {
    // Ignore API requests and non-GET requests
    if (event.request.method !== 'GET' || event.request.url.includes('supabase.co')) {
        return; 
    }

    // STRATEGY A: For HTML Pages (If offline, show the game!)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                console.log('Network failed, serving offline page.');
                return caches.match(OFFLINE_URL);
            })
        );
        return; 
    }

    // STRATEGY B: For all other files, load from network, but save a copy for later
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request).then((response) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, response.clone());
                    return response;
                });
            }).catch(() => {
                // Silently fail for assets if offline
            });
        })
    );
});