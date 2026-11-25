import type { Page } from '@playwright/test'
import { test, expect, expectNoAxeViolations } from './fixtures'
import { largeCatalog } from '../fixtures/largeCatalog'

const DATASET = 'Air quality readings'

async function openDataset(page: Page) {
  await page.goto('/import')
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}$/)
  await page.getByRole('treeitem', { name: `${DATASET} Dataset` }).click()
  return page.getByRole('form', { name: `Edit ${DATASET}` })
}

async function enterInvalidIssuedDate(page: Page) {
  const form = await openDataset(page)
  const issued = form.getByRole('textbox', { name: /^Issued/ })
  await issued.fill('not a date')
  await issued.blur()
  return form
}

test.describe('Validation', () => {
  test('validates an object and shows inline field errors', async ({ page }) => {
    const form = await enterInvalidIssuedDate(page)

    await form.getByRole('button', { name: `Validate ${DATASET}` }).click()

    await expect(form.getByRole('alert').filter({ hasText: 'Fix this error' })).toContainText('Issued')
    await expect(form.locator('.usa-error-message')).toHaveText('is not in an accepted form')
    await expect(form.locator('.validation-badge--invalid')).toContainText(/error/i)
  })


  test('marks validation as stale after an edit', async ({ page }) => {
    const form = await openDataset(page)
    // Before a check, only Validate shows; the status is there for screen readers.
    const status = form.getByRole('status', { name: /^Validation status:/ })
    await expect(status).toHaveAccessibleName('Validation status: Not validated')
    await expect(status).toHaveClass('usa-sr-only')

    await form.getByRole('button', { name: `Validate ${DATASET}` }).click()
    await expect(form.locator('.validation-badge--valid')).toHaveText('✓No errors found')

    const title = form.getByRole('textbox', { name: /^Title/ })
    await title.fill('Updated Title')
    await title.blur()

    await expect(page.locator('.validation-badge--stale')).toHaveText('⚠Changed since last check')
  })

  test('warns before exporting a catalog with errors', async ({ page }) => {
    await enterInvalidIssuedDate(page)

    await page.getByRole('button', { name: 'Validate catalog' }).click()
    await expect(page.getByRole('region', { name: 'Fix this error in the catalog' })).toBeVisible()

    await page.getByRole('button', { name: 'Export catalog' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Validation Errors Detected')
    await expect(dialog).toContainText('did not pass')
    await expect(dialog.getByRole('button', { name: 'Download Anyway' })).toBeVisible()
  })

  test('announces validation errors to screen readers', async ({ page }) => {
    const form = await enterInvalidIssuedDate(page)

    await form.getByRole('button', { name: `Validate ${DATASET}` }).click()

    const alert = form.getByRole('alert').filter({ hasText: 'Fix this error' })
    await expect(alert).toHaveAttribute('aria-live', 'polite')
    await expect(alert).toContainText('Issued')
  })

  test('does not rely on color alone for errors', async ({ page }) => {
    const form = await enterInvalidIssuedDate(page)

    await form.getByRole('button', { name: `Validate ${DATASET}` }).click()

    const badge = form.locator('.validation-badge--invalid')
    await expect(badge.locator('.validation-badge__icon')).toHaveText('✕')
    await expect(badge).toContainText(/\d+ errors?/)
  })

  test('navigates to an object with errors from the summary', async ({ page }) => {
    await enterInvalidIssuedDate(page)
    await page.getByRole('treeitem', { name: 'Example Agency Catalog', exact: true }).click()

    await page.getByRole('button', { name: 'Validate catalog' }).click()
    await page.getByRole('button', { name: /^Air quality readings \(\d+ errors?\)$/ }).click()

    await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/dataset\/[A-Za-z0-9_-]{22}$/)
    await expect(page.getByRole('form', { name: `Edit ${DATASET}` })).toBeVisible()
  })
})

test('marks an empty required link field in the field itself', async ({ page }) => {
  const form = await openDataset(page)
  // An empty required link field.
  const contacts = form.getByRole('group', { name: /^Contact point/ })
  await contacts.getByRole('button', { name: /^Remove Air Quality Team/ }).click()
  await form.getByRole('button', { name: `Validate ${DATASET}` }).click()
  await expect(contacts.locator('.usa-error-message')).toHaveText('Contact point is required')
  await expect(contacts.getByText('This required field has no values')).toHaveCount(0)
})

/** Holds the validation worker's results until `releaseValidation()`, so a check runs as long as a test needs. */
function holdValidationResults() {
  const w = window as unknown as { holdValidation: boolean; releaseValidation: () => void; held: (() => void)[] }
  Object.assign(w, { holdValidation: false, held: [] })
  w.releaseValidation = () => {
    w.holdValidation = false
    w.held.splice(0).forEach((deliver) => deliver())
  }
  window.Worker = class extends window.Worker {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
      const deliver = (event: Event) =>
        typeof listener === 'function' ? listener.call(this, event) : listener.handleEvent(event)
      super.addEventListener(
        type,
        (event) => {
          if (w.holdValidation && (event as MessageEvent).data?.type === 'result') w.held.push(() => deliver(event))
          else deliver(event)
        },
        options,
      )
    }
  }
}

