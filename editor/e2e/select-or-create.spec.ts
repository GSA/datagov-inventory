/** Select an existing object or create a new one from any class-valued field (#25): no dialogs, one form at a time. */
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

async function loadSample(page: Page) {
  await page.goto('/import')
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page).toHaveURL('/editor')
}

/** A class-valued field by its label; a required one's name ends in " *". */
const field = (page: Page, name: string) => page.getByRole('region', { name: new RegExp(`^${name}( \\*)?$`) })

test('searches by keyword and selects an existing object, which is then shared, not copied', async ({ page }) => {
  await loadSample(page)
  const contacts = field(page, 'Contact Point')
  const picker = contacts.getByRole('combobox', { name: 'Add an existing Kind' })

  await picker.fill('quality')
  const options = page.getByRole('listbox', { name: 'Add an existing Kind' }).getByRole('option')
  await expect(options).toHaveCount(1)
  await expect(options.first()).toContainText('Air Quality Team')
  await expect(options.first()).toContainText('Kind · used in Air quality readings')
  await expect(contacts.getByText('1 match.')).toBeVisible()
  await expect(picker).toHaveAccessibleDescription('1 match.')
  await options.first().click()

  // The catalog now links the same contact as the dataset.
  const row = contacts.getByRole('link', { name: 'Air Quality Team' })
  await expect(row).toBeFocused()
  await expect(contacts.getByText('Kind · Used in 2 places')).toBeVisible()
  await expect(contacts.getByRole('status')).toHaveText('Added Air Quality Team to Contact Point. It is now used in 2 places.')
  await expect(picker).toHaveValue('')
  await expect(page.getByRole('treeitem', { name: 'Air Quality Team contactPoint · Kind' })).toBeVisible()

  // The object shows how many places use it, and lists them.
  await row.click()
  await expect(page).toHaveURL('/editor/dataset/0/contactPoint/0')
  const usedIn = page.getByRole('region', { name: 'Used in 2 places' })
  await expect(usedIn.getByRole('link')).toHaveText(['Example Agency Catalog › Contact Point', 'Air quality readings › Contact Point'])

  // One edit shows in both places: it is one object.
  const name = page.getByRole('textbox', { name: /^Fn/ })
  await name.fill('Air team')
  await name.blur()
  await usedIn.getByRole('link', { name: 'Air quality readings › Contact Point' }).click()
  await expect(field(page, 'Contact Point').getByRole('link', { name: 'Air team' })).toBeFocused()
})

test('offers only objects of the field\'s classes, and none already in it', async ({ page }) => {
  await loadSample(page)
  // The catalog's publisher is an Agent field, so Organizations count; it holds one already, so it offers nothing.
  await expect(field(page, 'Publisher').getByText('Holds one Agent or Organization. To use a different one, remove this one first.')).toBeVisible()
  await expect(field(page, 'Publisher').getByRole('combobox')).toHaveCount(0)

  await page.getByRole('treeitem', { name: /^Air quality readings/ }).click()
  const creators = field(page, 'Creator')
  await creators.getByRole('combobox').fill('example')
  await expect(page.getByRole('listbox', { name: 'Add an existing Agent or Organization' }).getByRole('option')).toHaveText([
    'Example AgencyOrganization · used in Example Agency Catalog',
    'Example AgencyOrganization · used in Air quality readings',
  ])
  await creators.getByRole('combobox').fill('air')
  await expect(creators.getByText('No matches.')).toBeVisible()
  await expect(page.getByRole('listbox', { name: 'Add an existing Agent or Organization' })).toBeHidden()
  // A dataset's distributions belong to it: Create new only.
  await expect(field(page, 'Distribution').getByRole('combobox')).toHaveCount(0)
  await expect(field(page, 'Distribution').getByRole('button', { name: 'Create new Distribution' })).toBeVisible()

  // A distribution's data service belongs to the catalog's list of services: Add an existing only.
  await field(page, 'Distribution').getByRole('link', { name: 'Readings as CSV' }).click()
  await expect(field(page, 'Access Service').getByRole('combobox', { name: 'Add an existing DataService' })).toBeVisible()
  await expect(field(page, 'Access Service').getByRole('button', { name: /^Create new/ })).toHaveCount(0)
})

