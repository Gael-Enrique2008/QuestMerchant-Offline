import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"
import { Readable } from "node:stream"
import { buildSchema, graphql } from "graphql"
import { typeDefs } from "../../back/src/graphql/schema.js"

const root = resolve("dist")
const schema = buildSchema(typeDefs)
const {default: render} = await import("../.netlify/v1/functions/ssr/ssr.mjs")
const sql = await readFile(new URL("../../back/db.sql", import.meta.url), "utf8")
const categories = [...sql.matchAll(/^\((\d+), '([^']+)', TRUE\)[,\r ]*$/gm)]
  .map(([, id, nombre]) => ({id, nombre, activo: true}))
const products = [...sql.matchAll(/^\((\d+), '([^']+)', '([^']+)', ([\d.]+), '(\/images\/[^']+)', (\d+), TRUE, (\d+)\)[,\r ]*$/gm)]
  .map(([, id, nombre, descripcion, precio, imagen, stock, categoryId]) => {
    const categoria = categories.find((item) => item.id === categoryId)
    return {id, nombre, descripcion, precio: Number(precio), imagen, stock: Number(stock),
      activo: true, esFavorito: false, categoria, categorias: [categoria]}
  })

const rootValue = {
  categorias: categories,
  producto: ({id}) => products.find((item) => item.id === id) || null,
  productos: ({busqueda, categoriaId}) => products.filter((item) =>
    (!categoriaId || item.categoria.id === categoriaId) &&
    (!busqueda || item.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  )
}

const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon"
}

const port = Number(process.env.PORT) || 4321
createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, "http://localhost:" + port)
    if (url.pathname === "/graphql" && incoming.method === "POST") {
      const payload = await new Response(Readable.toWeb(incoming)).json()
      const result = await graphql({
        schema, rootValue, source: payload.query,
        variableValues: payload.variables, operationName: payload.operationName
      })
      outgoing.writeHead(200, {"Content-Type": "application/json"})
      outgoing.end(JSON.stringify(result))
      return
    }

    const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname)
    const file = resolve(root, "." + pathname)
    const mime = types[extname(file)]
    if (file.startsWith(root + sep) && mime) {
      const bytes = await readFile(file).catch(() => null)
      if (bytes) {
        outgoing.writeHead(200, {"Content-Type": mime})
        outgoing.end(bytes)
        return
      }
    }

    const response = await render(new Request(url, {headers: incoming.headers}), {
      ip: "127.0.0.1"
    })
    outgoing.writeHead(response.status, Object.fromEntries(response.headers))
    if (response.body) Readable.fromWeb(response.body).pipe(outgoing)
    else outgoing.end()
  } catch (error) {
    console.error(error)
    if (!outgoing.headersSent) outgoing.writeHead(500)
    outgoing.end("Error en la vista previa local")
  }
}).listen(port, "localhost", () => {
  console.log(`Quest Merchant · vista previa con catálogo de prueba · http://localhost:${port}`)
})
