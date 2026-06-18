const CACHE_VERSION = 'nuoperator-pwa-v1'
const CORE_CACHE = `${CACHE_VERSION}-core`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`

const coreAssetUrls = [
  './',
  './manifest.webmanifest',
  './favicon.svg',
  './pwa-icons/icon-192.png',
  './pwa-icons/icon-512.png',
  './pwa-icons/maskable-192.png',
  './pwa-icons/maskable-512.png',
  './pwa-icons/apple-touch-icon.png',
].map((assetPath) => new URL(assetPath, self.registration.scope).toString())

async function cacheCoreAssets() {
  const cache = await caches.open(CORE_CACHE)

  await Promise.all(
    coreAssetUrls.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' })

        if (response.ok) {
          await cache.put(url, response)
        }
      } catch {
        // The app should still install its service worker if a non-critical asset is unreachable.
      }
    }),
  )
}

async function deleteOldCaches() {
  const keys = await caches.keys()
  await Promise.all(
    keys
      .filter((key) => key !== CORE_CACHE && key !== RUNTIME_CACHE)
      .map((key) => caches.delete(key)),
  )
}

function isSameOrigin(url) {
  return url.origin === self.location.origin
}

function isStaticAssetRequest(request, url) {
  return (
    ['font', 'image', 'script', 'style', 'worker'].includes(request.destination) ||
    /\.(?:css|js|mjs|png|jpg|jpeg|svg|webp|ico|woff2?|ttf|webmanifest|docx)$/i.test(url.pathname)
  )
}

async function networkFirstNavigation(request) {
  const appShellUrl = new URL('./', self.registration.scope).toString()

  try {
    const response = await fetch(request)

    if (response.ok) {
      const cache = await caches.open(CORE_CACHE)
      await cache.put(appShellUrl, response.clone())
    }

    return response
  } catch {
    return (await caches.match(request)) || (await caches.match(appShellUrl)) || Response.error()
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request)

  const networkResponse = fetch(request)
    .then((response) => {
      if (response.ok) {
        void cache.put(request, response.clone())
      }

      return response
    })
    .catch(() => cached)

  return cached || networkResponse
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheCoreAssets().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(deleteOldCaches().then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const url = new URL(event.request.url)

  if (!isSameOrigin(url)) {
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(event.request))
    return
  }

  if (isStaticAssetRequest(event.request, url)) {
    event.respondWith(staleWhileRevalidate(event.request))
  }
})
