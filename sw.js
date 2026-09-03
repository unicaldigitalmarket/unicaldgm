// Version 6: Network-First for dynamic updates
const CACHE_NAME = 'unical-market-v1.0.2'; // BUMPED VERSION TO CLEAR OLD CACHE
const OFFLINE_URL = '/offline.html';

// 1. INSTALL EVENT - Cache the offline page
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching offline page independently.');
            return cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
        })
    );
    self.skipWaiting();
});

// 2. ACTIVATE EVENT - Clean out old caches (this will delete v1.0.1)
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

    // STRATEGY A: For HTML Pages (Network first, fallback to offline.html)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                console.log('Network failed, serving offline page.');
                return caches.match(OFFLINE_URL);
            })
        );
        return; 
    }

    // STRATEGY B: Network First, falling back to cache (Perfect for active development)
    event.respondWith(
        fetch(event.request).then((response) => {
            // Network succeeded! Save a fresh copy to the cache for later
            return caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response.clone());
                return response;
            });
        }).catch(() => {
            // Network failed! Look for a backup in the cache
            return caches.match(event.request);
        })
    );
});