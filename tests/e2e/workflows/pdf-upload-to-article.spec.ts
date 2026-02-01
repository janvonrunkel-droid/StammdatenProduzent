import { test, expect } from '@playwright/test'
import { DocumentsPage } from '../../page-objects/documents.page'
import { ReviewEditorPage } from '../../page-objects/review-editor.page'
import path from 'path'

/**
 * E2E Test: Complete PDF Upload to Article Workflow
 *
 * This test covers the full workflow:
 * 1. Upload a PDF invoice
 * 2. Extract data from the PDF
 * 3. Review the extraction
 * 4. Approve and create price entries
 *
 * Prerequisites:
 * - Test user must exist in Supabase
 * - .env.test must have TEST_USER_EMAIL and TEST_USER_PASSWORD
 * - A test PDF file should be available (or use a fixture)
 */

test.describe('PDF Upload to Article Workflow', () => {
  let documentsPage: DocumentsPage
  let reviewEditorPage: ReviewEditorPage

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentsPage(page)
    reviewEditorPage = new ReviewEditorPage(page)
  })

  test.skip('should complete full workflow: upload → extract → review → approve', async ({ page }) => {
    // SKIP REASON: This test requires a valid test PDF file and full extraction pipeline.
    // It will be enabled when tests/fixtures/test-invoice.pdf is available and
    // the extraction pipeline is configured for testing.

    // Step 1: Navigate to documents page
    await documentsPage.goto()
    await expect(documentsPage.heading).toBeVisible()

    // Get initial document count
    const initialCount = await documentsPage.getDocumentCount()

    // Step 2: Upload a test PDF
    const testPdfPath = path.join(__dirname, '../../fixtures/test-invoice.pdf')

    // Skip if test file doesn't exist
    const fs = await import('fs')
    if (!fs.existsSync(testPdfPath)) {
      test.skip(true, 'Test PDF file not found. Create tests/fixtures/test-invoice.pdf')
      return
    }

    await documentsPage.uploadPdf(testPdfPath, 'invoice')

    // Verify document was uploaded
    await page.waitForTimeout(1000)
    const newCount = await documentsPage.getDocumentCount()
    expect(newCount).toBeGreaterThan(initialCount)

    // Step 3: Extract the first pending document
    await documentsPage.extractFirstPendingDocument()

    // Step 4: Navigate to review page
    await page.getByRole('link', { name: 'Review' }).click()
    await expect(page).toHaveURL(/\/review/)

    // Verify review queue is visible with items
    await expect(page.getByRole('heading', { name: 'Review-Queue' })).toBeVisible()
    await expect(page.getByText(/\d+ Dokumente? zur Prüfung/)).toBeVisible()

    // Step 5: Open first review item
    await page.getByRole('button', { name: 'Review' }).first().click()
    await expect(page).toHaveURL(/\/review\//, { timeout: 10000 })

    // Step 6: Verify review editor loaded
    await reviewEditorPage.waitForLoad()
    await expect(page.getByText(/\d+% Konfidenz/).first()).toBeVisible()

    // Step 7: Verify approve/reject buttons are available
    await expect(page.getByRole('button', { name: 'Übernehmen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ablehnen' })).toBeVisible()

    // Step 8: Go back to review queue (don't actually approve to avoid side effects)
    await page.getByRole('button', { name: 'Zurück' }).click()
    await expect(page).toHaveURL(/\/review(?!\/)/, { timeout: 5000 })
  })

  test('should handle extraction with low confidence', async ({ page }) => {
    await documentsPage.goto()

    // This test verifies the UI handles low confidence extractions
    // In a real scenario, you'd upload a difficult-to-parse PDF

    // Check for any documents in review status
    await documentsPage.filterByStatus('review')

    // If there are documents to review, verify the review flow works
    const count = await documentsPage.getDocumentCount()
    if (count === 0) {
      test.skip(true, 'No documents in review status')
      return
    }

    // Open the first document for review
    const firstDoc = page.locator('tr, [role="row"]').filter({ hasText: /Review|% Konfidenz/ }).first()
    await firstDoc.getByRole('link').first().click()

    await reviewEditorPage.waitForLoad()

    // Verify the editor shows confidence text
    const confidenceBadge = page.locator('span').filter({ hasText: /\d+% Konfidenz/ })
    await expect(confidenceBadge).toBeVisible()

    // Go back without making changes
    await reviewEditorPage.goBack()
  })

  test('should allow editing positions before approval', async ({ page }) => {
    await documentsPage.goto()

    // Filter to documents in review
    await documentsPage.filterByStatus('review')

    const count = await documentsPage.getDocumentCount()
    if (count === 0) {
      test.skip(true, 'No documents in review status')
      return
    }

    // Open first document for review
    const firstDoc = page.locator('tr, [role="row"]').filter({ hasText: /Review|% Konfidenz/ }).first()
    await firstDoc.getByRole('link').first().click()

    await reviewEditorPage.waitForLoad()

    // Check if there are positions
    const positionCount = await reviewEditorPage.getPositionCount()
    if (positionCount === 0) {
      test.skip(true, 'No positions in this extraction')
      return
    }

    // Try to edit the first position's quantity
    const firstRow = reviewEditorPage.getPositionRow(0)
    const quantityInput = firstRow.locator('input[type="number"]').first()

    if (await quantityInput.isVisible()) {
      const originalValue = await quantityInput.inputValue()
      await quantityInput.fill('999')

      // Verify unsaved changes indicator
      await expect(page.getByText(/Ungespeicherte Änderungen/i)).toBeVisible()

      // Restore original value
      await quantityInput.fill(originalValue || '1')
    }

    // Go back
    await reviewEditorPage.goBack()
  })

  test.skip('should reject document with reason', async ({ page }) => {
    // SKIP REASON: This test requires documents in review status and modifies data.
    // Enable in isolated test environments with proper seed data.

    await documentsPage.goto()

    // Filter to documents in review
    await documentsPage.filterByStatus('review')

    const count = await documentsPage.getDocumentCount()
    if (count === 0) {
      test.skip(true, 'No documents in review status')
      return
    }

    // Open first document for review
    const firstDoc = page.locator('tr, [role="row"]').filter({ hasText: /Review|% Konfidenz/ }).first()
    await firstDoc.getByRole('link').first().click()

    await reviewEditorPage.waitForLoad()

    // Click reject
    await reviewEditorPage.reject('other', 'Test rejection from E2E test')

    // Confirm rejection
    await reviewEditorPage.confirmReject()

    // Verify we're back on review queue
    await expect(page).toHaveURL(/\/review/)

    // Success message for rejection
    await expect(page.getByText(/abgelehnt/i)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Document Upload Validation', () => {
  test('should show upload dialog with correct fields', async ({ page }) => {
    const documentsPage = new DocumentsPage(page)
    await documentsPage.goto()

    await documentsPage.openUploadDialog()

    // Verify dialog elements
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Check for file input area
    await expect(dialog.getByText('PDFs hier ablegen', { exact: true })).toBeVisible()

    // Check for upload button (disabled when no files selected)
    await expect(dialog.getByRole('button', { name: /Hochladen/i })).toBeVisible()

    // Check for cancel button
    await expect(dialog.getByRole('button', { name: 'Abbrechen' })).toBeVisible()

    // Close dialog
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('should navigate between documents and review', async ({ page }) => {
    const documentsPage = new DocumentsPage(page)
    await documentsPage.goto()

    // Verify page title
    await expect(documentsPage.heading).toBeVisible()

    // Navigate to review queue
    await page.getByRole('link', { name: /Review|Queue/i }).click()
    await expect(page).toHaveURL(/\/review/)

    // Navigate back to documents
    await page.getByRole('link', { name: /Dokument/i }).click()
    await expect(page).toHaveURL(/\/documents/)
  })
})

test.describe('Accessibility', () => {
  test('documents page should have proper headings', async ({ page }) => {
    const documentsPage = new DocumentsPage(page)
    await documentsPage.goto()

    // Main heading should be present
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toBeVisible()

    // Buttons should be accessible
    await expect(documentsPage.uploadButton).toBeVisible()
    await expect(documentsPage.uploadButton).toBeEnabled()
  })

  test.skip('review editor should have accessible form controls', async ({ page }) => {
    // SKIP REASON: This test requires documents in review status.
    // Enable when test fixtures with reviewable documents are available.

    const documentsPage = new DocumentsPage(page)
    await documentsPage.goto()

    // Filter to review documents
    await documentsPage.filterByStatus('review')

    const count = await documentsPage.getDocumentCount()
    if (count === 0) {
      test.skip(true, 'No documents in review status')
      return
    }

    // Open first document
    const firstDoc = page.locator('tr, [role="row"]').filter({ hasText: /Review|% Konfidenz/ }).first()
    await firstDoc.getByRole('link').first().click()

    const reviewEditorPage = new ReviewEditorPage(page)
    await reviewEditorPage.waitForLoad()

    // Check that main action buttons are accessible
    await expect(reviewEditorPage.approveButton).toBeVisible()
    await expect(reviewEditorPage.rejectButton).toBeVisible()
    await expect(reviewEditorPage.saveButton).toBeVisible()
    await expect(reviewEditorPage.backButton).toBeVisible()
  })
})
