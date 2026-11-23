import { useCallback } from 'react'
import { useValidationWorker } from './useValidationWorker'
import { useValidationContext } from './ValidationContext'
import { useCatalog } from '../session'

export function useValidation() {
  const { validateCatalog: validateCatalogWorker, isReady } = useValidationWorker()
  const {
    validationState,
    catalogSummary,
    setValidationState,
    setObjectValidation,
    setObjectValidationResults,
    setCatalogSummary,
    getObjectState,
    getObjectErrors,
  } = useValidationContext()
  const { open } = useCatalog()

  const runValidation = useCallback(
    async () => {
      if (!isReady) {
        throw new Error('Validation worker not ready')
      }

      if (!open) {
        throw new Error('No catalog open')
      }

      setValidationState('validating')

      try {
        return await validateCatalogWorker(open.catalog)
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
    async () => {
      const catalog = open?.catalog
      const result = await runValidation()

      setObjectValidationResults(result.objectResults)

      setCatalogSummary({
        valid: result.valid,
        totalErrors: result.totalErrors,
        errorSummary: result.errorSummary,
        timestamp: result.timestamp,
        schemaVersion: result.schemaVersion,
        catalogId: open!.id,
        catalog: catalog!,
        objectsWithErrors: result.objectResults
          .filter((r) => !r.valid)
          .map((r) => ({ objectId: r.objectId, objectType: r.objectType, errors: r.errors.length })),
      })

      setValidationState(result.valid ? 'valid' : 'invalid')
      return result
    },
    [open, runValidation, setObjectValidationResults, setCatalogSummary, setValidationState]
  )

  return {
    validateObject,
    validateCatalog,
    getObjectState,
    getObjectErrors,
    isReady,
    validationState,
    catalogSummary,
  }
}
