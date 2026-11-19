import { useCallback } from 'react'
import { useValidationWorker } from './useValidationWorker'
import { useValidationContext } from './ValidationContext'
import { useCatalog } from '../session'

export function useValidation() {
  const { validateCatalog: validateCatalogWorker, isReady } = useValidationWorker()
  const {
    validationState,
    catalogSummary,
    validationProgress,
    setValidationState,
    setObjectValidation,
    setObjectValidationResults,
    setCatalogSummary,
    setValidationProgress,
    getObjectState,
    getObjectErrors,
  } = useValidationContext()
  const { open } = useCatalog()

  const runValidation = useCallback(
    async (onProgress?: (progress: number) => void) => {
      if (!isReady) {
        throw new Error('Validation worker not ready')
      }

      if (!open) {
        throw new Error('No catalog open')
      }

      setValidationState('validating')

      try {
        return await validateCatalogWorker(open.catalog, onProgress)
      } catch (error) {
        setValidationState('idle')
        throw error
      }
    },
    [isReady, open, validateCatalogWorker, setValidationState]
  )

  const validateObject = useCallback(
    async (objectId: string) => {
      if (!open?.catalog.objects.has(objectId)) {
        throw new Error(`Object not found: ${objectId}`)
      }

      const { objectResults } = await runValidation()
      const result = objectResults.find((r) => r.objectId === objectId)!
      setObjectValidation(objectId, result)
      setValidationState(result.valid ? 'valid' : 'invalid')
      return result
    },
    [open, runValidation, setObjectValidation, setValidationState]
  )

  const validateCatalog = useCallback(
    async (onProgress?: (progress: number) => void) => {
      const result = await runValidation((progress) => {
        setValidationProgress(progress)
        onProgress?.(progress)
      })

      setObjectValidationResults(result.objectResults)

      setCatalogSummary({
        valid: result.valid,
        totalErrors: result.totalErrors,
        errorSummary: result.errorSummary,
        timestamp: result.timestamp,
        schemaVersion: result.schemaVersion,
      })

      setValidationState(result.valid ? 'valid' : 'invalid')
      return result
    },
    [runValidation, setObjectValidationResults, setCatalogSummary, setValidationProgress, setValidationState]
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
