import { useEffect, useRef, useState, useCallback } from 'react'
import type { CatalogGraph } from '../catalog/types'
import type { CatalogValidationResult } from './types'

interface WorkerMessage {
  id: string
  type: 'validateCatalog'
  payload: CatalogGraph
}

interface WorkerResponse {
  id: string
  type: 'ready' | 'result' | 'error'
  payload?: unknown
}

export function useValidationWorker() {
  const workerRef = useRef<Worker | null>(null)
  const [isReady, setIsReady] = useState(false)
  const pendingRequests = useRef<
    Map<
      string,
      {
        resolve: (value: unknown) => void
        reject: (error: Error) => void
      }
    >
  >(new Map())

  useEffect(() => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })

    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const { id, type, payload } = event.data

      if (type === 'ready') {
        setIsReady(true)
        return
      }

      const pending = pendingRequests.current.get(id)
      if (!pending) return

      switch (type) {
        case 'result':
          pending.resolve(payload)
          pendingRequests.current.delete(id)
          break
        case 'error':
          pending.reject(new Error((payload as { message: string }).message))
          pendingRequests.current.delete(id)
          break
      }
    })

    workerRef.current = worker

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const validateCatalog = useCallback(
    (catalog: CatalogGraph): Promise<CatalogValidationResult> => {
      return new Promise<CatalogValidationResult>((resolve, reject) => {
        if (!workerRef.current || !isReady) {
          reject(new Error('Worker not ready'))
          return
        }

        const id = `${Date.now()}-${Math.random()}`
        pendingRequests.current.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
        })

        workerRef.current.postMessage({ id, type: 'validateCatalog', payload: catalog } as WorkerMessage)
      })
    },
    [isReady]
  )

  return {
    isReady,
    validateCatalog,
  }
}
