interface ValidationProgressProps {
  progress: number
  total?: number
}

export function ValidationProgress({ progress, total }: ValidationProgressProps) {
  const percentage = Math.round(progress)

  return (
    <div
      className="validation-progress"
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="validation-progress__bar">
        <div className="validation-progress__fill" style={{ width: `${percentage}%` }} aria-hidden="true" />
      </div>
      <p className="validation-progress__label">
        {total ? `Validating ${total} objects... ${percentage}%` : `${percentage}% complete`}
      </p>
    </div>
  )
}
