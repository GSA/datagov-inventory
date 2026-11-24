import { CatalogStorageError, type CatalogStorageErrorCode } from './storage/CatalogRepository'

export interface StorageErrorHelp {
  heading: string
  guidance: string
}

const HELP: Partial<Record<CatalogStorageErrorCode, StorageErrorHelp>> = {
  blocked: {
    heading: 'Close other Inventory editor tabs',
    guidance:
      'Another tab with the Inventory editor open is blocking an update to browser storage. Close or reload that tab, ' +
      'then reload this page. Your saved catalogs have not been changed.',
  },
  outdated: {
    heading: 'Reload to use the newer editor',
    guidance:
      'Browser storage was updated by a newer version of the editor, perhaps in another tab. Export any open catalog ' +
      'to keep your latest changes, then reload this page.',
  },
  'upgrade-failed': {
    heading: "Keep this site's data while the upgrade is fixed",
    guidance:
      'The catalogs saved in this browser could not be upgraded for this version of the editor. They have not been ' +
      "changed or deleted. Reload the page to try again. If it still fails, don't clear this site's data, which " +
      'deletes them, and work from your last exported catalog file.',
  },
}

/** What the user can do about a storage error, when the editor knows. */
export const storageErrorHelp = (error: unknown): StorageErrorHelp | undefined =>
  error instanceof CatalogStorageError ? HELP[error.code] : undefined
