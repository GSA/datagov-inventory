import { CatalogStorageError, type CatalogStorageErrorCode } from './storage/CatalogRepository'

const GUIDANCE: Partial<Record<CatalogStorageErrorCode, string>> = {
  blocked:
    'Another tab with the Inventory editor open is blocking an update to browser storage. Close or reload that tab, ' +
    'then reload this page. Your saved catalogs have not been changed.',
  outdated:
    'Browser storage was updated by a newer version of the editor, perhaps in another tab. Export any open catalog to ' +
    'keep your latest changes, then reload this page.',
  'upgrade-failed':
    'The catalogs saved in this browser could not be upgraded for this version of the editor. They have not been ' +
    "changed or deleted. Reload the page to try again. If it still fails, don't clear this site's data, which deletes " +
    'them, and work from your last exported catalog file.',
}

/** What the user can do about a storage error, when the editor knows. */
export const storageErrorGuidance = (error: unknown): string | undefined =>
  error instanceof CatalogStorageError ? GUIDANCE[error.code] : undefined
