// Bumped to v4 to force an update!
const CACHE_NAME = 'unical-market-v4';
const OFFLINE_URL = '/offline.html';

// We removed the external CDN links from here. 
// Now it ONLY downloads your guaranteed local files so the installation never fails.
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/asset/style.css',
    '/asset/script.js',
    '/asset/img/192.png',
    OFFLINE_URL
];

// 1. INSTALL EVENT
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Downloading core assets and offline game...');
            return cache.addAll(URLS_TO_CACHE);
        }).catch((error) => {
            console.error('Cache install failed:', error);
        })
    );
    self.skipWaiting();
});

// 2. ACTIVATE EVENT (Clears out v1, v2, v3)
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

// 3. FETCH EVENT
self.addEventListener('fetch', (event) => {
    // Ignore API requests to Supabase (we want those to be fresh)
    if (event.request.url.includes('supabase.co')) {
        return; 
    }

    // STRATEGY A: For HTML Pages (If they are offline, show the game!)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Network failed! Serve the offline game from cache.
                return caches.match(OFFLINE_URL);
            })
        );
        return; 
    }

    // STRATEGY B: For CSS, JS, Images, and CDN links (Stale-While-Revalidate)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                console.log("Network request failed, serving from cache if available.");
            });

            return cachedResponse || fetchPromise;
        })
    );
});