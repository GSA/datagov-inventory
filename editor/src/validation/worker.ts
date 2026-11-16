import { createValidator, validateObject, validateCatalog } from './validator'

let validator: ReturnType<typeof createValidator> | null = null

interface WorkerMessage {
  id: string
  type: 'init' | 'validateObject' | 'validateCatalog'
  payload?: unknown
}

interface WorkerResponse {
  id?: string
  type: 'ready' | 'result' | 'progress' | 'error' | 'init'
  payload?: unknown
}

async function initialize() {
  try {
    const response = await fetch('/schema/dcat-us-document.schema.json')
    if (!response.ok) {
      throw new Error(`Failed to load schema: ${response.statusText}`)
    }
    const schema = await response.json()
    validator = createValidator(schema)
    self.postMessage({ type: 'ready' } as WorkerResponse)
  } catch {
    self.postMessage({
      type: 'error',
      payload: { message: 'Failed to initialize validator' },
    } as WorkerResponse)
  }
}

self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data

  if (type === 'init') {
    await initialize()
    return
  }

  if (!validator) {
    self.postMessage({
      id,
      type: 'error',
      payload: { message: 'Validator not initialized' },
    } as WorkerResponse)
    return
  }

  try {
    switch (type) {
      case 'validateObject': {
        const { obj, objectType } = payload as { obj: unknown; objectType: string }
        const result = validateObject(validator, obj, objectType as 'Dataset' | 'Organization' | 'ContactPoint')
        self.postMessage({ id, type: 'result', payload: result } as WorkerResponse)
        break
      }

      case 'validateCatalog': {
        const catalog = payload as {
          datasets: unknown[]
          publishers: unknown[]
          contactPoints: unknown[]
        }

        const totalObjects = catalog.datasets.length + catalog.publishers.length + catalog.contactPoints.length

        let processed = 0

        const reportProgress = () => {
          const progress = Math.round((processed / totalObjects) * 100)
          self.postMessage({ id, type: 'progress', payload: { progress } } as WorkerResponse)
        }

        const result = validateCatalog(validator, catalog)

        processed = totalObjects
        reportProgress()

        self.postMessage({ id, type: 'result', payload: result } as WorkerResponse)
        break
      }
    }
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      payload: { message: error instanceof Error ? error.message : 'Validation failed' },
    } as WorkerResponse)
  }
})

self.postMessage({ type: 'init' } as WorkerResponse)