test('picks with the keyboard alone', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /^Air quality readings/ }).click()
  const picker = field(page, 'Creator').getByRole('combobox')
  await picker.focus()
  await expect(picker).toHaveAttribute('aria-expanded', 'false')

  // Down opens the list on its first option; Down and Up move; Escape closes, then clears.
  await page.keyboard.press('ArrowDown')
  await expect(picker).toHaveAttribute('aria-expanded', 'true')
  const options = page.getByRole('listbox').getByRole('option')
  await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true')
  await expect(picker).toHaveAttribute('aria-activedescendant', (await options.nth(0).getAttribute('id'))!)
  await page.keyboard.press('ArrowDown')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowUp')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Escape')
  await expect(picker).toHaveAttribute('aria-expanded', 'false')
  await expect(picker).not.toHaveAttribute('aria-activedescendant')
  await picker.pressSequentially('agency')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(picker).toHaveValue('')

  // Alt+Down opens the list without choosing an option.
  await page.keyboard.press('Alt+ArrowDown')
  await expect(picker).toHaveAttribute('aria-expanded', 'true')
  await expect(picker).not.toHaveAttribute('aria-activedescendant')
  await page.keyboard.press('Escape')

  // Up opens on the last option; Enter picks it, and focus moves to the new row.
  await page.keyboard.press('ArrowUp')
  await expect(options.last()).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(field(page, 'Creator').getByRole('link', { name: 'Example Agency' })).toBeFocused()
})

test('creates a new object in place of the form, three levels deep, and comes back to each parent', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /^Air quality readings/ }).click()
  const title = page.getByRole('textbox', { name: /^Title/ })
  await title.fill('Air quality, hourly')

  // Create new replaces the form: no dialog. What was typed is kept.
  await field(page, 'Distribution').getByRole('button', { name: 'Create new Distribution' }).click()
  await expect(page).toHaveURL('/editor/dataset/0/distribution/2')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2, name: 'Untitled Distribution' })).toBeFocused()
  await expect(page.getByText('New Distribution, linked to Air quality, hourly › Distribution.')).toBeVisible()
  await expect(page.getByText('Used in 1 place: Air quality, hourly › Distribution')).toBeVisible()
  await expect(page.getByRole('treeitem', { name: /^Untitled Distribution/ })).toHaveAttribute('aria-selected', 'true')
  const distributionTitle = page.getByRole('textbox', { name: /^Title/ })
  await distributionTitle.fill('Readings as Parquet')
  await distributionTitle.blur()

  // Another level down, then back up one level at a time; each Back lands on the row of the object it came from.
  await field(page, 'Checksum').getByRole('button', { name: 'Create new Checksum' }).click()
  await expect(page).toHaveURL('/editor/dataset/0/distribution/2/checksum/0')
  await page.getByRole('link', { name: 'Back to Readings as Parquet' }).click()
  await expect(page).toHaveURL('/editor/dataset/0/distribution/2')
  await expect(field(page, 'Checksum').getByRole('link', { name: 'Untitled Checksum' })).toBeFocused()
  await expect(field(page, 'Checksum').getByText('Holds one Checksum.', { exact: false })).toBeVisible()

  await page.getByRole('link', { name: 'Back to Air quality, hourly' }).click()
  await expect(page).toHaveURL('/editor/dataset/0')
  await expect(field(page, 'Distribution').getByRole('link', { name: 'Readings as Parquet' })).toBeFocused()
  await expect(page.getByRole('textbox', { name: /^Title/ })).toHaveValue('Air quality, hourly')

  // The browser's Back works too, and the new object has its own address.
  await page.goBack()
  await expect(page).toHaveURL('/editor/dataset/0/distribution/2')
})

test('creates an Organization in a field that allows Agents', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /^Air quality readings/ }).click()
  const creators = field(page, 'Creator')
  await expect(creators.getByRole('button', { name: /^Create new/ })).toHaveText(['Create new Agent in Creator', 'Create new Organization in Creator'])
  await creators.getByRole('button', { name: 'Create new Organization' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Untitled Organization' })).toBeFocused()
})

