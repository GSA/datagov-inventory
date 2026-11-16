import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { ValidationResult, ValidationState } from './types'

interface ValidationContextValue {
  validationState: ValidationState
  objectValidations: Map<string, ValidationResult>
  staleObjects: Set<string>
  catalogSummary: {
    valid: boolean
    totalErrors: number
    errorSummary: Record<string, number>
    timestamp: number
    schemaVersion: string
  } | null
  validationProgress: number
  setValidationState: (state: ValidationState) => void
  setObjectValidation: (objectId: string, result: ValidationResult) => void
  markStale: (objectId: string) => void
  setCatalogSummary: (
    summary: {
      valid: boolean
      totalErrors: number
      errorSummary: Record<string, number>
      timestamp: number
      schemaVersion: string
    } | null
  ) => void
  setValidationProgress: (progress: number) => void
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
  const [validationProgress, setValidationProgress] = useState(0)

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
    setValidationProgress(0)
  }, [])

  return (
    <ValidationContext.Provider
      value={{
        validationState,
        objectValidations,
        staleObjects,
        catalogSummary,
        validationProgress,
        setValidationState,
        setObjectValidation,
        markStale,
        setCatalogSummary,
        setValidationProgress,
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
