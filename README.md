# Quest Merchant · Unidad 3.3

**Gael Enrique Medina Martínez · Matrícula 23300663**

La tienda permite volver al catálogo y abrir las fichas visitadas con la última información guardada en el navegador. La primera visita y las operaciones de cuenta, pedidos y pagos requieren conexión.

## Prueba local reproducible

Requiere Node.js 22.14 o posterior, npm y Chrome o Chromium. Desde la carpeta del proyecto:

```powershell
cd front-astro
npm ci
$env:PUBLIC_GRAPHQL_URL="/graphql"
npm run build
npm run preview:offline
```

En Bash, sustituye la línea de PowerShell por `export PUBLIC_GRAPHQL_URL=/graphql`. Abre `http://localhost:4321`. La vista previa sirve la compilación de Astro con el adaptador de Netlify y responde las consultas públicas con los productos de ejemplo de `back/db.sql`. Ese modo de prueba funciona sin PostgreSQL y sin credenciales. Usa una pestaña de incógnito o borra los datos de ese origen para repetir la instalación desde cero.

1. Con conexión, espera a que aparezca el catálogo. En **DevTools → Application → Service Workers**, verifica que `sw.js` aparezca como activado y que **Bypass for network** esté desmarcado.
2. Abre la ficha **Manual del Jugador** (`/producto/1`). Espera a que aparezcan el precio, la existencia y la imagen. Deja la ficha `/producto/2` sin visitar.
3. Abre **DevTools → Network**, activa **Disable cache** y elige **Offline**. Recarga normalmente con Ctrl+R. La ficha debe seguir visible con el aviso de conexión.
4. Vuelve al catálogo. Deben aparecer los productos guardados. Si eliges un filtro que no consultaste con red, verás un mensaje que explica que la consulta aún no está guardada.
5. Abre `http://localhost:4321/producto/2` sin reconectar. Aparece `offline.html` y el enlace **Volver al catálogo** te lleva al contenido guardado.
6. Cambia **Offline** por **No throttling** y recarga `/producto/2`. La ficha debe obtener sus datos desde la red.

## Ejecutar con el backend de la tienda

1. Crea una base PostgreSQL e importa `back/db.sql`. En `back/.env`, configura `DATABASE_URL` o las variables `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. Define `JWT_SECRET` para autenticación. Las integraciones de correo, pagos e imágenes requieren sus propias variables cuando se usan.
2. En `back/`, ejecuta `npm ci` y `npm start`. El servidor local escucha en el puerto 4000 de forma predeterminada.
3. Para desarrollo de la interfaz, ejecuta `npm ci` y `npm run dev` desde `front-astro/`. Para probar el Service Worker usa la compilación y la vista previa anteriores, o despliega el frontend con Netlify y configura `PUBLIC_GRAPHQL_URL` con la URL HTTPS del GraphQL real antes de compilar. Sirve el frontend en HTTPS en producción.
4. Si el frontend ya estaba abierto en localhost con un Service Worker de una compilación anterior, usa otro puerto o elimina ese registro antes de iniciar el servidor de desarrollo.

## Implementación

| Recurso | Estrategia | Comportamiento |
|---|---|---|
| HTML inicial, JS, CSS, fuentes locales, iconos y manifiesto | Precache | Vite PWA genera un inventario revisado e instala los archivos al registrar `/sw.js`. |
| Imágenes de productos y recursos de compilación | Cache-first | El Service Worker busca primero en Cache Storage y obtiene el recurso de la red si todavía no existe. |
| Inicio y fichas `/producto/:id` | Network-first | Intenta obtener HTML actualizado. Una ficha visitada puede usar su HTML guardado y una página sin copia recibe `offline.html`. |
| `Catalogo`, `Producto` y `Categorias` | Network-first | El Service Worker reconoce los documentos de consulta pública. Usa claves separadas por operación, variables y URL de GraphQL. El respaldo de datos no conserva el favorito del usuario. |
| Pedidos, autenticación, pagos y otras operaciones privadas | Red | Los datos privados y las mutaciones pasan al backend. La vista offline se limita a consultas del catálogo. |

`src/sw.js` contiene los eventos `install`, `activate` y `fetch`. `src/lib/registerOfflineWorker.js` registra el worker de producción y, durante la primera visita, espera brevemente a que controle la página antes de solicitar el catálogo. `public/offline.html` ofrece un respaldo autónomo.

El worker ejecuta `skipWaiting()` solo después de completar el precache. En `activate`, ejecuta `clients.claim()` y elimina los cachés antiguos de documentos y recursos de Quest Merchant. El caché versionado de consultas públicas se conserva entre compilaciones compatibles. Tras una actualización que cambia los recursos del sitio, vuelve a visitar las fichas con conexión para guardar sus documentos con los archivos de la nueva versión.