/**
 * Records, after every change to the page, where the heading, the catalog's actions, the tree and the object form are,
 * whether there is a progress bar, whether the Validate button is busy, and whether the results are shown. Returns a
 * check that nothing above the results moved, and nothing below them either until they appeared.
 */
async function recordLayout(page: Page) {
  await page.evaluate(() => {
    const box = (element: Element | null) => {
      const r = element!.getBoundingClientRect()
      return [r.x, r.y, r.width, r.height].map(Math.round).join(',')
    }
    // Where it starts: its contents (the form's status badge, say) may change its height without moving anything.
    const position = (element: Element | null) => box(element).split(',').slice(0, 2).join(',')
    const snapshot = () => ({
      above: [box(document.querySelector('h1')), ...[...document.querySelectorAll('.catalog-actions .usa-button')].map(box)],
      below: [position(document.querySelector('.editor-nav')), position(document.querySelector('form.object-form'))],
      progressBars: document.querySelectorAll('[role="progressbar"], progress').length,
      // Validate catalog, while busy (Undo, used up, is aria-disabled too).
      busy: !!document.querySelector('.catalog-actions [aria-disabled="true"] .stacked-labels'),
      results: !!document.querySelector('.catalog-check'),
    })
    const w = window as unknown as { layouts: ReturnType<typeof snapshot>[] }
    w.layouts = [snapshot()]
    new MutationObserver(() => w.layouts.push(snapshot())).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })
  })
  return async () => {
    const [before, ...after] = await page.evaluate(
      () =>
        (window as unknown as { layouts: { above: string[]; below: string[]; progressBars: number; busy: boolean; results: boolean }[] })
          .layouts,
    )
    expect(after.length).toBeGreaterThan(0)
    for (const layout of after) {
      expect(layout.progressBars).toBe(0)
      // Nothing above the results ever moves; what is below moves only once the results are there to push it.
      expect(layout.above).toEqual(before.above)
      if (!layout.results || before.results) expect(layout.below).toEqual(before.below)
    }
    return after
  }
}

test.describe('Validate catalog feedback', () => {
  test('a quick check shows no progress bar and moves nothing but the results', async ({ page }) => {
    await openDataset(page)
    const button = page.getByRole('button', { name: 'Validate catalog' })
    const status = page.getByRole('status').filter({ hasText: /^Validat/ })

    let check = await recordLayout(page)
    await button.click()
    await expect(page.locator('.catalog-check')).toContainText('No errors found')
    // The button never changed: a quick check is over before "Validating…" would show.
    expect((await check()).some((layout) => layout.busy)).toBe(false)
    await expect(status).toHaveText('Validation finished: no errors found.')
    await expect(button).toBeFocused()

    // Checking again, with the results already shown, moves nothing at all.
    check = await recordLayout(page)
    await button.click()
    await expect(status).toHaveText('Validation finished: no errors found.')
    expect((await check()).some((layout) => layout.busy)).toBe(false)
    await expectNoAxeViolations(page)
  })

  test('a long check on 3,000 datasets says so in the button, without moving the page', async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000)
    await page.addInitScript(holdValidationResults)
    await page.goto('/import')
    await page.getByLabel('Choose a DCAT-US 3.0 JSON file').setInputFiles({
      name: 'large.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(largeCatalog())),
    })
    // TODO #29 Speed up the saveCatalog time for a large catalog
    await expect(page.getByRole('tree').getByRole('treeitem')).toHaveCount(1 + 3_000, { timeout: 30_000 })
    const button = page.locator('.catalog-actions .usa-button').nth(1)
    await expect(button).toHaveAccessibleName('Validate catalog')
    const status = page.getByRole('status').filter({ hasText: /^Validat/ })

    const check = await recordLayout(page)
    await page.evaluate(() => Object.assign(window, { holdValidation: true }))
    await button.click()
    // Past the delay, the button says it is busy, a click on it does nothing, and focus stays on it.
    await expect(button).toHaveAccessibleName('Validating…')
    await expect(button).toHaveAttribute('aria-disabled', 'true')
    await expect(button).toBeFocused()
    await expect(status).toHaveText('Validating catalog…')
    await page.keyboard.press('Enter')
    expect(await page.evaluate(() => (window as unknown as { held: unknown[] }).held.length)).toBe(1)
    await expectNoAxeViolations(page, '.catalog-actions')

    await page.evaluate(() => (window as unknown as { releaseValidation: () => void }).releaseValidation())
    await expect(status).toHaveText(/^Validation finished: (no errors|[\d,]+ errors?) found\.$/)
    await expect(page.locator('.catalog-check')).toBeVisible()
    await expect(button).toHaveAccessibleName('Validate catalog')
    await expect(button).not.toHaveAttribute('aria-disabled')
    await expect(button).toBeFocused()
    expect((await check()).some((layout) => layout.busy)).toBe(true)
  })
})

