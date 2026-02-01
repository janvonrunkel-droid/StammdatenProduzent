import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page Object for the Articles page (/articles)
 * Handles article CRUD operations, search, filtering, and view modes
 */
export class ArticlesPage {
  readonly page: Page
  readonly heading: Locator
  readonly newArticleButton: Locator
  readonly searchInput: Locator
  readonly articleCountText: Locator
  readonly articleTable: Locator
  readonly emptyState: Locator
  readonly sortDropdown: Locator
  readonly viewModeTable: Locator
  readonly viewModeGrid: Locator
  readonly exportButton: Locator
  readonly filterSidebar: Locator
  readonly filterDrawerButton: Locator
  readonly clearFiltersButton: Locator

  // Form dialog
  readonly formDialog: Locator
  readonly nameInput: Locator
  readonly articleNumberInput: Locator
  readonly descriptionInput: Locator
  readonly unitSelect: Locator
  readonly saveButton: Locator
  readonly cancelButton: Locator

  // Delete dialog
  readonly deleteDialog: Locator
  readonly deleteConfirmButton: Locator
  readonly deleteCancelButton: Locator

  constructor(page: Page) {
    this.page = page
    // Use level 1 heading to avoid matching "Keine Artikel gefunden" h3
    this.heading = page.getByRole('heading', { name: 'Artikel', level: 1 })
    this.newArticleButton = page.getByRole('button', { name: 'Neuer Artikel' })
    // Search uses ArticleSearchAutocomplete component
    this.searchInput = page.locator('input[placeholder*="Suchen"], input[placeholder*="suchen"]')
    // Article count shows "{total} Artikel" - visible on both mobile and desktop
    this.articleCountText = page.locator('p.text-muted-foreground').filter({ hasText: /^\d+ Artikel$/ }).first()
    this.articleTable = page.locator('table')
    this.emptyState = page.locator('div').filter({ hasText: /Noch keine Artikel|Keine Artikel gefunden/ })

    // Sort dropdown is a Select component with ArrowUpDown icon
    this.sortDropdown = page.locator('button[role="combobox"]').filter({ has: page.locator('svg.lucide-arrow-up-down') })
    // View mode buttons use TableIcon (lucide-table-2) and LayoutGrid (lucide-layout-grid)
    this.viewModeTable = page.locator('button').filter({ has: page.locator('svg.lucide-table-2, svg.lucide-table') }).first()
    this.viewModeGrid = page.locator('button').filter({ has: page.locator('svg.lucide-layout-grid') })
    this.exportButton = page.getByRole('button', { name: /Export/i })

    // Filters
    this.filterSidebar = page.locator('[class*="FilterSidebar"]').or(
      page.locator('aside').filter({ hasText: /Filter|Tags/i })
    )
    this.filterDrawerButton = page.getByRole('button', { name: /Filter/i })
    this.clearFiltersButton = page.getByRole('button', { name: /Filter zurücksetzen/i })

    // Form dialog elements
    this.formDialog = page.getByRole('dialog')
    this.nameInput = this.formDialog.getByLabel('Name')
    this.articleNumberInput = this.formDialog.getByLabel(/Artikelnummer|Art.-Nr/i)
    this.descriptionInput = this.formDialog.getByLabel('Beschreibung')
    this.unitSelect = this.formDialog.getByRole('combobox').filter({ hasText: /Einheit/i })
    this.saveButton = this.formDialog.getByRole('button', { name: /Speichern|Anlegen/i })
    this.cancelButton = this.formDialog.getByRole('button', { name: 'Abbrechen' })

    // Delete dialog elements
    this.deleteDialog = page.getByRole('alertdialog')
    this.deleteConfirmButton = this.deleteDialog.getByRole('button', { name: /Löschen/i })
    this.deleteCancelButton = this.deleteDialog.getByRole('button', { name: 'Abbrechen' })
  }

  /**
   * Navigate to the articles page
   */
  async goto() {
    await this.page.goto('/articles')
    await expect(this.heading).toBeVisible()
  }

