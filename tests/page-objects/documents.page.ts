import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page Object for the Documents page (/documents)
 * Handles PDF upload, extraction, and document management
 */
export class DocumentsPage {
  readonly page: Page
  readonly heading: Locator
  readonly uploadButton: Locator
  readonly uploadDialog: Locator
  readonly fileDropzone: Locator
  readonly documentTypeSelect: Locator
  readonly uploadSubmitButton: Locator
  readonly documentTable: Locator
  readonly batchExtractButton: Locator
  readonly searchInput: Locator
  readonly statusFilter: Locator
  readonly typeFilter: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Dokumente' })
    this.uploadButton = page.getByRole('button', { name: 'Hochladen' })
    this.uploadDialog = page.getByRole('dialog')
    this.fileDropzone = page.locator('[data-testid="file-dropzone"]').or(
      page.locator('.dropzone').or(page.locator('[class*="dropzone"]'))
    )
    this.documentTypeSelect = page.getByRole('combobox').filter({ hasText: /Typ|Rechnung|Angebot/i })
    this.uploadSubmitButton = page.getByRole('button', { name: /hochladen/i }).last()
    this.documentTable = page.locator('table').or(page.locator('[role="table"]'))
    this.batchExtractButton = page.getByRole('button', { name: /Alle extrahieren/i })
    this.searchInput = page.getByPlaceholder(/Nach Nummer suchen/i)
    // Status and Type filters are Select components
    this.statusFilter = page.locator('button[role="combobox"]').filter({ hasText: /Status|Alle Status/i })
    this.typeFilter = page.locator('button[role="combobox"]').filter({ hasText: /Typ|Alle Typen/i })
  }

  /**
   * Navigate to the documents page
   */
  async goto() {
    await this.page.goto('/documents')
    await expect(this.heading).toBeVisible()
  }

  /**
   * Open the upload dialog
   */
  async openUploadDialog() {
    await this.uploadButton.click()
    await expect(this.uploadDialog).toBeVisible()
  }

  /**
   * Upload a PDF file
   * @param filePath - Path to the PDF file to upload
   * @param documentType - Optional document type (invoice, quote)
   */
  async uploadPdf(filePath: string, documentType?: 'invoice' | 'quote') {
    await this.openUploadDialog()

    // Set file input (hidden input)
    const fileInput = this.page.locator('input[type="file"]')
    await fileInput.setInputFiles(filePath)

    // Wait for file to be recognized
    await this.page.waitForTimeout(500)

    // Select document type if specified
    if (documentType) {
      const typeLabel = documentType === 'invoice' ? 'Rechnung' : 'Angebot'
      await this.page.getByRole('combobox').first().click()
      await this.page.getByRole('option', { name: typeLabel }).click()
    }

    // Submit upload
    await this.page.getByRole('button', { name: /hochladen/i }).last().click()

    // Wait for success toast (look for "Dokument hochgeladen" in toast area)
    await expect(
      this.page.locator('[data-sonner-toast]').filter({ hasText: /hochgeladen/i }).first()
    ).toBeVisible({ timeout: 30000 })

    // Wait for dialog to close
    await expect(this.uploadDialog).not.toBeVisible({ timeout: 5000 })
  }

  /**
   * Get a document row by filename
   */
  getDocumentRow(filename: string): Locator {
    return this.page.locator('tr, [role="row"]').filter({ hasText: filename })
  }

  /**
   * Click the extract button for a specific document by filename
   */
  async extractDocument(filename: string) {
    const row = this.getDocumentRow(filename)
    const extractButton = row.getByRole('button', { name: /extrahieren/i })
    await extractButton.click()
    await this.page.waitForTimeout(1000)
  }

  /**
   * Get the first pending document row (status "Ausstehend")
   */
  getFirstPendingDocumentRow() {
    return this.page.locator('tr, [role="row"]').filter({ hasText: 'Ausstehend' }).first()
  }

  /**
   * Extract the first pending document
   */
  async extractFirstPendingDocument() {
    const row = this.getFirstPendingDocumentRow()
    const extractButton = row.getByRole('button', { name: 'Daten extrahieren' })
    await extractButton.click()

    // Wait for extraction to complete - look for success toast or confidence badge
    // Alternative: wait for status change in the table row
    await expect(
      this.page.locator('[data-sonner-toast]').filter({ hasText: /Extraktion|erfolgreich|Konfidenz|extrahiert/i }).first()
    ).toBeVisible({ timeout: 60000 })

    // Wait a bit for UI to update
    await this.page.waitForTimeout(1000)
  }

  /**
   * Wait for extraction to complete for a document
   */
  async waitForExtractionComplete(filename: string) {
    const row = this.getDocumentRow(filename)

    // Wait for status badge to show "Review" or confidence score
    await expect(
      row.getByText(/Review|Genehmigt|% Konfidenz/i)
    ).toBeVisible({ timeout: 60000 })
  }

  /**
   * Click on a document to open the review editor
   */
  async openReview(filename: string) {
    const row = this.getDocumentRow(filename)

    // Look for Review button or click on the row
    const reviewButton = row.getByRole('button', { name: /review|prüfen/i }).or(
      row.getByRole('link', { name: /review|prüfen/i })
    )

    if (await reviewButton.isVisible()) {
      await reviewButton.click()
    } else {
      // Click on the document name/link
      await row.getByRole('link').first().click()
    }

    // Wait for navigation to review page
    await expect(this.page).toHaveURL(/\/review\//)
  }

  /**
   * Get the count of documents shown
   */
  async getDocumentCount(): Promise<number> {
    // The count shows "{total} Dokument{e}" - use text-muted-foreground p element
    const countLocator = this.page.locator('p.text-muted-foreground').filter({ hasText: /\d+ Dokumente?$/ })
    try {
      await countLocator.waitFor({ state: 'visible', timeout: 5000 })
      const countText = await countLocator.textContent()
      const match = countText?.match(/(\d+)/)
      return match ? parseInt(match[1], 10) : 0
    } catch {
      return 0
    }
  }

  /**
   * Filter documents by status
   */
  async filterByStatus(status: 'pending' | 'processing' | 'reviewed' | 'rejected' | 'completed' | 'review' | 'approved') {
    const statusLabels: Record<string, string> = {
      pending: 'Ausstehend',
      processing: 'In Bearbeitung',
      reviewed: 'Geprüft',
      review: 'Geprüft',  // alias for reviewed
      rejected: 'Abgelehnt',
      completed: 'Abgeschlossen',
      approved: 'Abgeschlossen', // alias for completed
    }

    await this.statusFilter.click()
    await this.page.getByRole('option', { name: statusLabels[status] }).click()
  }

  /**
   * Search for documents
   */
  async search(query: string) {
    await this.searchInput.fill(query)
    // Wait for debounced search
    await this.page.waitForTimeout(500)
  }

  /**
   * Clear all filters
   */
  async clearFilters() {
    const clearButton = this.page.getByRole('button', { name: /Filter zurücksetzen/i })
    if (await clearButton.isVisible()) {
      await clearButton.click()
    }
  }
}
