import { useEffect, useRef, useState } from 'react'

/**
 * `on`, but only once it has stayed on for `delay` ms, and then for at least `minimum` ms: a busy state that does not
 * flash on a fast run, and does not blink when a slow run ends just after it shows.
 */
export function useDelayedFlag(on: boolean, delay: number, minimum: number) {
  const [shown, setShown] = useState(false)
  const shownAt = useRef(0)

  useEffect(() => {
    if (on === shown) return
    const wait = on ? delay : Math.max(0, shownAt.current + minimum - Date.now())
    const timer = setTimeout(() => {
      if (on) shownAt.current = Date.now()
      setShown(on)
    }, wait)
    return () => clearTimeout(timer)
  }, [on, shown, delay, minimum])

  return shown
}
