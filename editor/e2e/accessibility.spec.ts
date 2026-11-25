import type { Page } from '@playwright/test'
import { test, expect, expectNoAxeViolations } from './fixtures'

// #30: axe scans every page and state the editor has, at phone and desktop widths, under the production CSP (the
// fixture fails the test on any CSP violation, axe's included). Any WCAG 2.1 A or AA violation fails the build. Other
// specs scan their own screens too; this is the complete list in one place. The manual results are in
// docs/accessibility.md.

const tree = (page: Page) => page.getByRole('tree', { name: 'Catalog' })
/** A row by its label, field and class; a closed row's name also ends with how many items it holds. */
const item = (page: Page, name: string) =>
  tree(page).getByRole('treeitem', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( · [\\d,]+ items?)?$`) })
/** A class-valued field (a group) by its label; a required one's name ends in " *". */
const field = (page: Page, name: string) => page.getByRole('group', { name: new RegExp(`^${name}( \\*)?$`) })
const DATASET = 'Air quality readings'

async function loadSample(page: Page, name: string) {
  await page.getByLabel('Sample catalog').selectOption(name)
  await page.getByRole('button', { name: 'Load sample' }).click()
}

/** Holds the parse worker, so a load stays in progress until released. */
async function holdWorker(page: Page) {
  let release!: () => void
  const released = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/parse.worker-*.js', async (route) => {
    await released
    await route.continue()
  })
  return release
}

for (const width of [375, 1440]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('every page and state has no WCAG 2.1 AA violations axe can find', async ({ page }, testInfo) => {
      testInfo.setTimeout(120_000)

      await test.step('start page', async () => {
        await page.goto('/')
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expectNoAxeViolations(page)
      })

      if (width < 1024) {
        await test.step('the header menu, open', async () => {
          await page.getByRole('button', { name: 'Menu' }).click()
          await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
          await expectNoAxeViolations(page)
          await page.keyboard.press('Escape')
          await page.getByRole('button', { name: 'Close Navigation Menu' }).click()
        })
      }

      await test.step('page not found', async () => {
        await page.goto('/no-such-page')
        await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
        await expectNoAxeViolations(page)
      })

      await test.step('editor with no catalog open', async () => {
        await page.goto('/editor')
        await expect(page.getByRole('heading', { level: 1, name: 'No catalog open' })).toBeVisible()
        await expectNoAxeViolations(page)
      })

      await test.step('invalid editor address', async () => {
        await page.goto('/editor/not-an-address')
        await expect(page.getByRole('heading', { level: 1, name: 'Invalid editor address' })).toBeVisible()
        await expectNoAxeViolations(page)
      })

      await test.step('a catalog address not in this browser', async () => {
        await page.goto('/editor/byND73XUQ6eHsUP6ks4Kog')
        await expect(page.getByRole('heading', { level: 1, name: 'Catalog not found in this browser' })).toBeVisible()
        await expectNoAxeViolations(page)
      })

      await test.step('import page', async () => {
        await page.goto('/import')
        await expect(page.getByRole('heading', { level: 1, name: 'Import a catalog' })).toBeVisible()
        await expectNoAxeViolations(page)
      })

      await test.step('import page with a load in progress', async () => {
        const release = await holdWorker(page)
        await page.getByRole('button', { name: 'Start a blank catalog' }).click()
        await expect(page.getByRole('progressbar', { name: 'Loading Blank catalog…' })).toBeVisible()
        await expectNoAxeViolations(page)
        await page.getByRole('button', { name: 'Cancel loading' }).click()
        await expect(page.getByRole('heading', { level: 1, name: 'Import a catalog' })).toBeFocused()
        release()
      })

      await test.step('import page with a load error alert', async () => {
        await page.getByLabel('Paste JSON').fill('{"@type": "Catalog", "dataset": [')
        await page.getByRole('button', { name: 'Load pasted JSON' }).click()
        await expect(page.getByRole('alert')).toContainText('This is not valid JSON')
        await expectNoAxeViolations(page)
      })

      await test.step('editor on a loaded catalog, with the tree and detail pane', async () => {
        await loadSample(page, 'dataset-with-distributions.json')
        await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}$/)
        await expect(page.locator('#detail-heading')).toHaveText('Example Agency Catalog')
        await expectNoAxeViolations(page)
      })

      await test.step('editor with the tree expanded and a nested object open', async () => {
        await item(page, `${DATASET} Dataset`).locator('.catalog-tree__toggle').click()
        await item(page, 'Readings as CSV Distribution').locator('.catalog-tree__toggle').click()
        await item(page, 'Untitled Checksum Checksum').click()
        await expect(page.locator('#detail-heading')).toHaveText('Untitled Checksum')
        await expectNoAxeViolations(page)
      })

      await test.step('editor with the tree filtered', async () => {
        const filter = page.getByLabel('Filter by title or name')
        await filter.fill('readings')
        await expect(page.getByRole('status').filter({ hasText: 'match' })).toHaveText('3 objects match.')
        await expectNoAxeViolations(page)
        await filter.fill('nothing like this')
        await expect(tree(page)).toHaveCount(0)
        await expectNoAxeViolations(page)
        await filter.fill('')
      })

      await test.step("a dataset's form", async () => {
        await item(page, `${DATASET} Dataset`).click()
        await expect(page.getByRole('form', { name: `Edit ${DATASET}` })).toBeVisible()
        await expectNoAxeViolations(page)
      })

      await test.step('the form with a field error, after checking the object', async () => {
        const form = page.getByRole('form', { name: `Edit ${DATASET}` })
        const issued = form.getByRole('textbox', { name: /^Issued/ })
        await issued.fill('not a date')
        await issued.blur()
        await form.getByRole('button', { name: `Validate ${DATASET}` }).click()
        await expect(form.getByRole('alert').filter({ hasText: 'Fix this error' })).toContainText('Issued')
        await expect(form.locator('.usa-error-message')).toHaveText('is not in an accepted form')
        await expectNoAxeViolations(page)
      })

      await test.step('the catalog check with an error, its results shown, then hidden', async () => {
        await page.getByRole('button', { name: 'Validate catalog' }).click()
        await expect(page.getByRole('region', { name: 'Fix this error in the catalog' })).toBeVisible()
        await expectNoAxeViolations(page)
        await page.getByRole('button', { name: 'Hide results' }).click()
        await expect(page.getByRole('button', { name: 'Show results' })).toBeFocused()
        await expectNoAxeViolations(page)
        await page.getByRole('button', { name: 'Show results' }).click()
      })

      await test.step('the export warning dialog', async () => {
        await page.getByRole('button', { name: 'Export catalog' }).click()
        const dialog = page.getByRole('dialog')
        await expect(dialog).toContainText('Validation Errors Detected')
        await expectNoAxeViolations(page)
        await dialog.getByRole('button', { name: 'Go Back' }).click()
        await expect(page.getByRole('dialog')).toHaveCount(0)
      })

      await test.step('the catalog check out of date after an edit', async () => {
        const issued = page.getByRole('form', { name: `Edit ${DATASET}` }).getByRole('textbox', { name: /^Issued/ })
        await issued.fill('2024-01-15')
        await issued.blur()
        await expect(page.getByRole('region', { name: 'The catalog has changed since this check' })).toBeVisible()
        await expectNoAxeViolations(page)
      })

      await test.step('the catalog check with no errors, and the export success alert', async () => {
        await page.getByRole('button', { name: 'Validate catalog' }).click()
        await expect(page.locator('.catalog-check')).toContainText('✓ No errors found')
        await expectNoAxeViolations(page)
        const download = page.waitForEvent('download')
        await page.getByRole('button', { name: 'Export catalog' }).click()
        await download
        await expect(page.locator('#export-status')).toBeVisible()
        await expectNoAxeViolations(page)
      })

      await test.step('the "Add an existing" picker, open, and with no matches', async () => {
        await item(page, 'Example Agency Catalog').click()
        const picker = field(page, 'Contact point').getByRole('combobox')
        await picker.focus()
        await page.keyboard.press('ArrowDown')
        await expect(page.getByRole('listbox').getByRole('option', { selected: true })).toBeVisible()
        await expectNoAxeViolations(page)
        await picker.fill('nothing like this')
        await expect(field(page, 'Contact point').locator('.object-picker__status')).toContainText(/no/i)
        await expectNoAxeViolations(page)
        await picker.fill('air')
        await page.getByRole('option', { name: /Air Quality Team/ }).click()
        await expect(field(page, 'Contact point').getByRole('link', { name: 'Air Quality Team' })).toBeFocused()
        await expectNoAxeViolations(page)
      })

      await test.step('a shared object, with its places shown', async () => {
        await field(page, 'Contact point').getByRole('link', { name: 'Air Quality Team' }).click()
        const usedIn = page.getByRole('group', { name: 'Used in 2 places' })
        await usedIn.getByRole('button', { name: 'Places and copy options' }).click()
        await expect(usedIn.getByRole('link')).toHaveCount(2)
        await expectNoAxeViolations(page)
      })

      await test.step('the in-place prompt before deleting a shared object', async () => {
        await page.getByRole('button', { name: 'Delete object' }).click()
        await expect(page.getByRole('heading', { name: 'Delete this shared object?' })).toBeFocused()
        await expectNoAxeViolations(page)
        await page.getByRole('button', { name: 'Cancel' }).click()
      })

      await test.step('a new object, created in place of the form', async () => {
        await field(page, 'Address').getByRole('button', { name: /^Create new Address/ }).click()
        await expect(page.getByText(/^New Address, linked to/)).toBeVisible()
        await expectNoAxeViolations(page)
      })

      await test.step('the catalog restored from browser storage after a reload', async () => {
        await page.reload()
        await expect(page.locator('#detail-heading')).toHaveText('Untitled Address')
        await expectNoAxeViolations(page)
      })

      await test.step('start page with a catalog open', async () => {
        // In-page links: a full page load starts with no catalog open in the tab.
        await page.getByRole('link', { name: 'Inventory Editor' }).click()
        await expect(page.getByRole('link', { name: /^Continue with/ })).toBeVisible()
        await expectNoAxeViolations(page)
      })

      await test.step('import page with a catalog open, and the replace prompt', async () => {
        if (width < 1024) await page.getByRole('button', { name: 'Menu' }).click()
        await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Import' }).click()
        await expect(page.getByText('dataset-with-distributions.json is open.')).toBeVisible()
        await expectNoAxeViolations(page)
        await loadSample(page, 'minimal-catalog.json')
        await expect(page.getByRole('heading', { name: 'Replace the open catalog?' })).toBeFocused()
        await expectNoAxeViolations(page)
      })

      await test.step('browser storage unavailable: the editor page, and the import alert', async () => {
        await page.getByRole('button', { name: 'Cancel' }).click()
        await expect(page.getByText('dataset-with-distributions.json is open.')).toBeVisible()
        if (width < 1024) await page.getByRole('button', { name: 'Menu' }).click()
        await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Editor' }).click()
        await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}$/)
        const catalogUrl = page.url()
        await page.addInitScript(() => {
          Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true })
        })
        await page.goto(catalogUrl)
        await expect(page.getByRole('heading', { level: 1, name: 'Browser storage unavailable' })).toBeVisible()
        await expectNoAxeViolations(page)
        await page.goto('/import')
        await loadSample(page, 'minimal-catalog.json')
        await expect(page.getByRole('alert')).toContainText('Browser storage is unavailable.')
        await expectNoAxeViolations(page)
      })
    })
  })
}

/** Presses `key` until focus is on an element whose accessible text matches, failing if focus ever falls to <body>. */
async function moveFocusTo(page: Page, match: RegExp, key = 'Tab', limit = 150) {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press(key)
    const text = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement
      if (element === document.body) return null
      return (element.getAttribute('aria-label') || element.textContent || element.id).replace(/\s+/g, ' ').trim()
    })
    expect(text, 'focus fell to <body>').not.toBeNull()
    if (match.test(text!)) return
  }
  throw new Error(`No focus stop matching ${match} within ${limit} presses of ${key}`)
}

test('the main tasks can be done with the keyboard alone: load, open, edit, create new, check, export', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await moveFocusTo(page, /^Import a catalog$/)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Import a catalog' })).toBeFocused()

  // Load: the sample list already shows the first sample.
  await moveFocusTo(page, /^Load sample$/)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Example Agency Catalog' })).toBeFocused()

  // Open: into the tree, down to the dataset, Enter.
  await moveFocusTo(page, /^Example Agency Catalog/)
  await expect(item(page, 'Example Agency Catalog')).toBeFocused()
  await moveFocusTo(page, new RegExp(`^${DATASET}`), 'ArrowDown', 10)
  await page.keyboard.press('Enter')
  await expect(page.locator('#detail-heading')).toHaveText(DATASET)

  // Edit: the title, then leave the field.
  await moveFocusTo(page, /^field-title$/)
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('Air quality, hourly')
  await page.keyboard.press('Tab')
  await expect(item(page, 'Air quality, hourly Dataset')).toBeVisible()

  // Create new: a distribution, which opens in place of the form, and Back to the dataset.
  await moveFocusTo(page, /^Create new Distribution in Distribution$/)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 2, name: 'Untitled Distribution' })).toBeFocused()
  await moveFocusTo(page, /Back to Air quality, hourly$/)
  await page.keyboard.press('Enter')
  await expect(page.locator('#detail-heading')).toHaveText('Air quality, hourly')

  // Check: the whole catalog; the result is announced.
  await moveFocusTo(page, /^Validate catalog/, 'Shift+Tab', 300)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Validation finished' })).toHaveText(/^Validation finished: \d+ errors? found\.$|^Validation finished: no errors found\.$/)

  // Export: a download, announced; with errors, the warning dialog's Download Anyway first.
  await moveFocusTo(page, /^Export catalog$/, 'Shift+Tab', 5)
  const download = page.waitForEvent('download')
  await page.keyboard.press('Enter')
  if (await page.getByRole('dialog').isVisible()) {
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Go Back' })).toBeFocused()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
  }
  expect((await download).suggestedFilename()).toMatch(/\.json$/)
  await expect(page.locator('#export-status')).toContainText('Catalog exported successfully.')
})

test('a delete and its undo are announced, and focus stays on Undo once it is used up', async ({ page }) => {
  await page.goto('/import')
  await loadSample(page, 'dataset-with-distributions.json')
  await item(page, `${DATASET} Dataset`).click()
  const notice = page.getByRole('status').filter({ hasText: /^(Deleted|Undone)/ })

  await page.getByRole('button', { name: 'Delete object' }).press('Enter')
  await expect(page.locator('#detail-heading')).toBeFocused()
  await expect(notice).toHaveText(`Deleted ⁨${DATASET}⁩. Undo, at the top of the page, puts it back.`)

  const undo = page.getByRole('button', { name: 'Undo' })
  await undo.press('Enter')
  await expect(item(page, `${DATASET} Dataset`)).toBeVisible()
  await expect(notice).toHaveText('Undone. What was removed is back.')
  await expect(undo).toBeFocused()
  await expect(undo).toHaveAttribute('aria-disabled', 'true')
  // Used up, it does nothing.
  await undo.press('Enter')
  await expect(item(page, `${DATASET} Dataset`)).toBeVisible()
  await expect(undo).toBeFocused()
})