  /**
   * Get the count of articles shown
   */
  async getArticleCount(): Promise<number> {
    // Try to find any paragraph showing "X Artikel"
    const countLocator = this.page.locator('p').filter({ hasText: /\d+ Artikel/ }).first()
    try {
      await countLocator.waitFor({ state: 'visible', timeout: 5000 })
      const countText = await countLocator.textContent()
      const match = countText?.match(/(\d+)/)
      return match ? parseInt(match[1], 10) : 0
    } catch {
      // If no count text, might be empty or still loading
      return 0
    }
  }

  /**
   * Search for articles
   */
  async search(query: string) {
    await this.searchInput.fill(query)
    // Wait for debounced search
    await this.page.waitForTimeout(400)
  }

  /**
   * Clear the search input
   */
  async clearSearch() {
    await this.searchInput.clear()
    await this.page.waitForTimeout(400)
  }

  /**
   * Open the new article dialog
   */
  async openNewArticleDialog() {
    await this.newArticleButton.click()
    await expect(this.formDialog).toBeVisible()
  }

  /**
   * Fill the article form
   */
  async fillArticleForm(data: {
    name: string
    articleNumber?: string
    description?: string
    unit?: string
  }) {
    await this.nameInput.fill(data.name)
    if (data.articleNumber) await this.articleNumberInput.fill(data.articleNumber)
    if (data.description) await this.descriptionInput.fill(data.description)
    if (data.unit) {
      await this.unitSelect.click()
      await this.page.getByRole('option', { name: data.unit }).click()
    }
  }

  /**
   * Submit the article form
   */
  async submitForm() {
    await this.saveButton.click()
  }

  /**
   * Create a new article
   */
  async createArticle(data: {
    name: string
    articleNumber?: string
    description?: string
    unit?: string
  }) {
    await this.openNewArticleDialog()
    await this.fillArticleForm(data)
    await this.submitForm()

    // Wait for success toast - Sonner uses li[data-sonner-toast] or [data-sonner-toast]
    // Also check for the toast container with different selectors
    const toastLocator = this.page.locator('[data-sonner-toast]').filter({ hasText: /angelegt|wurde angelegt/i }).first()
    await expect(toastLocator).toBeVisible({ timeout: 20000 })

    // Wait for dialog to close
    await expect(this.formDialog).not.toBeVisible({ timeout: 5000 })
  }

  /**
   * Get an article row by name
   */
  getArticleRow(name: string): Locator {
    return this.page.locator('tr').filter({ hasText: name })
  }

  /**
   * Get an article card by name (grid view)
   */
  getArticleCard(name: string): Locator {
    // In grid view, articles are shown in div containers with the article name
    return this.page.locator('div').filter({ hasText: name }).filter({
      has: this.page.locator('text=/Art.-Nr|Artikelnummer/i')
    }).first()
  }

  /**
   * Click edit button for an article
   */
  async editArticle(name: string) {
    const row = this.getArticleRow(name)
    await row.getByRole('button', { name: /Bearbeiten/i }).or(
      row.locator('button').filter({ has: this.page.locator('svg.lucide-pencil, svg.lucide-edit') })
    ).click()
    await expect(this.formDialog).toBeVisible()
  }

  /**
   * Update an article
   */
  async updateArticle(currentName: string, newData: {
    name?: string
    articleNumber?: string
    description?: string
    unit?: string
  }) {
    await this.editArticle(currentName)

    if (newData.name) await this.nameInput.fill(newData.name)
    if (newData.articleNumber) await this.articleNumberInput.fill(newData.articleNumber)
    if (newData.description) await this.descriptionInput.fill(newData.description)
    if (newData.unit) {
      await this.unitSelect.click()
      await this.page.getByRole('option', { name: newData.unit }).click()
    }

    await this.submitForm()

    // Wait for success toast
    await expect(
      this.page.locator('[data-sonner-toast]').filter({ hasText: /gespeichert|Änderungen gespeichert/i }).first()
    ).toBeVisible({ timeout: 20000 })

    await expect(this.formDialog).not.toBeVisible({ timeout: 5000 })
  }

