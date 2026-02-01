import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page Object for the Suppliers page (/suppliers)
 * Handles supplier CRUD operations and search functionality
 */
export class SuppliersPage {
  readonly page: Page
  readonly heading: Locator
  readonly newSupplierButton: Locator
  readonly searchInput: Locator
  readonly supplierCountText: Locator
  readonly supplierTable: Locator
  readonly emptyState: Locator
  readonly loadingState: Locator

  // Form dialog
  readonly formDialog: Locator
  readonly nameInput: Locator
  readonly emailInput: Locator
  readonly phoneInput: Locator
  readonly addressInput: Locator
  readonly notesInput: Locator
  readonly saveButton: Locator
  readonly cancelButton: Locator

  // Delete dialog
  readonly deleteDialog: Locator
  readonly deleteConfirmButton: Locator
  readonly deleteCancelButton: Locator

  constructor(page: Page) {
    this.page = page
    // Use level 1 heading to avoid matching "Keine Lieferanten gefunden" h3
    this.heading = page.getByRole('heading', { name: 'Lieferanten', level: 1 })
    this.newSupplierButton = page.getByRole('button', { name: 'Neuer Lieferant' })
    this.searchInput = page.getByPlaceholder('Lieferanten suchen...')
    this.supplierCountText = page.locator('p').filter({ hasText: /^\d+ Lieferant/ })
    this.supplierTable = page.locator('table')
    this.emptyState = page.locator('div').filter({ hasText: /Noch keine Lieferanten|Keine Lieferanten gefunden/ })
    // Loading state - Skeleton uses animate-pulse class in Tailwind
    this.loadingState = page.locator('.animate-pulse, [data-loading="true"]')

    // Form dialog elements
    this.formDialog = page.getByRole('dialog')
    this.nameInput = page.getByLabel('Name')
    this.emailInput = page.getByLabel('E-Mail')
    this.phoneInput = page.getByLabel('Telefon')
    this.addressInput = page.getByLabel('Adresse')
    this.notesInput = page.getByLabel('Notizen')
    this.saveButton = page.getByRole('button', { name: /Speichern|Anlegen/i })
    this.cancelButton = page.getByRole('button', { name: 'Abbrechen' })

    // Delete dialog elements
    this.deleteDialog = page.getByRole('alertdialog')
    this.deleteConfirmButton = this.deleteDialog.getByRole('button', { name: /Löschen/i })
    this.deleteCancelButton = this.deleteDialog.getByRole('button', { name: 'Abbrechen' })
  }

  /**
   * Navigate to the suppliers page
   */
  async goto() {
    await this.page.goto('/suppliers')
    await expect(this.heading).toBeVisible()
  }

  /**
   * Get the count of suppliers shown
   */
  async getSupplierCount(): Promise<number> {
    const countText = await this.supplierCountText.textContent()
    const match = countText?.match(/(\d+)/)
    return match ? parseInt(match[1], 10) : 0
  }

  /**
   * Search for suppliers
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
   * Open the new supplier dialog
   */
  async openNewSupplierDialog() {
    await this.newSupplierButton.click()
    await expect(this.formDialog).toBeVisible()
  }

  /**
   * Fill the supplier form
   */
  async fillSupplierForm(data: {
    name: string
    email?: string
    phone?: string
    address?: string
    notes?: string
  }) {
    await this.nameInput.fill(data.name)
    if (data.email) await this.emailInput.fill(data.email)
    if (data.phone) await this.phoneInput.fill(data.phone)
    if (data.address) await this.addressInput.fill(data.address)
    if (data.notes) await this.notesInput.fill(data.notes)
  }

  /**
   * Submit the supplier form
   */
  async submitForm() {
    await this.saveButton.click()
  }

  /**
   * Create a new supplier
   */
  async createSupplier(data: {
    name: string
    email?: string
    phone?: string
    address?: string
    notes?: string
  }) {
    await this.openNewSupplierDialog()
    await this.fillSupplierForm(data)
    await this.submitForm()

    // Wait for success toast - use [data-sonner-toast] selector
    await expect(
      this.page.locator('[data-sonner-toast]').filter({ hasText: /angelegt|erstellt|wurde angelegt/i }).first()
    ).toBeVisible({ timeout: 20000 })

    // Wait for dialog to close
    await expect(this.formDialog).not.toBeVisible({ timeout: 5000 })
  }

  /**
   * Get a supplier row by name
   */
  getSupplierRow(name: string): Locator {
    return this.page.locator('tr').filter({ hasText: name })
  }

  /**
   * Click edit button for a supplier
   */
  async editSupplier(name: string) {
    const row = this.getSupplierRow(name)
    await row.getByRole('button', { name: /Bearbeiten/i }).or(
      row.locator('button').filter({ has: this.page.locator('svg.lucide-pencil, svg.lucide-edit') })
    ).click()
    await expect(this.formDialog).toBeVisible()
  }

  /**
   * Update a supplier
   */
  async updateSupplier(currentName: string, newData: {
    name?: string
    email?: string
    phone?: string
    address?: string
    notes?: string
  }) {
    await this.editSupplier(currentName)

    if (newData.name) await this.nameInput.fill(newData.name)
    if (newData.email) await this.emailInput.fill(newData.email)
    if (newData.phone) await this.phoneInput.fill(newData.phone)
    if (newData.address) await this.addressInput.fill(newData.address)
    if (newData.notes) await this.notesInput.fill(newData.notes)

    await this.submitForm()

    // Wait for success toast
    await expect(
      this.page.locator('[data-sonner-toast]').filter({ hasText: /gespeichert|Änderungen gespeichert/i }).first()
    ).toBeVisible({ timeout: 20000 })

    await expect(this.formDialog).not.toBeVisible({ timeout: 5000 })
  }

  /**
   * Click delete button for a supplier
   */
  async clickDeleteSupplier(name: string) {
    const row = this.getSupplierRow(name)
    await row.getByRole('button', { name: /Löschen/i }).or(
      row.locator('button').filter({ has: this.page.locator('svg.lucide-trash') })
    ).click()
    await expect(this.deleteDialog).toBeVisible()
  }

  /**
   * Confirm supplier deletion
   */
  async confirmDelete() {
    await this.deleteConfirmButton.click()

    // Wait for success toast
    await expect(
      this.page.locator('[data-sonner-toast]').filter({ hasText: /gelöscht|Lieferant gelöscht/i }).first()
    ).toBeVisible({ timeout: 20000 })

    await expect(this.deleteDialog).not.toBeVisible({ timeout: 5000 })
  }

  /**
   * Delete a supplier
   */
  async deleteSupplier(name: string) {
    await this.clickDeleteSupplier(name)
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
   * Check if supplier exists in the table
   */
  async supplierExists(name: string): Promise<boolean> {
    const row = this.getSupplierRow(name)
    return await row.isVisible().catch(() => false)
  }

  /**
   * Wait for data to load
   */
  async waitForLoad() {
    // Wait for loading state to disappear or table to appear
    await Promise.race([
      expect(this.supplierTable).toBeVisible({ timeout: 10000 }),
      expect(this.emptyState).toBeVisible({ timeout: 10000 }),
    ])
  }

  /**
   * Sort suppliers by name
   */
  async sortByName() {
    const sortHeader = this.page.getByRole('columnheader', { name: /Name/i })
    await sortHeader.click()
    await this.page.waitForTimeout(300)
  }

  /**
   * Navigate to supplier detail page
   */
  async goToSupplierDetail(name: string) {
    const row = this.getSupplierRow(name)
    await row.getByRole('link').first().click()
    await expect(this.page).toHaveURL(/\/suppliers\//)
  }
}
