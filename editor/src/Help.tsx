import pin from '../schema/dcat-us.pin.json'
import { usePageTitle } from './session'

/**
 * The GitHub issue form for alpha feedback (`.github/ISSUE_TEMPLATE/alpha-feedback.yml`). A plain link with no
 * prefilled fields, so nothing from the catalog goes with it; the CSP stops the editor sending anything itself (#32).
 */
export const FEEDBACK_URL = 'https://github.com/GSA/datagov-inventory/issues/new?template=alpha-feedback.yml'

/** The day the copied schema was pinned, as "October 7, 2026", from its commit date. */
const pinnedOn = new Date(`${pin.date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', {
  dateStyle: 'long',
  timeZone: 'UTC',
})

/**
 * What the alpha is, how to give feedback (first, as the banner promises it), where catalogs are kept, what the check
 * means, and its known limits (#32). `usa-prose measure-4` gives paragraphs the size and width of the lists' items.
 */
export default function Help() {
  usePageTitle('Help')
  return (
    <div className="tablet:grid-col-8">
      <h1 tabIndex={-1}>Help</h1>
      <p className="usa-intro">
        This editor is an alpha, so keep your original file and check the file you export before you publish it.
      </p>

      <h2>Give feedback</h2>
      <p className="usa-prose measure-4">
        Tell us about a problem or an idea on GitHub. You need a GitHub account, and what you write is public. Do not
        paste catalog content, personal information or anything that is not public. Nothing from your catalog is
        attached.
      </p>
      <p className="usa-prose">
        <a href={FEEDBACK_URL} className="usa-link usa-link--external">
          Give feedback on GitHub<span className="usa-sr-only"> (external site)</span>
        </a>
      </p>

      <h2>Where your catalog is kept</h2>
      <ul className="usa-list">
        <li>
          Each catalog you import stays in this browser, on this device, until you clear this site&apos;s data. Another
          browser or device can&apos;t see it.
        </li>
        <li>It is not uploaded or sent anywhere. The site&apos;s security settings block the editor from sending data.</li>
        <li>It is not backed up. Export it to keep a copy.</li>
        <li>
          To remove it, clear this site&apos;s data in your browser settings. It is also lost if the browser clears site
          data itself, for example when the device runs low on space, or when a private window closes.
        </li>
      </ul>

      <h2>What “Validate catalog” checks</h2>
      <p className="usa-prose measure-4">
        The check is advisory. It compares your catalog with the DCAT-US 3.0 schema as of {pinnedOn} (GSA/dcat-us
        commit {pin.commit.slice(0, 7)}), in this browser. It is not the official Data.gov validator, so Data.gov may
        still report problems when it harvests your catalog.
      </p>

      <h2>Known limits</h2>
      <ul className="usa-list">
        <li>DCAT-US 3.0 JSON only. It does not open data.json (DCAT-US 1.1) or JSON-LD files.</li>
        <li>
          One catalog open at a time. Importing another opens it in place of the open one, and the earlier one stays in
          this browser at its own address.
        </li>
        <li>Tested with catalogs of up to 3,000 datasets.</li>
        <li>Automated tests run in Chromium, the engine in Chrome and Edge. Firefox and Safari are not tested yet.</li>
      </ul>
    </div>
  )
}
