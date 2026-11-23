/** Select an existing object or create a new one from any class-valued field (#25): no dialogs, one form at a time. */
import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

async function loadSample(page: Page) {
  await page.goto('/import')
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}$/)
}

/** On the catalog: adds the dataset's contact to the catalog's Contact point, so the two share it. */
async function shareContact(page: Page) {
  await field(page, 'Contact point').getByRole('combobox').fill('air')
  await page.getByRole('option', { name: /Air Quality Team/ }).click()
}

/** A label as notes and announcements write it: isolated, so right-to-left text in it can't reverse the sentence. */
const iso = (label: string) => `\u2068${label}\u2069`

/** A class-valued field (a group) by its label; a required one's name ends in " *". */
const field = (page: Page, name: string) => page.getByRole('group', { name: new RegExp(`^${name}( \\*)?$`) })

test('searches by keyword and selects an existing object, which is then shared, not copied', async ({ page }) => {
  await loadSample(page)
  const contacts = field(page, 'Contact point')
  const picker = contacts.getByRole('combobox', { name: 'Add an existing Contact' })

  await picker.fill('quality')
  const options = page.getByRole('listbox', { name: 'Add an existing Contact' }).getByRole('option')
  await expect(options).toHaveCount(1)
  await expect(options.first()).toContainText('Air Quality Team')
  await expect(options.first()).toContainText('Contact · used in Air quality readings')
  await expect(contacts.getByText('1 match.')).toBeVisible()
  await expect(picker).toHaveAccessibleDescription('1 match.')
  await options.first().click()

  // The catalog now links the same contact as the dataset.
  const row = contacts.getByRole('link', { name: 'Air Quality Team' })
  await expect(row).toBeFocused()
  await expect(contacts.getByText('Contact · Used in 2 places')).toBeVisible()
  await expect(contacts.getByRole('status')).toHaveText(`Added ${iso('Air Quality Team')} to Contact point. It is now used in 2 places.`)
  await expect(picker).toHaveValue('')
  await expect(page.getByRole('treeitem', { name: 'Air Quality Team Contact point · Contact' })).toBeVisible()

  // The object shows how many places use it, and lists them.
  await row.click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/kind\/[A-Za-z0-9_-]{22}$/)
  const usedIn = page.getByRole('group', { name: 'Used in 2 places' })
  await expect(usedIn).toContainText('Changes here apply to every place.')
  // The places fold away, so a contact used by hundreds of datasets doesn't push the form down.
  await expect(usedIn.getByRole('link')).toHaveCount(0)
  await usedIn.getByRole('button', { name: 'Places and copy options', expanded: false }).click()
  await expect(usedIn.getByRole('link')).toHaveText(['Example Agency Catalog › Contact point', 'Air quality readings › Contact point'])

  // One edit shows in both places: it is one object.
  const name = page.getByRole('textbox', { name: /^Full name/ })
  await name.fill('Air team')
  await name.blur()
  await usedIn.getByRole('link', { name: 'Air quality readings › Contact point' }).click()
  await expect(field(page, 'Contact point').getByRole('link', { name: 'Air team' })).toBeFocused()
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
    // The catalog's and the dataset's publisher, merged on import (ADR 0008).
    'Example AgencyOrganization · used in 2 places',
  ])
  await creators.getByRole('combobox').fill('air')
  await expect(creators.getByText('No matches.')).toBeVisible()
  await expect(page.getByRole('listbox', { name: 'Add an existing Agent or Organization' })).toBeHidden()
  // A dataset's distributions belong to it: Create new only.
  await expect(field(page, 'Distribution').getByRole('combobox')).toHaveCount(0)
  await expect(field(page, 'Distribution').getByRole('button', { name: 'Create new Distribution' })).toBeVisible()

  // A distribution's data service belongs to the catalog's list of services: Add an existing only.
  await field(page, 'Distribution').getByRole('link', { name: 'Readings as CSV' }).click()
  await expect(field(page, 'Access service').getByRole('combobox', { name: 'Add an existing Data Service' })).toBeVisible()
  await expect(field(page, 'Access service').getByRole('button', { name: /^Create new/ })).toHaveCount(0)
})

