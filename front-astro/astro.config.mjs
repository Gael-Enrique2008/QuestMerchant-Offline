// @ts-check
import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import netlify from "@astrojs/netlify"
import tailwindcss from "@tailwindcss/vite"
import { AstroPWAIntegration } from "@vite-pwa/astro"

export default defineConfig({
  output: "server",
  integrations: [
    react(),
    AstroPWAIntegration({
      manifest: {
        id: "/",
        name: "Quest Merchant",
        short_name: "Quest",
        lang: "es-MX",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#30435f", // --text
        background_color: "#e9f0f9", // --bg
        icons: [
          { src: "/icons/quest-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/quest-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/quest-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      strategies: "build-sw",
      filename: "sw.js",
      injectRegister: false,
      buildSW: {
        swSrc: "src/sw.js",
        globPatterns: ["index.html", "offline.html", "_astro/**/*.{css,js,woff2}", "icons/*.png", "favicon.{svg,ico}"],
        manifestTransforms: [async (entries) => ({
          manifest: entries.map((entry) => entry.url === "index.html" ? { ...entry, url: "/" } : entry),
          warnings: []
        })]
      }
    })
  ],
  adapter: netlify({
    devFeatures: {
      environmentVariables: false,
      images: true,
      edgeFunctions: false
    }
  }),
  vite: { plugins: [tailwindcss()] }
})
