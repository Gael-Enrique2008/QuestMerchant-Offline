let registration
let firstControl

export function registerOfflineWorker() {
  if (import.meta.env.DEV || typeof navigator === "undefined" || !navigator.serviceWorker) {
    return
  }

  registration ??= navigator.serviceWorker.register("/sw.js", {
    updateViaCache: "none"
  }).catch((error) => {
    console.warn("No se pudo registrar el modo sin conexión.", error)
  })

  return registration
}

export function waitForOfflineWorker() {
  const pending = registerOfflineWorker()
  if (!pending || navigator.serviceWorker.controller) return

  firstControl ??= new Promise((resolve) => {
    const timer = setTimeout(finish, 2500)
    function finish() {
      clearTimeout(timer)
      navigator.serviceWorker.removeEventListener("controllerchange", finish)
      resolve()
    }

    navigator.serviceWorker.addEventListener("controllerchange", finish, { once: true })
    pending.then((result) => {
      if (!result || navigator.serviceWorker.controller) finish()
    })
  })

  return firstControl
}
