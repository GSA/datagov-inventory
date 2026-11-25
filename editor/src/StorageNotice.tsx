import { Alert, AlertText } from '@trussworks/react-uswds'
import { Link } from '@tanstack/react-router'

/**
 * Where catalogs are kept, shown on the start and import pages on every visit (#32), so it needs no "seen" flag in
 * storage. Below each page's main action, so a phone still shows it first. Clearing is by the browser's site data
 * until the editor has its own control (#28).
 */
export default function StorageNotice() {
  return (
    <Alert type="info" slim className="margin-y-3 maxw-tablet-lg">
      <AlertText>
        <strong>Where your catalog is kept:</strong> in this browser, on this device. It is not sent anywhere or backed
        up, so export it to keep a copy. To remove it, clear this site&apos;s data in your browser settings.{' '}
        <Link to="/help" className="usa-link">
          More about where your catalog is kept
        </Link>
      </AlertText>
    </Alert>
  )
}
