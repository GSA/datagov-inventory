import { useCallback } from 'react'
import { useValidationWorker } from './useValidationWorker'
import { useValidationContext } from './ValidationContext'
import { useCatalogContext } from '../session'

export function useValidation() {
  const { validateObject: validateObjectWorker, validateCatalog: validateCatalogWorker, isReady } = useValidationWorker()
  const {
    validationState,
    catalogSummary,
    validationProgress,
    setValidationState,
    setObjectValidation,
    setCatalogSummary,
    setValidationProgress,
    getObjectState,
    getObjectErrors,
  } = useValidationContext()
  const { open } = useCatalogContext()

  const validateObject = useCallback(
    async (objectId: string) => {
      if (!isReady) {
        throw new Error('Validation worker not ready')
      }

      if (!open) {
        throw new Error('No catalog open')
      }

      const obj = open.catalog.objects.get(objectId)
      if (!obj) {
        throw new Error(`Object not found: ${objectId}`)
      }

      const typeMap = {
        Dataset: 'Dataset',
        Organization: 'Organization',
        'Contact Point': 'ContactPoint',
      } as const

      const objectType = typeMap[obj.dcatClass as keyof typeof typeMap]
      if (!objectType) {
        throw new Error(`Unknown object type: ${obj.dcatClass}`)
      }

      setValidationState('validating')

      try {
        const result = await validateObjectWorker(obj.data, objectType)
        setObjectValidation(objectId, result)
        setValidationState(result.valid ? 'valid' : 'invalid')
        return result
      } catch (error) {
        setValidationState('idle')
        throw error
      }
    },
    [isReady, open, validateObjectWorker, setValidationState, setObjectValidation]
  )

  const validateCatalog = useCallback(
    async (onProgress?: (progress: number) => void) => {
      if (!isReady) {
        throw new Error('Validation worker not ready')
      }

      if (!open) {
        throw new Error('No catalog open')
      }

      const datasets: unknown[] = []
      const publishers: unknown[] = []
      const contactPoints: unknown[] = []

      for (const [id, obj] of open.catalog.objects.entries()) {
        const data = { '@id': id, ...obj.data }
        if (obj.dcatClass === 'Dataset') {
          datasets.push(data)
        } else if (obj.dcatClass === 'Organization') {
          publishers.push(data)
        } else if (obj.dcatClass === 'Contact Point') {
          contactPoints.push(data)
        }
      }

      const catalog = { datasets, publishers, contactPoints }

      setValidationState('validating')

      try {
        const result = await validateCatalogWorker(catalog, (progress) => {
          setValidationProgress(progress)
          onProgress?.(progress)
        })

        for (const objResult of result.objectResults) {
          setObjectValidation(objResult.objectId, {
            valid: objResult.valid,
            errors: objResult.errors,
            timestamp: objResult.timestamp,
            schemaVersion: objResult.schemaVersion,
          })
        }

        setCatalogSummary({
          valid: result.valid,
          totalErrors: result.totalErrors,
          errorSummary: result.errorSummary,
          timestamp: result.timestamp,
          schemaVersion: result.schemaVersion,
        })

        setValidationState(result.valid ? 'valid' : 'invalid')
        return result
      } catch (error) {
        setValidationState('idle')
        throw error
      }
    },
    [
      isReady,
      open,
      validateCatalogWorker,
      setValidationState,
      setObjectValidation,
      setCatalogSummary,
      setValidationProgress,
    ]
  )

  return {
    validateObject,
    validateCatalog,
    getObjectState,
    getObjectErrors,
    isReady,
    validationState,
    catalogSummary,
    validationProgress,
  }
}
