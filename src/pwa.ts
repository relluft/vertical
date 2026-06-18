const isLocalhost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'

const getPublicBase = () => {
  const base = import.meta.env.BASE_URL || '/'

  return base.endsWith('/') ? base : `${base}/`
}

const resolvePublicUrl = (assetPath: string) => {
  const normalizedPath = assetPath.replace(/^\/+/, '')
  const base = getPublicBase()

  if (base.startsWith('/')) {
    return `${base}${normalizedPath}`
  }

  return new URL(`${base}${normalizedPath}`, window.location.href).toString()
}

export function getPublicAssetUrl(assetPath: string) {
  return resolvePublicUrl(assetPath)
}

export function registerPwa() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    return
  }

  const canRegister =
    window.location.protocol === 'https:' || isLocalhost(window.location.hostname)

  if (!canRegister) {
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(resolvePublicUrl('sw.js'), { scope: getPublicBase() })
      .then((registration) => {
        void registration.update()
      })
      .catch((error: unknown) => {
        console.warn('PWA service worker registration failed.', error)
      })
  })
}
