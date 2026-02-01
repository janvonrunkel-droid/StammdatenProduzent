import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page Object for the Duplicates page (/duplicates)
 * Handles duplicate detection, filtering, and exclusion
 */
export class DuplicatesPage {
  readonly page: Page
  readonly heading: Locator
  readonly refreshButton: Locator
  readonly thresholdSelect: Locator
  readonly tabAll: Locator
  readonly tabArticles: Locator
  readonly tabSuppliers: Locator
  readonly tabDocuments: Locator
  readonly duplicatesList: Locator
  readonly emptyState: Locator
  readonly loadingState: Locator
  readonly duplicateCount: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Duplikat-Erkennung' })
    this.refreshButton = page.getByRole('button', { name: /Aktualisieren/i })
    // Threshold select is inside a Card after the "Mindest-Ähnlichkeit" label
    this.thresholdSelect = page.locator('button[role="combobox"]').first()

    // Tabs contain text plus Badge counts
    this.tabAll = page.getByRole('tab', { name: /Alle/i })
    this.tabArticles = page.getByRole('tab', { name: /Artikel/i })
    this.tabSuppliers = page.getByRole('tab', { name: /Lieferanten/i })
    this.tabDocuments = page.getByRole('tab', { name: /Dokumente/i })

    // Content
    this.duplicatesList = page.locator('[role="tabpanel"]')
    // Empty state shows "Keine Duplikate gefunden" as h3 heading
    this.emptyState = page.getByRole('heading', { name: /Keine Duplikate gefunden/i })
    // Loading state - Skeleton uses animate-pulse class in Tailwind
    this.loadingState = page.locator('.animate-pulse, [data-loading="true"]')
    // Count shows "X potenzielle Duplikat(e) gefunden" - must match exact pattern with number
    this.duplicateCount = page.locator('p').filter({ hasText: /^\d+ potenzielle/i })
  }

  /**
   * Navigate to the duplicates page
   */
  async goto() {
    await this.page.goto('/duplicates')
    await expect(this.heading).toBeVisible()
  }

  /**
   * Wait for data to load
   */
  async waitForLoad() {
    // Wait for loading state to disappear
    await expect(this.loadingState.first()).not.toBeVisible({ timeout: 15000 }).catch(() => {})

    // Wait for either duplicate content or empty state to appear
    // Duplicate pairs are shown in divs with ArrowLeftRight icon or "Kein Duplikat" button
    const duplicateContent = this.page.locator('[role="tabpanel"]').getByRole('button', { name: /Kein Duplikat/i }).first()
    const emptyState = this.emptyState
    const duplicateCount = this.duplicateCount

    await Promise.race([
      expect(duplicateContent).toBeVisible({ timeout: 10000 }).catch(() => {}),
      expect(emptyState).toBeVisible({ timeout: 10000 }).catch(() => {}),
      expect(duplicateCount).toBeVisible({ timeout: 10000 }).catch(() => {}),
    ])

    await this.page.waitForTimeout(300)
  }

  /**
   * Refresh duplicates
   */
  async refresh() {
    await this.refreshButton.click()
    await this.waitForLoad()
  }

  /**
   * Set similarity threshold
   */
  async setThreshold(threshold: '70%' | '80%' | '85%' | '90%' | '95%') {
    await this.thresholdSelect.click()
    await this.page.getByRole('option', { name: threshold }).click()
    await this.waitForLoad()
  }

  /**
   * Switch to tab
   */
  async switchToTab(tab: 'all' | 'articles' | 'suppliers' | 'documents') {
    const tabLocators = {
      all: this.tabAll,
      articles: this.tabArticles,
      suppliers: this.tabSuppliers,
      documents: this.tabDocuments,
    }
    await tabLocators[tab].click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Get count of duplicates for a tab
   */
  async getTabCount(tab: 'all' | 'articles' | 'suppliers' | 'documents'): Promise<number> {
    const tabLocators = {
      all: this.tabAll,
      articles: this.tabArticles,
      suppliers: this.tabSuppliers,
      documents: this.tabDocuments,
    }
    // Badge is a span with the count number inside the tab
    const badge = tabLocators[tab].locator('span').filter({ hasText: /^\d+$/ }).first()
    const text = await badge.textContent().catch(() => '0')
    return parseInt(text || '0', 10)
  }

  /**
   * Get all duplicate pair cards - each pair has a "Kein Duplikat" button
   */
  getDuplicatePairs(): Locator {
    // Each duplicate pair is in a div containing the "Kein Duplikat" button
    return this.page.locator('[role="tabpanel"]').locator('div').filter({
      has: this.page.getByRole('button', { name: /Kein Duplikat/i })
    })
  }

  /**
   * Get a specific duplicate pair by entity names
   */
  getDuplicatePair(entityA: string, entityB: string): Locator {
    return this.getDuplicatePairs().filter({
      has: this.page.locator(`text="${entityA}"`),
    }).filter({
      has: this.page.locator(`text="${entityB}"`),
    })
  }

  /**
   * Get the similarity score for a duplicate pair
   */
  async getSimilarityScore(entityA: string, entityB: string): Promise<number> {
    const pair = this.getDuplicatePair(entityA, entityB)
    // Similarity is shown as a span with "XX%" format
    const badge = pair.locator('span').filter({ hasText: /^\d+%$/ })
    const text = await badge.textContent()
    const match = text?.match(/(\d+)/)
    return match ? parseInt(match[1], 10) : 0
  }

  /**
   * Get matching fields for a duplicate pair
   */
  async getMatchingFields(entityA: string, entityB: string): Promise<string[]> {
    const pair = this.getDuplicatePair(entityA, entityB)
    const fieldsText = await pair.locator('text=/Übereinstimmung in:/').textContent()
    if (!fieldsText) return []
    const match = fieldsText.match(/Übereinstimmung in: (.+)/)
    return match ? match[1].split(', ').map(f => f.trim()) : []
  }

  /**
   * Mark a pair as "not a duplicate" (exclude)
   */
  async excludePair(entityA: string, entityB: string) {
    const pair = this.getDuplicatePair(entityA, entityB)
    const excludeButton = pair.getByRole('button', { name: /Kein Duplikat/i })
    await excludeButton.click()

    // Wait for the pair to be removed from the list
    await expect(pair).not.toBeVisible({ timeout: 5000 })
  }

  /**
   * Check if there are any duplicates
   */
  async hasDuplicates(): Promise<boolean> {
    const count = await this.getDuplicatePairs().count()
    return count > 0
  }

  /**
   * Get total duplicate count from the text
   */
  async getDuplicateCount(): Promise<number> {
    if (await this.emptyState.isVisible().catch(() => false)) {
      return 0
    }
    const text = await this.duplicateCount.textContent()
    const match = text?.match(/(\d+)/)
    return match ? parseInt(match[1], 10) : 0
  }

  /**
   * Check if empty state is shown
   */
  async isEmptyStateVisible(): Promise<boolean> {
    return await this.emptyState.isVisible().catch(() => false)
  }

  /**
   * Get the entity type badge text for a pair
   */
  async getEntityType(entityA: string, entityB: string): Promise<string> {
    const pair = this.getDuplicatePair(entityA, entityB)
    // Entity type is shown as a span with "Artikel", "Lieferanten", or "Dokumente"
    const typeBadge = pair.locator('span').filter({ hasText: /^(Artikel|Lieferanten|Dokumente)$/i })
    return await typeBadge.textContent() || ''
  }
}
