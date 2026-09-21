import { useEffect, useState } from "react"
import { Button } from "@/components/ui/Button"

export function PwaUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    let isMounted = true
    let currentRegistration: ServiceWorkerRegistration | null = null
    let installingWorker: ServiceWorker | null = null

    const handleStateChange = () => {
      if (installingWorker?.state === "installed" && navigator.serviceWorker.controller) {
        setWaitingWorker(installingWorker)
      }
    }

    const handleUpdateFound = () => {
      if (installingWorker) {
        installingWorker.removeEventListener?.("statechange", handleStateChange)
      }
      const newWorker = currentRegistration?.installing ?? null
      if (!newWorker) return
      installingWorker = newWorker
      installingWorker.addEventListener("statechange", handleStateChange)
    }

    let refreshing = false
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    }

    void navigator.serviceWorker.ready.then((registration) => {
      if (!isMounted) return
      currentRegistration = registration
      registration.addEventListener("updatefound", handleUpdateFound)
      if (registration.installing) {
        installingWorker = registration.installing
        installingWorker.addEventListener("statechange", handleStateChange)
      }
    })

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)

    return () => {
      isMounted = false
      navigator.serviceWorker?.removeEventListener?.("controllerchange", handleControllerChange)
      if (currentRegistration) {
        currentRegistration.removeEventListener?.("updatefound", handleUpdateFound)
      }
      if (installingWorker) {
        installingWorker.removeEventListener?.("statechange", handleStateChange)
      }
    }
  }, [])

  if (!waitingWorker) return null

  function applyUpdate() {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" })
  }

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
    >
      <p className="text-sm font-medium">A new version is available.</p>
      <Button size="sm" onClick={applyUpdate}>
        Update
      </Button>
    </div>
  )
}
