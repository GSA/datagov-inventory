import type { DecomposedCatalog } from '../catalog/decompose'
import { validateCatalog } from './validator'

interface WorkerMessage {
  id: string
  type: 'validateCatalog'
  payload: DecomposedCatalog
}

interface WorkerResponse {
  id?: string
  type: 'ready' | 'result' | 'progress' | 'error'
  payload?: unknown
}

self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { id, payload } = event.data

  try {
    const result = validateCatalog(payload)
    self.postMessage({ id, type: 'progress', payload: { progress: 100 } } as WorkerResponse)
    self.postMessage({ id, type: 'result', payload: result } as WorkerResponse)
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      payload: { message: error instanceof Error ? error.message : 'Validation failed' },
    } as WorkerResponse)
  }
})

self.postMessage({ type: 'ready' } as WorkerResponse)
