import { test as setup, expect } from '@playwright/test'

const authFile = 'tests/e2e/.auth/user.json'

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  if (!email || !password) {
    throw new Error(
      'TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env.test'
    )
  }

  // Navigate to login page
  await page.goto('/login')

  // Fill in login form
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)

  // Submit login form
  await page.getByRole('button', { name: 'Anmelden' }).click()

  // Wait for navigation to documents page (successful login)
  await expect(page).toHaveURL('/documents', { timeout: 15000 })

  // Verify we're logged in by checking for page content
  await expect(page.getByRole('heading', { name: 'Dokumente' })).toBeVisible()

  // Save authentication state
  await page.context().storageState({ path: authFile })
})