test('picks with the keyboard alone', async ({ page }) => {
  await loadSample(page)
  // The catalog and dataset share one publisher (merged on import); give the catalog a copy, so there are two to pick.
  await field(page, 'Publisher').getByRole('button', { name: /^Edit a copy for this one/ }).click()
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
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/distribution\/[A-Za-z0-9_-]{22}$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2, name: 'Untitled Distribution' })).toBeFocused()
  await expect(page.getByText(`New Distribution, linked to ${iso('Air quality, hourly')} › Distribution.`)).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Untitled Distribution' })).toHaveAccessibleDescription(/^New Distribution, linked to/)
  // Back follows the notice; an object used in one place doesn't list it again.
  await expect(page.getByRole('link', { name: 'Back to Air quality, hourly' })).toBeVisible()
  await expect(page.getByText(/^Used in/)).toHaveCount(0)
  await expect(page.getByRole('treeitem', { name: /^Untitled Distribution/ })).toHaveAttribute('aria-selected', 'true')
  const distributionTitle = page.getByRole('textbox', { name: /^Title/ })
  await distributionTitle.fill('Readings as Parquet')
  await distributionTitle.blur()

  // Another level down, then back up one level at a time; each Back lands on the row of the object it came from.
  await field(page, 'Checksum').getByRole('button', { name: 'Create new Checksum' }).click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/checksum\/[A-Za-z0-9_-]{22}$/)
  await page.getByRole('link', { name: 'Back to Readings as Parquet' }).click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/distribution\/[A-Za-z0-9_-]{22}$/)
  await expect(field(page, 'Checksum').getByRole('link', { name: 'Untitled Checksum' })).toBeFocused()
  await expect(field(page, 'Checksum').getByText('Holds one Checksum.', { exact: false })).toBeVisible()

  // Without a notice, the breadcrumb leads to the same place, so Back shows on phones only, where the breadcrumb is hidden.
  const backToDataset = page.getByRole('link', { name: 'Back to Air quality, hourly' })
  await expect(backToDataset).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Where this object is' }).getByRole('link', { name: 'Air quality, hourly' })).toBeVisible()
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(page.getByRole('navigation', { name: 'Where this object is' })).toBeHidden()
  await backToDataset.click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/dataset\/[A-Za-z0-9_-]{22}$/)
  await expect(field(page, 'Distribution').getByRole('link', { name: 'Readings as Parquet' })).toBeFocused()
  await expect(page.getByRole('textbox', { name: /^Title/ })).toHaveValue('Air quality, hourly')

  // The browser's Back works too, and the new object has its own address.
  await page.goBack()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/distribution\/[A-Za-z0-9_-]{22}$/)
})

test('leaves a long list with Tab, and the caret keys leave the options', async ({ page }) => {
  const datasets = Array.from({ length: 30 }, (_, i) => ({ '@type': 'Dataset', title: `D${i}`, contactPoint: { fn: `Team ${i}` } }))
  await page.goto('/import')
  await page.getByLabel('Paste JSON').fill(JSON.stringify({ '@type': 'Catalog', title: 'Many', dataset: datasets }))
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()
  const picker = field(page, 'Contact point').getByRole('combobox')
  await expect(picker).toHaveAccessibleName('Add an existing Contact to Contact point')

  // The list scrolls, which makes it a tab stop in Chrome unless it opts out.
  await picker.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByText('Showing 25 of 30. Keep typing to narrow down.')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(picker).not.toHaveAttribute('aria-activedescendant')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Alt+ArrowUp')
  await expect(picker).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Tab')
  await expect(field(page, 'Contact point').getByRole('button', { name: /^Create new Contact/ })).toBeFocused()
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
  await shareContact(page)

  // From the catalog's field: the copy takes the shared contact's place there only.
  await field(page, 'Contact point').getByRole('button', { name: 'Edit a copy for this one: Air Quality Team' }).click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/kind\/[A-Za-z0-9_-]{22}$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Air Quality Team' })).toBeFocused()
  await expect(page.getByText(`This is a copy of ${iso('Air Quality Team')} for ${iso('Example Agency Catalog')} only. The other place still uses the original.`)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to Example Agency Catalog' })).toBeVisible()
  await expect(page.getByRole('group', { name: /^Used in/ })).toHaveCount(0)
  const name = page.getByRole('textbox', { name: /^Full name/ })
  await name.fill('Catalog contact')
  await name.blur()
  await expect(page.getByRole('treeitem', { name: /^Catalog contact/ })).toHaveCount(1)
  // The original is unchanged, and now used in the dataset alone.
  await page.getByRole('treeitem', { name: /^Air quality readings/ }).click()
  await field(page, 'Contact point').getByRole('link', { name: 'Air Quality Team' }).click()
  await expect(page.getByRole('group', { name: /^Used in/ })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Where this object is' }).getByRole('link').last()).toHaveText('Air quality readings')
  await expect(page.getByRole('textbox', { name: /^Full name/ })).toHaveValue('Air Quality Team')

  // From the shared object's own list of places.
  await page.getByRole('treeitem', { name: 'Example Agency Catalog' }).click()
  await shareContact(page)
  await page.getByRole('treeitem', { name: /^Air quality readings/ }).click()
  await field(page, 'Contact point').getByRole('link', { name: 'Air Quality Team' }).click()
  // The place the user came from (the dataset) is listed first. By keyboard: Enter on the button.
  const places = page.getByRole('group', { name: 'Used in 2 places' })
  await places.getByRole('button', { name: 'Places and copy options' }).click()
  await expect(places.getByRole('link')).toHaveText(['Air quality readings › Contact point', 'Example Agency Catalog › Contact point'])
  await places.getByRole('button', { name: 'Edit a copy for this one: Air quality readings' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 2, name: 'Air Quality Team' })).toBeFocused()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/kind\/[A-Za-z0-9_-]{22}$/)
  await expect(page.getByRole('link', { name: 'Back to Air quality readings' })).toBeVisible()
  await expect(page.getByRole('group', { name: /^Used in/ })).toHaveCount(0)
})