  /**
   * Click delete button for an article
   */
  async clickDeleteArticle(name: string) {
    const row = this.getArticleRow(name)
    await row.getByRole('button', { name: /Löschen/i }).or(
      row.locator('button').filter({ has: this.page.locator('svg.lucide-trash') })
    ).click()
    await expect(this.deleteDialog).toBeVisible()
  }

  /**
   * Confirm article deletion
   */
  async confirmDelete() {
    await this.deleteConfirmButton.click()

    // Wait for success toast
    await expect(
      this.page.locator('[data-sonner-toast]').filter({ hasText: /gelöscht|Artikel gelöscht/i }).first()
    ).toBeVisible({ timeout: 20000 })

    await expect(this.deleteDialog).not.toBeVisible({ timeout: 5000 })
  }

  /**
   * Delete an article
   */
  async deleteArticle(name: string) {
    await this.clickDeleteArticle(name)
    await this.confirmDelete()
  }

  /**
   * Cancel deletion
   */
  async cancelDelete() {
    await this.deleteCancelButton.click()
    await expect(this.deleteDialog).not.toBeVisible()
  }

  /**
   * Check if article exists in the list
   */
  async articleExists(name: string): Promise<boolean> {
    const row = this.getArticleRow(name)
    return await row.isVisible().catch(() => false)
  }

  /**
   * Wait for data to load
   */
  async waitForLoad() {
    // Wait for either table, article count text, or empty state to appear
    const table = this.articleTable
    const emptyState = this.page.locator('div').filter({ hasText: /Noch keine Artikel|Keine Artikel gefunden/ }).first()
    const articleCount = this.page.locator('p').filter({ hasText: /\d+ Artikel/ }).first()

    await Promise.race([
      expect(table).toBeVisible({ timeout: 10000 }).catch(() => {}),
      expect(emptyState).toBeVisible({ timeout: 10000 }).catch(() => {}),
      expect(articleCount).toBeVisible({ timeout: 10000 }).catch(() => {}),
    ])

    // Small delay to ensure data is rendered
    await this.page.waitForTimeout(200)
  }

  /**
   * Switch to table view
   */
  async switchToTableView() {
    await this.viewModeTable.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Switch to grid view
   */
  async switchToGridView() {
    await this.viewModeGrid.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Sort articles using the Select dropdown
   */
  async sortBy(option: 'name' | '-name' | 'article_number' | '-article_number' | 'updated_at' | '-updated_at' | 'price_asc' | 'price_desc') {
    await this.sortDropdown.click()
    const optionLabels: Record<string, string> = {
      'name': 'Name (A-Z)',
      '-name': 'Name (Z-A)',
      'article_number': 'Art.-Nr. (A-Z)',
      '-article_number': 'Art.-Nr. (Z-A)',
      '-updated_at': 'Aktualisiert (neu)',
      'updated_at': 'Aktualisiert (alt)',
      'price_asc': 'Preis (günstig)',
      'price_desc': 'Preis (teuer)',
    }
    await this.page.getByRole('option', { name: optionLabels[option] }).click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Filter by tag
   */
  async filterByTag(tagName: string) {
    const tagCheckbox = this.page.locator('label').filter({ hasText: tagName }).getByRole('checkbox')
    await tagCheckbox.check()
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
   * Navigate to article detail page
   */
  async goToArticleDetail(name: string) {
    const row = this.getArticleRow(name)
    await row.getByRole('link').first().click()
    await expect(this.page).toHaveURL(/\/articles\//)
  }

  /**
   * Export articles
   */
  async exportArticles(format: 'csv' | 'xlsx' = 'csv') {
    await this.exportButton.click()
    const formatButton = this.page.getByRole('menuitem', { name: new RegExp(format, 'i') })
    if (await formatButton.isVisible()) {
      await formatButton.click()
    }
  }
}
