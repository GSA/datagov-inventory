import { test as base, expect } from '@playwright/test'

/** Fails any test whose page reports a CSP violation, from the console or a `securitypolicyviolation` event. */
export const test = base.extend<{ cspViolations: string[] }>({
  cspViolations: [
    async ({ page }, use) => {
      const violations: string[] = []
      page.on('console', (message) => {
        if (/Content Security Policy/i.test(message.text())) violations.push(message.text())
      })
      await page.exposeFunction('reportCspViolation', (text: string) => violations.push(text))
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) =>
          (window as unknown as { reportCspViolation: (text: string) => void }).reportCspViolation(
            `${event.violatedDirective} ${event.blockedURI}`,
          ),
        )
      })
      await use(violations)
      // Let events from the test's last step arrive before checking.
      if (!page.isClosed()) await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)))
      expect(violations).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
