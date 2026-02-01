import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page Object for the Settings page (/settings)
 * Handles extraction settings and navigation to sub-settings pages
 */
export class SettingsPage {
  readonly page: Page
  readonly heading: Locator
  readonly loadingState: Locator

  // PDF Extraction Card
  readonly pdfExtractionCard: Locator
  readonly autoCreateArticlesSwitch: Locator
  readonly autoCreateArticlesLabel: Locator
  readonly autoThresholdDisplay: Locator
  readonly suggestionThresholdDisplay: Locator
  readonly saveButton: Locator

  // Supplier Recognition Card
  readonly supplierRecognitionCard: Locator
  readonly supplierIdentifiersLink: Locator
  readonly supplierBlocklistLink: Locator

  // Auto-Import Card
  readonly autoImportCard: Locator
  readonly importSourcesLink: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Einstellungen' })
    this.loadingState = page.locator('svg.lucide-loader2.animate-spin')

    // PDF Extraction Card - Cards have rounded-lg border classes
    // CardTitle renders as div, not heading, so we search by text content
    this.pdfExtractionCard = page.locator('div.rounded-lg.border').filter({
      hasText: 'PDF-Extraktion'
    }).first()
    this.autoCreateArticlesSwitch = page.locator('#auto-create-articles')
    this.autoCreateArticlesLabel = page.getByLabel('Neue Artikel automatisch anlegen')
    // Threshold displays are in a muted background box with flex layout
    this.autoThresholdDisplay = page.locator('div').filter({ hasText: /Auto-Zuordnung ab:/ }).locator('span.font-mono').first()
    this.suggestionThresholdDisplay = page.locator('div').filter({ hasText: /Vorschläge ab:/ }).locator('span.font-mono').first()
    this.saveButton = page.getByRole('button', { name: 'Speichern' })

    // Supplier Recognition Card
    this.supplierRecognitionCard = page.locator('div.rounded-lg.border').filter({
      hasText: 'Lieferanten-Erkennung'
    }).first()
    this.supplierIdentifiersLink = page.locator('a[href="/settings/supplier-identifiers"]')
    this.supplierBlocklistLink = page.locator('a[href="/settings/supplier-blocklist"]')

    // Auto-Import Card
    this.autoImportCard = page.locator('div.rounded-lg.border').filter({
      hasText: 'Auto-Import'
    }).first()
    this.importSourcesLink = page.locator('a[href="/settings/import-sources"]')
  }

  /**
   * Navigate to the settings page
   */
  async goto() {
    await this.page.goto('/settings')
    await this.waitForLoad()
  }

  /**
   * Wait for settings to load
   */
  async waitForLoad() {
    // Wait for loading spinner to disappear
    await expect(this.loadingState).not.toBeVisible({ timeout: 10000 }).catch(() => {})
    await expect(this.heading).toBeVisible()
  }

  /**
   * Toggle auto-create articles setting
   */
  async toggleAutoCreateArticles() {
    await this.autoCreateArticlesSwitch.click()
  }

  /**
   * Get current auto-create articles state
   */
  async isAutoCreateArticlesEnabled(): Promise<boolean> {
    return await this.autoCreateArticlesSwitch.isChecked()
  }

  /**
   * Enable auto-create articles
   */
  async enableAutoCreateArticles() {
    if (!(await this.isAutoCreateArticlesEnabled())) {
      await this.toggleAutoCreateArticles()
    }
  }

  /**
   * Disable auto-create articles
   */
  async disableAutoCreateArticles() {
    if (await this.isAutoCreateArticlesEnabled()) {
      await this.toggleAutoCreateArticles()
    }
  }

  /**
   * Save settings
   */
  async saveSettings() {
    await this.saveButton.click()

    // Wait for success toast
    await expect(
      this.page.locator('li[data-sonner-toast]').filter({ hasText: /gespeichert/i })
    ).toBeVisible({ timeout: 10000 })
  }

  /**
   * Get auto-threshold percentage
   */
  async getAutoThreshold(): Promise<number> {
    // The display shows percentage like "85%"
    const row = this.page.locator('div.flex.justify-between').filter({ hasText: /Auto-Zuordnung ab:/ })
    const text = await row.locator('span.font-mono').textContent()
    const match = text?.match(/(\d+)/)
    return match ? parseInt(match[1], 10) : 0
  }

  /**
   * Get suggestion threshold percentage
   */
  async getSuggestionThreshold(): Promise<number> {
    // The display shows percentage like "60%"
    const row = this.page.locator('div.flex.justify-between').filter({ hasText: /Vorschläge ab:/ })
    const text = await row.locator('span.font-mono').textContent()
    const match = text?.match(/(\d+)/)
    return match ? parseInt(match[1], 10) : 0
  }

  /**
   * Navigate to supplier identifiers page
   */
  async goToSupplierIdentifiers() {
    await this.supplierIdentifiersLink.click()
    await expect(this.page).toHaveURL(/\/settings\/supplier-identifiers/)
  }

  /**
   * Navigate to supplier blocklist page
   */
  async goToSupplierBlocklist() {
    await this.supplierBlocklistLink.click()
    await expect(this.page).toHaveURL(/\/settings\/supplier-blocklist/)
  }

  /**
   * Navigate to import sources page
   */
  async goToImportSources() {
    await this.importSourcesLink.click()
    await expect(this.page).toHaveURL(/\/settings\/import-sources/)
  }

  /**
   * Check if save button is enabled (has unsaved changes)
   */
  async hasUnsavedChanges(): Promise<boolean> {
    return await this.saveButton.isEnabled()
  }
}
