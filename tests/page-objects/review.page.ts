import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page Object for the Review Queue page (/review)
 * Handles review queue filtering, sorting, and navigation to review editor
 */
export class ReviewPage {
  readonly page: Page
  readonly heading: Locator
  readonly documentCount: Locator
  readonly searchInput: Locator
  readonly supplierFilter: Locator
  readonly confidenceFilter: Locator
  readonly dateRangePicker: Locator
  readonly sortDropdown: Locator
  readonly clearFiltersButton: Locator
  readonly reviewTable: Locator
  readonly emptyState: Locator
  readonly loadingState: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: /Review-Queue/i })
    this.documentCount = page.locator('span').filter({ hasText: /\d+ Dokumente? zur Prüfung/ })

    // Filters - these are inside the ReviewQueueFilters component
    this.searchInput = page.getByPlaceholder(/Nach Dokument suchen/i)
    // Supplier filter is the first Select (placeholder "Lieferant")
    this.supplierFilter = page.locator('button[role="combobox"]').filter({ hasText: /Lieferant|Alle Lieferanten/i }).first()
    // Confidence filter is the second Select (placeholder "Konfidenz")
    this.confidenceFilter = page.locator('button[role="combobox"]').filter({ hasText: /Konfidenz|Alle Konfidenz/i }).first()
    // Date range is a button with calendar icon showing "Zeitraum" or a date
    this.dateRangePicker = page.locator('button').filter({ has: page.locator('svg.lucide-calendar') })
    // Sort dropdown is separate from filters
    this.sortDropdown = page.locator('button[role="combobox"]').filter({ hasText: /zuerst/i })
    this.clearFiltersButton = page.getByRole('button', { name: /Filter zurücksetzen/i })

    // Content
    this.reviewTable = page.locator('table')
    this.emptyState = page.locator('div').filter({ hasText: /Keine Dokumente zur Prüfung/i })
    // Loading state - Skeleton uses animate-pulse class in Tailwind
    this.loadingState = page.locator('.animate-pulse, [data-loading="true"]')
  }

  /**
   * Navigate to the review queue page
   */
  async goto() {
    await this.page.goto('/review')
    await expect(this.heading).toBeVisible()
  }

  /**
   * Wait for data to load
   */
  async waitForLoad() {
    await Promise.race([
      expect(this.reviewTable).toBeVisible({ timeout: 15000 }),
      expect(this.emptyState).toBeVisible({ timeout: 15000 }),
    ])
  }

  /**
   * Get the count of documents in the review queue
   */
  async getDocumentCount(): Promise<number> {
    // The count is displayed in the header as "{total} Dokument{e} zur Prüfung"
    const countLocator = this.page.locator('span').filter({ hasText: /\d+ Dokumente? zur Prüfung/ })
    try {
      await countLocator.waitFor({ state: 'visible', timeout: 5000 })
      const text = await countLocator.textContent()
      const match = text?.match(/(\d+)/)
      return match ? parseInt(match[1], 10) : 0
    } catch {
      return 0
    }
  }

  /**
   * Search for documents
   */
  async search(query: string) {
    await this.searchInput.fill(query)
    await this.page.waitForTimeout(400)
  }

  /**
   * Clear search
   */
  async clearSearch() {
    await this.searchInput.clear()
    await this.page.waitForTimeout(400)
  }

  /**
   * Filter by supplier
   */
  async filterBySupplier(supplierName: string) {
    await this.supplierFilter.click()
    await this.page.getByRole('option', { name: supplierName }).click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Filter by confidence level
   */
  async filterByConfidence(level: 'low' | 'medium' | 'high' | 'all') {
    const levelLabels: Record<string, string> = {
      low: 'Niedrig (<70%)',
      medium: 'Mittel (70-90%)',
      high: 'Hoch (>90%)',
      all: 'Alle Konfidenz',
    }
    await this.confidenceFilter.click()
    await this.page.getByRole('option', { name: new RegExp(levelLabels[level].replace(/[()%<>]/g, '.')) }).click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Sort the review queue
   */
  async sortBy(option: 'confidence_asc' | 'confidence_desc' | 'date_asc' | 'date_desc') {
    const optionLabels: Record<string, string> = {
      confidence_asc: 'Niedrigste Konfidenz zuerst',
      confidence_desc: 'Höchste Konfidenz zuerst',
      date_asc: 'Älteste zuerst',
      date_desc: 'Neueste zuerst',
    }
    await this.sortDropdown.click()
    await this.page.getByRole('option', { name: optionLabels[option] }).click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Clear all filters
   */
  async clearFilters() {
    if (await this.clearFiltersButton.isVisible()) {
      await this.clearFiltersButton.click()
      await this.page.waitForTimeout(300)
    }
  }

  /**
   * Get all review queue rows
   */
  getReviewRows(): Locator {
    return this.reviewTable.locator('tbody tr')
  }

  /**
   * Get a review row by document filename
   */
  getReviewRow(filename: string): Locator {
    return this.reviewTable.locator('tbody tr').filter({ hasText: filename })
  }

  /**
   * Open review editor for a document
   */
  async openReview(filename: string) {
    const row = this.getReviewRow(filename)
    const reviewButton = row.getByRole('button', { name: /Review/i }).or(
      row.getByRole('link', { name: /Review/i })
    )
    await reviewButton.click()
    await expect(this.page).toHaveURL(/\/review\//)
  }

  /**
   * Open the first review item
   */
  async openFirstReview() {
    const firstRow = this.getReviewRows().first()
    const reviewButton = firstRow.getByRole('button', { name: /Review/i }).or(
      firstRow.getByRole('link', { name: /Review/i })
    )
    await reviewButton.click()
    await expect(this.page).toHaveURL(/\/review\//)
  }

  /**
   * Get confidence score for a document
   */
  async getConfidenceScore(filename: string): Promise<number> {
    const row = this.getReviewRow(filename)
    // The confidence badge shows "{percentage}%" with a colored background
    const confidenceCell = row.locator('td').last().locator('span').filter({ hasText: /%/ })
    const text = await confidenceCell.textContent()
    const match = text?.match(/(\d+)/)
    return match ? parseInt(match[1], 10) : 0
  }

  /**
   * Get supplier name for a document
   */
  async getSupplierName(filename: string): Promise<string> {
    const row = this.getReviewRow(filename)
    // Assuming supplier is in the second column or has specific styling
    const supplierCell = row.locator('td').nth(1)
    return await supplierCell.textContent() || ''
  }

  /**
   * Check if review queue is empty
   */
  async isQueueEmpty(): Promise<boolean> {
    return await this.emptyState.isVisible().catch(() => false)
  }

  /**
   * Get count of visible review items
   */
  async getVisibleItemCount(): Promise<number> {
    return await this.getReviewRows().count()
  }

  /**
   * Check if has active filters
   */
  async hasActiveFilters(): Promise<boolean> {
    return await this.clearFiltersButton.isVisible().catch(() => false)
  }
}