/** The last catalog check's line beside the catalog's actions, and the text it shows (the other only holds its space). */
const checkLine = (page: Page) => page.locator('.catalog-check')
const checkText = (page: Page) => page.locator('.catalog-check > .stacked-labels > :not(.stacked-labels__off)')
/** The catalog's announcement, made once when a check ends. */
const announcement = (page: Page) => page.locator('p[role="status"].usa-sr-only')
const TIME = '\\d{1,2}:\\d{2}\\s?[AP]M'

async function validateCatalog(page: Page, result: string) {
  await page.getByRole('button', { name: 'Validate catalog' }).click()
  await expect(announcement(page)).toHaveText(result)
}

async function editDescription(page: Page, text = 'Hourly readings, edited') {
  const description = page.getByRole('form', { name: `Edit ${DATASET}` }).getByRole('textbox', { name: /^Description/ })
  await description.fill(text)
  await description.blur()
}

/** Where an element is on the page, wherever it is scrolled to. */
const box = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect()
    return { x, y: y + scrollY, width, height }
  })

for (const width of [375, 1440]) {
  test.describe(`Catalog check status at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('no errors: one line with the time, out of date once the catalog changes, in the same space', async ({ page }) => {
      await openDataset(page)
      // Before a check: no result at all.
      await expect(checkLine(page)).toHaveCount(0)

      await validateCatalog(page, 'Validation finished: no errors found.')
      await expect(checkText(page)).toHaveText(new RegExp(`^✓ No errors found · advisory check at ${TIME}$`))
      await expect(page.locator('#validation-results')).toHaveCount(0)
      await expect(page.getByRole('button', { name: /results$/ })).toHaveCount(0)
      await expectNoAxeViolations(page)
      const line = await box(page, '.catalog-check')
      const tree = await box(page, '.editor-nav')

      // Leaving a field without typing changes nothing.
      await page.getByRole('form', { name: `Edit ${DATASET}` }).getByRole('textbox', { name: /^Title/ }).focus()
      await page.keyboard.press('Tab')
      await expect(checkText(page)).toContainText('✓ No errors found')

      await editDescription(page)
      await expect(checkText(page)).toHaveText(new RegExp(`^Changed since last check \\(${TIME}\\)$`))
      // The change is in the text only: nothing moves, and nothing is announced (the old result is cleared silently).
      expect(await box(page, '.catalog-check')).toEqual(line)
      expect(await box(page, '.editor-nav')).toEqual(tree)
      await expect(page.locator('.catalog-check [role="status"], .catalog-check[aria-live]')).toHaveCount(0)
      await expect(announcement(page)).toHaveText('')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expectNoAxeViolations(page)

      // Checking again makes it current.
      await validateCatalog(page, 'Validation finished: no errors found.')
      await expect(checkText(page)).toContainText('✓ No errors found')
    })

    test('errors: the list stays, says when it is out of date, and hides and shows', async ({ page }) => {
      await enterInvalidIssuedDate(page)
      await validateCatalog(page, 'Validation finished: 1 error found.')
      const results = page.locator('#validation-results')
      await expect(page.getByRole('region', { name: 'Fix this error in the catalog' })).toBeVisible()
      await expect(results).toContainText('1 Dataset error')
      await expect(results.getByRole('note')).toContainText('not the official Data.gov validator')
      await expect(checkText(page)).toHaveText(new RegExp(`^✕ 1 error found · advisory check at ${TIME}$`))
      const toggle = page.getByRole('button', { name: 'Hide results' })
      await expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await expect(toggle).toHaveAttribute('aria-controls', 'validation-results')
      await expectNoAxeViolations(page)
      const list = await box(page, '#validation-results ul')

      await editDescription(page)
      // The list's heading says so, in the same space, so the list doesn't move.
      await expect(page.getByRole('region', { name: 'The catalog has changed since this check' })).toBeVisible()
      expect(await box(page, '#validation-results ul')).toEqual(list)
      await expect(checkText(page)).toHaveText(new RegExp(`^Changed since last check \\(${TIME}, 1 error\\)$`))
      await expect(announcement(page)).toHaveText('')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expectNoAxeViolations(page)

      // Hidden, and shown again, by the same button, which stays put and keeps focus.
      const at = await box(page, '.catalog-check__toggle')
      await toggle.click()
      await expect(results).toHaveCount(0)
      const shower = page.getByRole('button', { name: 'Show results' })
      await expect(shower).toHaveAttribute('aria-expanded', 'false')
      await expect(shower).toBeFocused()
      expect(await box(page, '.catalog-check__toggle')).toEqual(at)
      await expectNoAxeViolations(page)

      await page.keyboard.press('Enter')
      await expect(results).toContainText('The catalog has changed since this check')
      await expect(page.getByRole('button', { name: 'Hide results' })).toBeFocused()

      // Hidden, then checked again: they stay hidden, as the user left them, and the line has the new result.
      await page.keyboard.press('Enter')
      await validateCatalog(page, 'Validation finished: 1 error found.')
      await expect(results).toHaveCount(0)
      await expect(checkText(page)).toContainText('✕ 1 error found')
      await page.getByRole('button', { name: 'Show results' }).click()
      await expect(page.getByRole('region', { name: 'Fix this error in the catalog' })).toBeVisible()
    })
  })
}

test('any change to the catalog, an undo too, makes the check out of date', async ({ page }) => {
  const form = await openDataset(page)
  await validateCatalog(page, 'Validation finished: no errors found.')

  await form.getByRole('group', { name: /^Contact point/ }).getByRole('button', { name: /^Remove Air Quality Team/ }).click()
  await expect(checkText(page)).toContainText('Changed since last check')
  await validateCatalog(page, 'Validation finished: 1 error found.')
  await expect(checkText(page)).toContainText('✕ 1 error found')

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(checkText(page)).toContainText('Changed since last check')
  await expect(page.getByRole('region', { name: 'The catalog has changed since this check' })).toBeVisible()
})

test("the list stays the check's own after an object is fixed and checked on its own", async ({ page }) => {
  const form = await enterInvalidIssuedDate(page)
  await validateCatalog(page, 'Validation finished: 1 error found.')

  const issued = form.getByRole('textbox', { name: /^Issued/ })
  await issued.fill('2024-01-01')
  await issued.blur()
  await form.getByRole('button', { name: `Validate ${DATASET}` }).click()
  await expect(form.locator('.validation-badge--valid')).toBeVisible()

  // The catalog's list still matches its counts, under a heading that says the catalog has changed.
  const results = page.getByRole('region', { name: 'The catalog has changed since this check' })
  await expect(results).toContainText('1 Dataset error')
  await expect(results.getByRole('button', { name: `${DATASET} (1 error)` })).toBeVisible()
})

test('the check stays with its catalog when the user leaves the editor and comes back', async ({ page }) => {
  await openDataset(page)
  await validateCatalog(page, 'Validation finished: no errors found.')
  await page.getByRole('link', { name: 'Import' }).click()
  await page.getByRole('link', { name: 'Back to the editor' }).click()
  await expect(checkText(page)).toContainText('✓ No errors found')

  // Another catalog starts with no check.
  await page.goto('/import')
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page.getByRole('tree')).toBeVisible()
  await expect(checkLine(page)).toHaveCount(0)
})
