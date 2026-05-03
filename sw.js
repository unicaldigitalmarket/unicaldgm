// We bumped the version to v2 so the phone knows to download the new update
const CACHE_NAME = 'unical-market-v3';
const OFFLINE_URL = 'offline.html';

// List all the core static files your app needs, PLUS the new offline page
const URLS_TO_CACHE = [
    './',
    './index.html',
    './asset/style.css',
    './asset/script.js',
    './asset/img/192.png',
    OFFLINE_URL, // <-- The offline game is now cached here
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// 1. INSTALL EVENT - Caches the core assets and offline page
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache, saving core assets and offline page');
                return cache.addAll(URLS_TO_CACHE);
            })
    );
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

// 2. ACTIVATE EVENT - Cleans up old caches (like v1)
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

// 3. FETCH EVENT - The Brains of the Operation
self.addEventListener('fetch', (event) => {
    // Ignore API requests to Supabase (we want those to be fresh)
    if (event.request.url.includes('supabase.co')) {
        return; 
    }

    // STRATEGY A: For HTML Pages (If they click a link and are offline, show the game!)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Network failed! Serve the offline game.
                return caches.match(OFFLINE_URL);
            })
        );
        return; // Stop here for HTML pages
    }

    // STRATEGY B: For CSS, JS, and Images (Stale-While-Revalidate)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Only update the cache if it's a valid response and a local asset
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // If offline, just fail gracefully (the cached UI will still show)
                console.log("Network request failed for asset, serving from cache.");
            });

            // Return the cached response immediately if we have it, otherwise wait for the network
            return cachedResponse || fetchPromise;
        })
    );
});