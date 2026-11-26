import { publicCatalogOperation } from "./lib/offlineCatalog"

const manifest = self.__WB_MANIFEST
const prefix = "quest-offline-"
const entries = manifest.map(({ url, revision }) => [
  new URL(url, self.location.origin).href,
  revision
]).sort(([a], [b]) => a.localeCompare(b))
const shellUrls = new Map(entries)
const dataCache = prefix + "catalogo-v1"
const fallbackUrl = "/offline.html"
const graphqlUrl = new URL(
  import.meta.env.PUBLIC_GRAPHQL_URL?.trim() || "http://localhost:4000/",
  self.location.origin
).href

async function releaseId() {
  // La revisión del HTML y los hashes de los chunks identifican la compilación.
  const bytes = new TextEncoder().encode(JSON.stringify(entries))
  const hash = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(hash).slice(0, 8), (n) => n.toString(16).padStart(2, "0")).join("")
}

const release = releaseId()
const shellName = release.then((id) => prefix + "shell-" + id)
const pagesName = release.then((id) => prefix + "paginas-" + id)

// Espera un precache completo antes de activar la nueva versión.
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(await shellName)
    await cache.addAll(Array.from(shellUrls.keys(), (url) => new Request(url, { cache: "reload" })))
    await self.skipWaiting()
  })())
})

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const active = new Set([await shellName, await pagesName, dataCache])
    await self.clients.claim()
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && !active.has(name)) await caches.delete(name)
    }
  })())
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  const url = new URL(request.url)
  const ownOrigin = url.origin === self.location.origin

  if (request.method === "POST" && url.href === graphqlUrl) {
    event.respondWith(catalogNetworkFirst(request))
    return
  }

  if (request.method !== "GET") return

  if (ownOrigin && request.mode === "navigate") {
    event.respondWith(pageNetworkFirst(request, url))
    return
  }

  const localAsset = ownOrigin && (
    shellUrls.has(url.href) ||
    url.pathname.startsWith("/_astro/") ||
    url.pathname.startsWith("/images/")
  )
  const productImage = request.destination === "image" &&
    (url.origin === "https://res.cloudinary.com" ||
      (url.origin === new URL(graphqlUrl).origin && url.pathname.startsWith("/uploads/")))

  if (localAsset || productImage) event.respondWith(assetCacheFirst(request))
})

async function remember(cache, key, response) {
  try {
    await cache.put(key, response)
  } catch (error) {
    console.warn("No se pudo actualizar el caché de Quest Merchant.", error)
  }
}

async function pageNetworkFirst(request, url) {
  const publicPage = url.pathname === "/" || /^\/producto\/[^/]+\/?$/.test(url.pathname)
  const cache = await caches.open(await pagesName)
  const key = url.origin + (url.pathname.replace(/\/$/, "") || "/")

  try {
    const response = await fetch(request, { cache: "no-store" })
    if (response.status >= 500) throw new Error("Servidor no disponible")
    if (publicPage && response.ok && !response.redirected &&
      response.headers.get("content-type")?.includes("text/html")) {
      await remember(cache, key, response.clone())
    } else if (publicPage && (response.status === 404 || response.status === 410)) {
      await cache.delete(key)
    }
    return response
  } catch {
    const shell = await caches.open(await shellName)
    if (publicPage) {
      const saved = await cache.match(key)
      if (saved) return saved
      if (url.pathname === "/") {
        const home = await shell.match("/")
        if (home) return home
      }
    }
    return (await shell.match(fallbackUrl)) || Response.error()
  }
}

async function assetCacheFirst(request) {
  const cache = await caches.open(await shellName)
  const saved = await cache.match(request)
  if (saved) return saved

  const response = await fetch(request)
  if (response.ok || response.type === "opaque") {
    await remember(cache, request, response.clone())
  }
  return response
}

async function catalogNetworkFirst(request) {
  const body = await request.clone().json().catch(() => null)
  if (!publicCatalogOperation(body)) return fetch(request)

  const variables = body.variables || {}
  const args = body.operationName === "Catalogo"
    ? [variables.busqueda ?? null, variables.categoriaId ?? null]
    : body.operationName === "Producto" ? [String(variables.id)] : []
  const key = new URL("/__quest_cache__/graphql", self.location.origin)
  key.searchParams.set("endpoint", graphqlUrl)
  key.searchParams.set("operation", body.operationName)
  key.searchParams.set("variables", JSON.stringify(args))
  const cache = await caches.open(dataCache)

  try {
    const response = await fetch(request, { cache: "no-store" })
    if (response.status >= 500) throw new Error("GraphQL no disponible")
    if (response.ok) {
      const result = await response.clone().json().catch(() => null)
      if (result?.data && !result.errors?.length) {
        // Los campos de estas consultas son públicos salvo esFavorito.
        const json = JSON.stringify({ data: result.data }, (name, value) =>
          name === "esFavorito" ? false : value
        )
        await remember(cache, key.href, new Response(json, {
          headers: { "Content-Type": "application/json", "X-Quest-Offline": "cache" }
        }))
      }
    }
    return response
  } catch {
    return (await cache.match(key.href)) || new Response(JSON.stringify({
      errors: [{ message: "Esta consulta no está guardada. Conéctate a Internet y vuelve a intentarlo." }]
    }), {
      headers: { "Content-Type": "application/json" }
    })
  }
}
