import { Q_CATALOGO, Q_CATEGORIAS, Q_PRODUCTO } from "./queries"

// Apollo agrega __typename. Las tres consultas públicas son documentos fijos.
function normalizeDocument(source) {
  return source.replace(/\b__typename\b/g, "").replace(/[\s,]/g, "")
}

const publicDocuments = new Map([
  ["Catalogo", normalizeDocument(Q_CATALOGO)],
  ["Categorias", normalizeDocument(Q_CATEGORIAS)],
  ["Producto", normalizeDocument(Q_PRODUCTO)]
])

export function publicCatalogOperation(body) {
  return typeof body?.query === "string" &&
    publicDocuments.get(body.operationName) === normalizeDocument(body.query)
}
