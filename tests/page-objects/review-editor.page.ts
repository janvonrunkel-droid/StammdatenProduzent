import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page Object for the Review Editor page (/review/[id])
 * Handles extraction review, editing, approval, and rejection
 */
export class ReviewEditorPage {
  readonly page: Page
  readonly backButton: Locator
  readonly saveButton: Locator
  readonly rejectButton: Locator
  readonly approveButton: Locator
  readonly pdfViewer: Locator
  readonly editorPanel: Locator
  readonly supplierSelect: Locator
  readonly documentDateInput: Locator
  readonly documentNumberInput: Locator
  readonly positionsTable: Locator
  readonly addPositionButton: Locator
  readonly approveDialog: Locator
  readonly rejectDialog: Locator
  readonly confidenceBadge: Locator
  readonly saveStatus: Locator

  constructor(page: Page) {
    this.page = page
    this.backButton = page.getByRole('button', { name: /Zurück/i })
    this.saveButton = page.getByRole('button', { name: /Speichern/i })
    this.rejectButton = page.getByRole('button', { name: /Ablehnen/i })
    this.approveButton = page.getByRole('button', { name: /Übernehmen/i })
    this.pdfViewer = page.locator('[data-testid="pdf-viewer"]').or(
      page.locator('.pdf-viewer, [class*="pdf-viewer"], iframe, canvas').first()
    )
    this.editorPanel = page.locator('[data-testid="editor-panel"]').or(
      page.locator('[class*="ResizablePanel"]').last()
    )
    this.supplierSelect = page.getByRole('combobox').filter({ hasText: /Lieferant/i }).or(
      page.locator('label:has-text("Lieferant") + button, label:has-text("Lieferant") ~ button')
    )
    this.documentDateInput = page.getByLabel(/Datum/i)
    this.documentNumberInput = page.getByLabel(/Nummer|Belegnummer/i)
    this.positionsTable = page.locator('table').filter({ hasText: /Artikel|Position|Menge/i })
    this.addPositionButton = page.getByRole('button', { name: /Position hinzufügen/i })
    this.approveDialog = page.getByRole('alertdialog').filter({ hasText: /übernehmen/i })
    this.rejectDialog = page.getByRole('dialog').filter({ hasText: /ablehnen/i })
    // Confidence is shown as a span with "XX% Konfidenz"
    this.confidenceBadge = page.locator('span').filter({ hasText: /\d+% Konfidenz/i })
    this.saveStatus = page.getByText(/Gespeichert|Speichert|Ungespeicherte Änderungen/i)
  }

  /**
   * Navigate to a specific review page
   */
  async goto(extractionId: string) {
    await this.page.goto(`/review/${extractionId}`)
    await this.waitForLoad()
  }

  /**
   * Wait for the review editor to fully load
   */
  async waitForLoad() {
    // Wait for either the editor content or error state
    await Promise.race([
      expect(this.approveButton).toBeVisible({ timeout: 15000 }),
      expect(this.page.getByText(/nicht gefunden/i)).toBeVisible({ timeout: 15000 }),
    ])
  }

  /**
   * Get the current confidence score
   */
  async getConfidenceScore(): Promise<number | null> {
    try {
      const badgeText = await this.confidenceBadge.textContent()
      const match = badgeText?.match(/(\d+)/)
      return match ? parseInt(match[1], 10) : null
    } catch {
      return null
    }
  }

  /**
   * Select a supplier from the dropdown
   */
  async selectSupplier(supplierName: string) {
    // Find and click the supplier combobox
    const supplierCombo = this.page
      .locator('div')
      .filter({ hasText: /^Lieferant/ })
      .getByRole('combobox')

    await supplierCombo.click()
    await this.page.getByRole('option', { name: supplierName }).click()
  }

  /**
   * Set the document date
   */
  async setDocumentDate(date: string) {
    await this.documentDateInput.fill(date)
  }

  /**
   * Set the document number
   */
  async setDocumentNumber(number: string) {
    await this.documentNumberInput.fill(number)
  }

  /**
   * Get all position rows from the table
   */
  getPositionRows(): Locator {
    return this.positionsTable.locator('tbody tr')
  }

  /**
   * Get a specific position row by index (0-based)
   */
  getPositionRow(index: number): Locator {
    return this.getPositionRows().nth(index)
  }

  /**
   * Edit a position field
   */
  async editPosition(
    index: number,
    field: 'name' | 'number' | 'quantity' | 'unit' | 'price',
    value: string
  ) {
    const row = this.getPositionRow(index)
    const fieldLocators: Record<string, Locator> = {
      name: row.getByRole('textbox').first(),
      number: row.locator('input[name*="number"], input[placeholder*="Nummer"]'),
      quantity: row.locator('input[type="number"]').first(),
      unit: row.getByRole('combobox'),
      price: row.locator('input[type="number"]').last(),
    }

    await fieldLocators[field].fill(value)
  }

