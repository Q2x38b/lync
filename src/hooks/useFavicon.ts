import { useEffect } from 'react'

export function useFavicon(isActive: boolean) {
  useEffect(() => {
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
    if (link) {
      link.href = isActive ? '/favicon-active.svg' : '/favicon.svg'
    }

    // Reset to default favicon on unmount
    return () => {
      if (link) {
        link.href = '/favicon.svg'
      }
    }
  }, [isActive])
}