test('has no accessibility violations axe can find: the open list, a new object, a shared object', async ({ page }) => {
  const AxeBuilder = (await import('@axe-core/playwright')).default
  const expectNoViolations = async () => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    expect(results.violations).toEqual([])
  }
  await loadSample(page)

  await field(page, 'Contact point').getByRole('combobox').focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('listbox').getByRole('option', { selected: true })).toBeVisible()
  await expectNoViolations()

  await page.keyboard.press('Enter')
  await field(page, 'Contact point').getByRole('link', { name: 'Air Quality Team' }).click()
  await page.getByRole('group', { name: 'Used in 2 places' }).getByRole('button', { name: 'Places and copy options' }).click()
  await expect(page.getByRole('group', { name: 'Used in 2 places' }).getByRole('link')).toHaveCount(2)
  await expectNoViolations()

  await field(page, 'Address').getByRole('button', { name: /^Create new Address/ }).click()
  await expect(page.getByText(/^New Address, linked to/)).toBeVisible()
  await expectNoViolations()
})

test('goes back to the place it came from when an object is used in several', async ({ page }) => {
  await loadSample(page)
  await shareContact(page)

  // Shared by the catalog and the dataset: opened from the dataset, Back goes to the dataset, by keyboard alone.
  await page.getByRole('treeitem', { name: /^Air quality readings/ }).click()
  await field(page, 'Contact point').getByRole('link', { name: 'Air Quality Team' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/kind\/[A-Za-z0-9_-]{22}$/)
  const back = page.getByRole('link', { name: 'Back to Air quality readings' })
  await back.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/dataset\/[A-Za-z0-9_-]{22}$/)
  await expect(field(page, 'Contact point').getByRole('link', { name: 'Air Quality Team' })).toBeFocused()

  // Create new by keyboard, then Back by keyboard.
  await field(page, 'Distribution').getByRole('button', { name: /^Create new Distribution/ }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 2, name: 'Untitled Distribution' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Back to Air quality readings' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(field(page, 'Distribution').getByRole('link', { name: 'Untitled Distribution' })).toBeFocused()
})

test('ends the undo of a removal once something is added', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /^Air quality readings/ }).click()
  await field(page, 'Distribution').getByRole('link', { name: 'Readings API' }).click()
  await page.getByRole('button', { name: 'Delete object' }).click()
  const undo = page.getByRole('button', { name: 'Undo' })
  await expect(undo).toBeEnabled()

  await page.getByRole('treeitem', { name: /^Air quality readings/ }).click()
  await field(page, 'Distribution').getByRole('button', { name: /^Create new Distribution/ }).click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/distribution\/[A-Za-z0-9_-]{22}$/)
  await expect(undo).toBeDisabled()
})

test('exports every object added to a list field that was read as one object', async ({ page }) => {
  await page.goto('/import')
  await page.getByLabel('Paste JSON').fill(
    JSON.stringify({ '@type': 'Catalog', title: 'One', dataset: [{ '@type': 'Dataset', title: 'D', distribution: { title: 'one' } }] }),
  )
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()
  await page.getByRole('treeitem', { name: /^D Dataset/ }).click()
  await field(page, 'Distribution').getByRole('button', { name: /^Create new Distribution/ }).click()
  const title = page.getByRole('textbox', { name: /^Title/ })
  await title.fill('two')
  await title.blur()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export catalog' }).click()
  const exported = JSON.parse(await readFile((await (await download).path())!, 'utf-8'))
  expect(exported.dataset[0].distribution).toEqual([{ title: 'one' }, { '@type': 'Distribution', title: 'two' }])
})

test('counts only places still in the catalog, and keeps focus in a field emptied by Remove', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /^Air quality readings/ }).click()
  await field(page, 'Creator').getByRole('combobox').fill('example')
  await page.getByRole('option').first().click()
  await field(page, 'Creator').getByRole('link', { name: 'Example Agency' }).click()
  // The catalog's and the dataset's publisher (merged on import), and now the dataset's creator.
  await expect(page.getByRole('group', { name: 'Used in 3 places' })).toBeVisible()

  // Removing the dataset from the catalog leaves the agency used by the catalog alone.
  await page.getByRole('button', { name: 'Places and copy options' }).click()
  await page.getByRole('link', { name: 'Example Agency Catalog › Publisher' }).click()
  await field(page, 'Dataset').getByRole('button', { name: 'Remove Air quality readings from Dataset' }).click()
  await expect(field(page, 'Dataset').getByRole('button', { name: /^Create new Dataset/ })).toBeFocused()
  await expect(field(page, 'Dataset').getByRole('status')).toHaveText(`Removed ${iso('Air quality readings')} from Dataset.`)
  await expect(field(page, 'Publisher').getByText(/^Organization · Used in/)).toHaveCount(0)
  await expect(field(page, 'Publisher').getByText('Organization', { exact: true })).toBeVisible()
  await expect(field(page, 'Publisher').getByRole('button', { name: /^Edit a copy/ })).toHaveCount(0)
})
