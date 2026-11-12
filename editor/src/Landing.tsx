import { Link } from '@tanstack/react-router'
import { useCatalog, usePageTitle } from './session'

/** What the editor is for, and the way in: import the organization's whole catalog. */
export default function Landing() {
  const { open } = useCatalog()
  usePageTitle('Start')
  return (
    <>
      <h1 tabIndex={-1}>Edit your DCAT-US 3.0 catalog in this browser</h1>
      <p className="usa-intro">
        Open your organization&apos;s catalog, review its datasets, and download a file ready for Data.gov to harvest.
      </p>
      <p className="margin-y-3">
        <Link to="/import" className="usa-button">
          Import a catalog
        </Link>
        {open && (
          <Link to="/editor/$" params={{ _splat: '' }} className="usa-button usa-button--outline">
            Continue with <bdi>{open.name}</bdi>
          </Link>
        )}
      </p>
      <ol className="usa-process-list">
        <li className="usa-process-list__item">
          <h2 className="usa-process-list__heading">Import your catalog</h2>
          <p>
            Export your catalog as one DCAT-US 3.0 JSON file. One file holds every dataset your organization lists, even
            thousands, so there&apos;s no need to split it. You can also paste JSON or start from a blank catalog.
          </p>
        </li>
        <li className="usa-process-list__item">
          <h2 className="usa-process-list__heading">Review it</h2>
          <p>
            Browse every dataset, distribution and contact, and follow the links between them. Each one has its own
            address, so you can bookmark it. Editing is coming to this alpha.
          </p>
        </li>
        <li className="usa-process-list__item">
          <h2 className="usa-process-list__heading">Export it</h2>
          <p>Download the edited file and give it to your IT team to host where Data.gov harvests it. Coming soon.</p>
        </li>
      </ol>
      <p className="margin-top-4 text-base">
        Your catalog stays in this browser. Nothing is uploaded or sent anywhere.
      </p>
    </>
  )
}
