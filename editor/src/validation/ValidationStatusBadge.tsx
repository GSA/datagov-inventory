import type { ValidationState } from './types'

interface ValidationStatusBadgeProps {
  state: ValidationState
  errorCount?: number
}

export function ValidationStatusBadge({ state, errorCount }: ValidationStatusBadgeProps) {
  const getLabel = () => {
    switch (state) {
      case 'idle':
        return 'Not validated'
      case 'validating':
        return 'Validating...'
      case 'valid':
        return 'Valid'
      case 'invalid':
        return errorCount ? `${errorCount} ${errorCount === 1 ? 'error' : 'errors'}` : 'Invalid'
      case 'stale':
        return 'Needs revalidation'
      default:
        return 'Unknown'
    }
  }

  const getClassName = () => {
    return `validation-badge validation-badge--${state}`
  }

  const getIcon = () => {
    switch (state) {
      case 'valid':
        return '✓'
      case 'invalid':
        return '✕'
      case 'stale':
        return '⚠'
      default:
        return null
    }
  }

  return (
    <span className={getClassName()} role="status" aria-label={`Validation status: ${getLabel()}`}>
      {getIcon() && (
        <span className="validation-badge__icon" aria-hidden="true">
          {getIcon()}
        </span>
      )}
      <span className="validation-badge__label">{getLabel()}</span>
    </span>
  )
}
