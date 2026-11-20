import { Modal, ModalHeading, ModalFooter, Button } from '@trussworks/react-uswds'
import { classLabel } from '../labels'

interface ExportWarningDialogProps {
  isOpen: boolean
  catalogSummary: {
    totalErrors: number
    errorSummary: Record<string, number>
  }
  onCancel: () => void
  onExport: () => void
}

export function ExportWarningDialog({ isOpen, catalogSummary, onCancel, onExport }: ExportWarningDialogProps) {
  if (!isOpen) return null

  return (
    <Modal
      id="export-warning-modal"
      isInitiallyOpen
      forceAction
      aria-labelledby="export-warning-heading"
      aria-describedby="export-warning-description"
    >
      <ModalHeading id="export-warning-heading">Validation Errors Detected</ModalHeading>
      <div className="usa-prose">
        <p id="export-warning-description">
          The catalog has <strong>{catalogSummary.totalErrors}</strong> validation{' '}
          {catalogSummary.totalErrors === 1 ? 'error' : 'errors'}:
        </p>
        <ul>
          {Object.entries(catalogSummary.errorSummary).map(([type, count]) => {
            if (count === 0) return null
            return (
              <li key={type}>
                <strong>{count}</strong> {classLabel(type)} {count === 1 ? 'error' : 'errors'}
              </li>
            )
          })}
        </ul>
        <p>
          <strong>The exported file did not pass the DCAT-US schema check.</strong> You can still download it, but it may
          not be valid for use with Data.gov systems.
        </p>
      </div>
      <ModalFooter>
        <Button type="button" onClick={onCancel} outline>
          Go Back
        </Button>
        <Button type="button" onClick={onExport}>
          Download Anyway
        </Button>
      </ModalFooter>
    </Modal>
  )
}
