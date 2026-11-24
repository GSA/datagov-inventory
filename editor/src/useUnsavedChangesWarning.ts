import { useEffect, type RefObject } from 'react'

/** Asks the browser to confirm a document unload while the latest catalog edit is not durable. */
export function useUnsavedChangesWarning(hasUnsavedChangesRef: RefObject<boolean>) {
  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      // The effect tracks the stable ref object; the listener reads its latest value at unload time.
      if (!hasUnsavedChangesRef.current) return
      event.preventDefault()
      // Required by older browsers; modern browsers show their own generic message.
      event.returnValue = true
    }

    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [hasUnsavedChangesRef])
}
