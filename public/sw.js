const CACHE_NAME = 'justrack-v1.0.0';
const STATIC_CACHE = 'justrack-static-v1.0.0';
const DATA_CACHE = 'justrack-data-v1.0.0';

// Files to cache for offline access
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/justrack-logo.png',
  '/models/face_landmark_68_model-weights_manifest.json',
  '/models/face_recognition_model-weights_manifest.json',
  '/models/tiny_face_detector_model-weights_manifest.json'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline page');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== STATIC_CACHE && key !== DATA_CACHE) {
          console.log('[ServiceWorker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  console.log('[ServiceWorker] Fetch', event.request.url);
  
  // Handle API requests differently
  if (event.request.url.includes('/rest/v1/') || event.request.url.includes('/functions/v1/')) {
    event.respondWith(
      caches.open(DATA_CACHE).then((cache) => {
        return fetch(event.request)
          .then((response) => {
            // If the request was successful, clone the response and store it in the cache
            if (response.status === 200) {
              cache.put(event.request.url, response.clone());
            }
            return response;
          })
          .catch(() => {
            // If the network request failed, try to get it from the cache
            return cache.match(event.request);
          });
      })
    );
    return;
  }

  // Handle static files
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Background sync for attendance events
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync', event.tag);
  
  if (event.tag === 'attendance-sync') {
    event.waitUntil(syncAttendanceData());
  }
});

// Function to sync queued attendance data
async function syncAttendanceData() {
  try {
    const cache = await caches.open(DATA_CACHE);
    const requests = await cache.keys();
    
    for (const request of requests) {
      if (request.url.includes('attendance') && request.method === 'POST') {
        try {
          await fetch(request);
          await cache.delete(request);
          console.log('[ServiceWorker] Synced attendance data');
        } catch (error) {
          console.error('[ServiceWorker] Failed to sync attendance data:', error);
        }
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
  }
}

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push Received.');
  
  const options = {
    body: event.data ? event.data.text() : 'New attendance notification',
    icon: '/justrack-icon-192.png',
    badge: '/justrack-icon-72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '2'
    },
    actions: [
      {
        action: 'explore',
        title: 'View Details',
        icon: '/justrack-icon-72.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/justrack-icon-72.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('JusTrack', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click Received.');

  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});