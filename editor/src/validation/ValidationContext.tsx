import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { ValidationResult, ValidationState } from './types'
import type { CatalogGraph } from '../catalog/types'

/** The last catalog check. */
export interface CatalogSummary {
  valid: boolean
  totalErrors: number
  errorSummary: Record<string, number>
  timestamp: number
  schemaVersion: string
  /** The workspace checked, and its catalog as it was: any change makes a new graph, so the check is out of date. */
  catalogId: string
  catalog: CatalogGraph
  /** The objects with errors at the check, so its list matches its counts whatever is checked later. */
  objectsWithErrors: Array<{ objectId: string; objectType: string; errors: number }>
}

interface ValidationContextValue {
  validationState: ValidationState
  objectValidations: Map<string, ValidationResult>
  staleObjects: Set<string>
  catalogSummary: CatalogSummary | null
  setValidationState: (state: ValidationState) => void
  setObjectValidation: (objectId: string, result: ValidationResult) => void
  /** Stores many results in one update: calling `setObjectValidation` per object copies the map each time, O(n²). */
  setObjectValidationResults: (results: Array<ValidationResult & { objectId: string }>) => void
  markStale: (objectId: string) => void
  setCatalogSummary: (summary: CatalogSummary | null) => void
  getObjectState: (objectId: string) => ValidationState
  getObjectErrors: (objectId: string) => ValidationResult['errors']
  clearAll: () => void
}

const ValidationContext = createContext<ValidationContextValue | undefined>(undefined)

export function ValidationProvider({ children }: { children: ReactNode }) {
  const [validationState, setValidationState] = useState<ValidationState>('idle')
  const [objectValidations, setObjectValidations] = useState<Map<string, ValidationResult>>(new Map())
  const [staleObjects, setStaleObjects] = useState<Set<string>>(new Set())
  const [catalogSummary, setCatalogSummary] = useState<ValidationContextValue['catalogSummary']>(null)

  const setObjectValidation = useCallback((objectId: string, result: ValidationResult) => {
    setObjectValidations((prev) => {
      const newMap = new Map(prev)
      newMap.set(objectId, result)
      return newMap
    })
    setStaleObjects((prev) => {
      const newSet = new Set(prev)
      newSet.delete(objectId)
      return newSet
    })
  }, [])

  const setObjectValidationResults = useCallback((results: Array<ValidationResult & { objectId: string }>) => {
    setObjectValidations((prev) => {
      const newMap = new Map(prev)
      for (const result of results) newMap.set(result.objectId, result)
      return newMap
    })
    setStaleObjects((prev) => {
      const newSet = new Set(prev)
      for (const { objectId } of results) newSet.delete(objectId)
      return newSet
    })
  }, [])

  const markStale = useCallback((objectId: string) => {
    setStaleObjects((prev) => {
      const newSet = new Set(prev)
      newSet.add(objectId)
      return newSet
    })
  }, [])

  const getObjectState = useCallback(
    (objectId: string): ValidationState => {
      if (staleObjects.has(objectId)) {
        return 'stale'
      }

      const validation = objectValidations.get(objectId)
      if (!validation) {
        return 'idle'
      }

      return validation.valid ? 'valid' : 'invalid'
    },
    [objectValidations, staleObjects]
  )

  const getObjectErrors = useCallback(
    (objectId: string) => {
      const validation = objectValidations.get(objectId)
      return validation?.errors || []
    },
    [objectValidations]
  )

  const clearAll = useCallback(() => {
    setValidationState('idle')
    setObjectValidations(new Map())
    setStaleObjects(new Set())
    setCatalogSummary(null)
  }, [])

  return (
    <ValidationContext.Provider
      value={{
        validationState,
        objectValidations,
        staleObjects,
        catalogSummary,
        setValidationState,
        setObjectValidation,
        setObjectValidationResults,
        markStale,
        setCatalogSummary,
        getObjectState,
        getObjectErrors,
        clearAll,
      }}
    >
      {children}
    </ValidationContext.Provider>
  )
}

export function useValidationContext() {
  const context = useContext(ValidationContext)
  if (!context) {
    throw new Error('useValidationContext must be used within ValidationProvider')
  }
  return context
}

export function useMarkStaleOnChange(objectId: string) {
  const { markStale } = useValidationContext()

  useEffect(() => {
    markStale(objectId)
  }, [objectId, markStale])
}