test('edits a copy of a shared object for one place only', async ({ page }) => {
  await loadSample(page)
  await field(page, 'Contact Point').getByRole('combobox').fill('air')
  await page.getByRole('option', { name: /Air Quality Team/ }).click()

  // From the catalog's field: the copy takes the shared contact's place there only.
  await field(page, 'Contact Point').getByRole('button', { name: 'Edit a copy for this one: Air Quality Team' }).click()
  await expect(page).toHaveURL('/editor/contactPoint/1')
  await expect(page.getByRole('heading', { level: 2, name: 'Air Quality Team' })).toBeFocused()
  await expect(page.getByText('This is a copy of Air Quality Team for Example Agency Catalog only. The other place still uses the original.')).toBeVisible()
  await expect(page.getByText('Used in 1 place: Example Agency Catalog › Contact Point')).toBeVisible()
  const name = page.getByRole('textbox', { name: /^Fn/ })
  await name.fill('Catalog contact')
  await name.blur()
  await expect(page.getByRole('treeitem', { name: /^Catalog contact/ })).toHaveCount(1)

  // From the shared object's own list of places.
  await page.getByRole('link', { name: 'Back to Example Agency Catalog' }).click()
  await field(page, 'Contact Point').getByRole('combobox').fill('air')
  await page.getByRole('option', { name: /Air Quality Team/ }).click()
  await field(page, 'Contact Point').getByRole('link', { name: 'Air Quality Team' }).click()
  await page.getByRole('region', { name: 'Used in 2 places' }).getByRole('button', { name: 'Edit a copy for this one: Air quality readings' }).click()
  await expect(page).toHaveURL('/editor/dataset/0/contactPoint/1')
  await expect(page.getByText('Used in 1 place: Air quality readings › Contact Point')).toBeVisible()
  await page.getByRole('link', { name: 'Back to Air quality readings' }).click()
  await expect(field(page, 'Contact Point').getByRole('link', { name: 'Air Quality Team' })).toBeFocused()
})

test('has no accessibility violations axe can find: the open list, a new object, a shared object', async ({ page }) => {
  const AxeBuilder = (await import('@axe-core/playwright')).default
  const expectNoViolations = async () => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    expect(results.violations).toEqual([])
  }
  await loadSample(page)

  await field(page, 'Contact Point').getByRole('combobox').focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('listbox').getByRole('option', { selected: true })).toBeVisible()
  await expectNoViolations()

  await page.keyboard.press('Enter')
  await field(page, 'Contact Point').getByRole('link', { name: 'Air Quality Team' }).click()
  await expect(page.getByRole('region', { name: 'Used in 2 places' })).toBeVisible()
  await expectNoViolations()

  await field(page, 'Address').getByRole('button', { name: /^Create new Address/ }).click()
  await expect(page.getByText(/^New Address, linked to/)).toBeVisible()
  await expectNoViolations()
})

test('goes back to the place it came from when an object is used in several', async ({ page }) => {
  await loadSample(page)
  await field(page, 'Contact Point').getByRole('combobox').fill('air')
  await page.getByRole('option', { name: /Air Quality Team/ }).click()

  // Shared by the catalog and the dataset: opened from the dataset, Back goes to the dataset, by keyboard alone.
  await page.getByRole('treeitem', { name: /^Air quality readings/ }).click()
  await field(page, 'Contact Point').getByRole('link', { name: 'Air Quality Team' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/editor/dataset/0/contactPoint/0')
  const back = page.getByRole('link', { name: 'Back to Air quality readings' })
  await back.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/editor/dataset/0')
  await expect(field(page, 'Contact Point').getByRole('link', { name: 'Air Quality Team' })).toBeFocused()

  // Create new by keyboard, then Back by keyboard.
  await field(page, 'Distribution').getByRole('button', { name: /^Create new Distribution/ }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 2, name: 'Untitled Distribution' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Back to Air quality readings' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(field(page, 'Distribution').getByRole('link', { name: 'Untitled Distribution' })).toBeFocused()
})

test('ends the undo of a removal once something is added, so ids cannot clash', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /^Air quality readings/ }).click()
  await field(page, 'Distribution').getByRole('link', { name: 'Readings API' }).click()
  await page.getByRole('button', { name: 'Delete object' }).click()
  const undo = page.getByRole('button', { name: 'Undo' })
  await expect(undo).toBeEnabled()

  await page.getByRole('treeitem', { name: /^Air quality readings/ }).click()
  await field(page, 'Distribution').getByRole('button', { name: /^Create new Distribution/ }).click()
  // The new distribution takes the deleted one's id; undoing the delete now would put two objects at it.
  await expect(page).toHaveURL('/editor/dataset/0/distribution/1')
  await expect(undo).toBeDisabled()
})