  /**
   * Assign an article to a position
   */
  async assignArticle(positionIndex: number, articleName: string) {
    const row = this.getPositionRow(positionIndex)
    const assignButton = row.getByRole('button', { name: /zuordnen|artikel/i })
    await assignButton.click()

    // Wait for article assignment modal
    const modal = this.page.getByRole('dialog').filter({ hasText: /Artikel/i })
    await expect(modal).toBeVisible()

    // Search and select article
    await modal.getByRole('textbox').fill(articleName)
    await this.page.waitForTimeout(500)
    await modal.getByRole('option', { name: articleName }).or(
      modal.locator('[role="listbox"] > *').filter({ hasText: articleName }).first()
    ).click()

    // Confirm selection
    const confirmButton = modal.getByRole('button', { name: /übernehmen|zuordnen|bestätigen/i })
    if (await confirmButton.isVisible()) {
      await confirmButton.click()
    }
  }

  /**
   * Accept an article suggestion for a position
   */
  async acceptSuggestion(positionIndex: number) {
    const row = this.getPositionRow(positionIndex)
    const acceptButton = row.getByRole('button', { name: /übernehmen|vorschlag/i }).or(
      row.locator('button').filter({ has: this.page.locator('svg.check') })
    )
    await acceptButton.click()
  }

  /**
   * Delete a position
   */
  async deletePosition(positionIndex: number) {
    const row = this.getPositionRow(positionIndex)
    const deleteButton = row.getByRole('button', { name: /löschen|entfernen/i }).or(
      row.locator('button').filter({ has: this.page.locator('svg.trash, svg.x') })
    )
    await deleteButton.click()
  }

  /**
   * Add a new position
   */
  async addPosition() {
    await this.addPositionButton.click()
  }

  /**
   * Save the current draft
   */
  async saveDraft() {
    await this.saveButton.click()
    await expect(this.page.getByText(/Gespeichert/i)).toBeVisible({ timeout: 10000 })
  }

  /**
   * Approve the extraction (opens confirmation dialog)
   */
  async approve() {
    await this.approveButton.click()

    // Wait for either confirmation dialog or direct navigation
    await this.page.waitForTimeout(500)
  }

  /**
   * Confirm approval in the dialog (if present)
   */
  async confirmApprove() {
    // Look for any confirmation dialog
    const dialog = this.page.getByRole('alertdialog')
    const confirmBtn = dialog.getByRole('button', { name: /Übernehmen/i })

    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click()
    }

    // Wait for navigation back to review queue
    await expect(this.page).toHaveURL(/\/review(?!\/)/, { timeout: 15000 })
  }

  /**
   * Approve and confirm in one step
   */
  async approveAndConfirm() {
    await this.approve()
    await this.confirmApprove()
  }

  /**
   * Reject the extraction
   */
  async reject(reason?: string, comment?: string) {
    await this.rejectButton.click()
    await expect(this.rejectDialog).toBeVisible()

    if (reason) {
      await this.rejectDialog.getByRole('combobox').click()
      await this.page.getByRole('option', { name: new RegExp(reason, 'i') }).click()
    }

    if (comment) {
      await this.rejectDialog.getByRole('textbox').fill(comment)
    }
  }

  /**
   * Confirm rejection in the dialog
   */
  async confirmReject() {
    await this.rejectDialog.getByRole('button', { name: /Ablehnen/i }).click()

    // Wait for navigation back to review queue
    await expect(this.page).toHaveURL(/\/review(?!\/)/, { timeout: 15000 })
  }

  /**
   * Go back to the review queue
   */
  async goBack() {
    await this.backButton.click()
    await expect(this.page).toHaveURL(/\/review(?!\/)/, { timeout: 5000 })
  }

  /**
   * Check if there are unassigned positions
   */
  async hasUnassignedPositions(): Promise<boolean> {
    const unassignedIndicator = this.page.getByText(/nicht zugeordnet|keinem Artikel/i)
    return await unassignedIndicator.isVisible().catch(() => false)
  }

  /**
   * Get the number of positions
   */
  async getPositionCount(): Promise<number> {
    return await this.getPositionRows().count()
  }

  /**
   * Check if the editor has unsaved changes
   */
  async hasUnsavedChanges(): Promise<boolean> {
    return await this.page.getByText(/Ungespeicherte Änderungen/i).isVisible()
  }
}
