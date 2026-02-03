import { test, expect } from '@playwright/test'
import { SettingsPage } from '../page-objects/settings.page'

/**
 * E2E Tests for Settings page (/settings)
 * Covers extraction settings and navigation to sub-settings
 */

test.describe('Settings Page', () => {
  let settingsPage: SettingsPage

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page)
    await settingsPage.goto()
  })

  test.describe('Page Load', () => {
    test('should display settings page with heading', async () => {
      await expect(settingsPage.heading).toBeVisible()
    })

    test('should show PDF extraction card', async () => {
      await expect(settingsPage.pdfExtractionCard).toBeVisible()
    })

    test('should show supplier recognition card', async () => {
      await expect(settingsPage.supplierRecognitionCard).toBeVisible()
    })

    test('should show auto-import card', async () => {
      await expect(settingsPage.autoImportCard).toBeVisible()
    })
  })

  test.describe('Extraction Settings', () => {
    test('should display auto-create articles toggle', async () => {
      await expect(settingsPage.autoCreateArticlesSwitch).toBeVisible()
    })

    test('should display threshold values', async () => {
      const autoThreshold = await settingsPage.getAutoThreshold()
      const suggestionThreshold = await settingsPage.getSuggestionThreshold()

      expect(autoThreshold).toBeGreaterThan(0)
      expect(autoThreshold).toBeLessThanOrEqual(100)
      expect(suggestionThreshold).toBeGreaterThan(0)
      expect(suggestionThreshold).toBeLessThanOrEqual(100)
    })

    test('should toggle auto-create articles', async () => {
      const initialState = await settingsPage.isAutoCreateArticlesEnabled()

      await settingsPage.toggleAutoCreateArticles()

      const newState = await settingsPage.isAutoCreateArticlesEnabled()
      expect(newState).not.toBe(initialState)

      // Save button should be enabled
      expect(await settingsPage.hasUnsavedChanges()).toBe(true)

      // Toggle back to original state (don't save)
      await settingsPage.toggleAutoCreateArticles()
    })

    test('should save settings', async () => {
      const initialState = await settingsPage.isAutoCreateArticlesEnabled()

      // Toggle setting
      await settingsPage.toggleAutoCreateArticles()

      // Save
      await settingsPage.saveSettings()

      // Reload page and verify setting persisted
      await settingsPage.goto()
      const savedState = await settingsPage.isAutoCreateArticlesEnabled()
      expect(savedState).not.toBe(initialState)

      // Restore original state
      await settingsPage.toggleAutoCreateArticles()
      await settingsPage.saveSettings()
    })

    test('should disable save button when no changes', async ({ page }) => {
      // Wait for page to fully load
      await settingsPage.waitForLoad()

      // Without making changes, save button should be disabled
      const hasChanges = await settingsPage.hasUnsavedChanges()
      expect(hasChanges).toBe(false)
    })
  })

  test.describe('Navigation Links', () => {
    test('should navigate to supplier identifiers page', async ({ page }) => {
      await settingsPage.goToSupplierIdentifiers()

      // Should be on the supplier identifiers page
      await expect(page.getByRole('heading', { name: /Lieferanten-Merkmale|Identifiers/i })).toBeVisible()
    })

    test('should navigate to supplier blocklist page', async ({ page }) => {
      await settingsPage.goToSupplierBlocklist()

      // Should be on the blocklist page
      await expect(page.getByRole('heading', { name: /Blocklist/i })).toBeVisible()
    })

    test('should navigate to import sources page', async ({ page }) => {
      await settingsPage.goToImportSources()

      // Should be on the import sources page (heading is "Auto-Import Einstellungen")
      await expect(page.getByRole('heading', { name: /Auto-Import/i })).toBeVisible()
    })
  })

  test.describe('Navigation Links Visibility', () => {
    test('should show all navigation links', async () => {
      await expect(settingsPage.supplierIdentifiersLink).toBeVisible()
      await expect(settingsPage.supplierBlocklistLink).toBeVisible()
      await expect(settingsPage.importSourcesLink).toBeVisible()
    })
  })
})

test.describe('Settings Accessibility', () => {
  test('should have accessible toggle', async ({ page }) => {
    const settingsPage = new SettingsPage(page)
    await settingsPage.goto()

    // Toggle should have accessible label
    const toggle = settingsPage.autoCreateArticlesSwitch
    await expect(toggle).toBeVisible()

    // Should be focusable
    await toggle.focus()
    await expect(toggle).toBeFocused()
  })

  test('should be keyboard navigable', async ({ page }) => {
    const settingsPage = new SettingsPage(page)
    await settingsPage.goto()

    // Tab through the page
    await page.keyboard.press('Tab')

    // Should be able to toggle switch with Space
    await settingsPage.autoCreateArticlesSwitch.focus()
    const initialState = await settingsPage.isAutoCreateArticlesEnabled()

    await page.keyboard.press('Space')

    const newState = await settingsPage.isAutoCreateArticlesEnabled()
    expect(newState).not.toBe(initialState)

    // Toggle back
    await page.keyboard.press('Space')
  })

  test('should have proper heading hierarchy', async ({ page }) => {
    const settingsPage = new SettingsPage(page)
    await settingsPage.goto()

    // Main heading (h1)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Card titles - shadcn/ui CardTitle renders as div with text-2xl font-semibold classes
    // Verify cards are visible with their titles
    await expect(page.locator('div.rounded-lg.border').filter({ hasText: 'PDF-Extraktion' })).toBeVisible()
    await expect(page.locator('div.rounded-lg.border').filter({ hasText: 'Lieferanten-Erkennung' })).toBeVisible()
    await expect(page.locator('div.rounded-lg.border').filter({ hasText: 'Auto-Import' })).toBeVisible()
  })
})
