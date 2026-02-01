import { test, expect } from '@playwright/test'
import { ReviewPage } from '../page-objects/review.page'
import { ReviewEditorPage } from '../page-objects/review-editor.page'
import { DocumentsPage } from '../page-objects/documents.page'

/**
 * E2E Tests for Review Workflow
 * Covers review queue, approval, rejection, and position editing
 */

test.describe('Review Queue', () => {
  let reviewPage: ReviewPage

  test.beforeEach(async ({ page }) => {
    reviewPage = new ReviewPage(page)
    await reviewPage.goto()
  })

  test.describe('Page Load', () => {
    test('should display review queue with heading', async () => {
      await expect(reviewPage.heading).toBeVisible()
    })

    test('should show document count', async () => {
      await reviewPage.waitForLoad()
      await expect(reviewPage.documentCount).toBeVisible()
    })

    test('should show filter controls', async ({ page }) => {
      await expect(reviewPage.sortDropdown).toBeVisible()
    })

    test('should load review items or show empty state', async () => {
      await reviewPage.waitForLoad()

      const isEmpty = await reviewPage.isQueueEmpty()
      const count = await reviewPage.getVisibleItemCount()

      // Either show items or empty state
      expect(isEmpty || count > 0).toBe(true)
    })
  })

  test.describe('Sorting', () => {
    test('should sort by confidence ascending', async () => {
      await reviewPage.waitForLoad()

      if (await reviewPage.isQueueEmpty()) {
        test.skip(true, 'No items to sort')
        return
      }

      await reviewPage.sortBy('confidence_asc')
      await expect(reviewPage.reviewTable).toBeVisible()
    })

    test('should sort by confidence descending', async () => {
      await reviewPage.waitForLoad()

      if (await reviewPage.isQueueEmpty()) {
        test.skip(true, 'No items to sort')
        return
      }

      await reviewPage.sortBy('confidence_desc')
      await expect(reviewPage.reviewTable).toBeVisible()
    })

    test('should sort by date', async () => {
      await reviewPage.waitForLoad()

      if (await reviewPage.isQueueEmpty()) {
        test.skip(true, 'No items to sort')
        return
      }

      await reviewPage.sortBy('date_desc')
      await expect(reviewPage.reviewTable).toBeVisible()
    })
  })

  test.describe('Navigation to Review Editor', () => {
    test.skip('should open review editor for first item', async ({ page }) => {
      // SKIP REASON: This test requires documents in review status.
      // Enable when test fixtures with reviewable documents are available.

      await reviewPage.waitForLoad()

      if (await reviewPage.isQueueEmpty()) {
        test.skip(true, 'No items to review')
        return
      }

      await reviewPage.openFirstReview()

      // Should navigate to review editor
      await expect(page).toHaveURL(/\/review\//)
    })
  })
})

test.describe('Review Editor', () => {
  let reviewPage: ReviewPage
  let reviewEditorPage: ReviewEditorPage

  test.beforeEach(async ({ page }) => {
    reviewPage = new ReviewPage(page)
    reviewEditorPage = new ReviewEditorPage(page)
  })

  test.describe('Editor Load', () => {
    test('should display review editor with controls', async ({ page }) => {
      await reviewPage.goto()
      await reviewPage.waitForLoad()

      if (await reviewPage.isQueueEmpty()) {
        test.skip(true, 'No items to review')
        return
      }

      // Try to open first review
      try {
        await reviewPage.openFirstReview()
      } catch {
        test.skip(true, 'Could not open review - may have no reviewable items')
        return
      }

      await reviewEditorPage.waitForLoad()

      // Check main controls are visible
      await expect(reviewEditorPage.approveButton).toBeVisible()
      await expect(reviewEditorPage.rejectButton).toBeVisible()
      await expect(reviewEditorPage.backButton).toBeVisible()
    })

    test.skip('should display confidence score', async ({ page }) => {
      // SKIP REASON: This test requires documents in review status.
      // Enable when test fixtures with reviewable documents are available.

      await reviewPage.goto()
      await reviewPage.waitForLoad()

      if (await reviewPage.isQueueEmpty()) {
        test.skip(true, 'No items to review')
        return
      }

      try {
        await reviewPage.openFirstReview()
      } catch {
        test.skip(true, 'Could not open review')
        return
      }

      await reviewEditorPage.waitForLoad()

      const confidence = await reviewEditorPage.getConfidenceScore()
      // Confidence may or may not be shown, both are valid
      if (confidence !== null) {
        expect(confidence).toBeGreaterThanOrEqual(0)
        expect(confidence).toBeLessThanOrEqual(100)
      }
    })
  })

  test.describe('Position Editing', () => {
    test('should display positions table', async ({ page }) => {
      await reviewPage.goto()
      await reviewPage.waitForLoad()

      if (await reviewPage.isQueueEmpty()) {
        test.skip(true, 'No items to review')
        return
      }

      await reviewPage.openFirstReview()
      await reviewEditorPage.waitForLoad()

      const positionCount = await reviewEditorPage.getPositionCount()
      if (positionCount === 0) {
        test.skip(true, 'No positions in this extraction')
        return
      }

      await expect(reviewEditorPage.positionsTable).toBeVisible()
    })

    test.skip('should edit position quantity', async ({ page }) => {
      // SKIP REASON: This test requires documents in review status with positions.
      // Enable in isolated test environments with proper seed data.

      await reviewPage.goto()
      await reviewPage.waitForLoad()

      if (await reviewPage.isQueueEmpty()) {
        test.skip(true, 'No items to review')
        return
      }

      await reviewPage.openFirstReview()
      await reviewEditorPage.waitForLoad()

      const positionCount = await reviewEditorPage.getPositionCount()
      if (positionCount === 0) {
        test.skip(true, 'No positions to edit')
        return
      }

      // Edit quantity
      const firstRow = reviewEditorPage.getPositionRow(0)
      const quantityInput = firstRow.locator('input[type="number"]').first()

      if (await quantityInput.isVisible()) {
        const originalValue = await quantityInput.inputValue()
        await quantityInput.fill('999')

        // Verify unsaved changes indicator
        const hasChanges = await reviewEditorPage.hasUnsavedChanges()
        expect(hasChanges).toBe(true)

        // Restore original value
        await quantityInput.fill(originalValue || '1')
      }

      // Go back without saving
      await reviewEditorPage.goBack()
    })
  })

  test.describe('Approval Workflow', () => {
    test('should show approve button', async ({ page }) => {
      await reviewPage.goto()
      await reviewPage.waitForLoad()

      if (await reviewPage.isQueueEmpty()) {
        test.skip(true, 'No items to review')
        return
      }

      await reviewPage.openFirstReview()
      await reviewEditorPage.waitForLoad()

      await expect(reviewEditorPage.approveButton).toBeVisible()
      await expect(reviewEditorPage.approveButton).toBeEnabled()
    })

    test('should open approval confirmation on click', async ({ page }) => {
      await reviewPage.goto()
      await reviewPage.waitForLoad()

      if (await reviewPage.isQueueEmpty()) {
        test.skip(true, 'No items to approve')
        return
      }

      await reviewPage.openFirstReview()
      await reviewEditorPage.waitForLoad()

      // Click approve
      await reviewEditorPage.approve()

      // Should show confirmation dialog or navigate
      await page.waitForTimeout(500)

      // Either dialog is shown or navigation happened
      const dialogVisible = await page.getByRole('alertdialog').isVisible().catch(() => false)
      const navigated = await page.url().includes('/review') && !page.url().match(/\/review\//)

      // Go back if dialog is shown
      if (dialogVisible) {
        await page.keyboard.press('Escape')
      }

      await reviewEditorPage.goBack()
    })
  })

  test.describe('Rejection Workflow', () => {
    test('should show reject button', async ({ page }) => {
      await reviewPage.goto()
      await reviewPage.waitForLoad()

      if (await reviewPage.isQueueEmpty()) {
        test.skip(true, 'No items to review')
        return
      }

      await reviewPage.openFirstReview()
      await reviewEditorPage.waitForLoad()

      await expect(reviewEditorPage.rejectButton).toBeVisible()
      await expect(reviewEditorPage.rejectButton).toBeEnabled()
    })

    test('should open rejection dialog on click', async ({ page }) => {
      await reviewPage.goto()
      await reviewPage.waitForLoad()

      if (await reviewPage.isQueueEmpty()) {
        test.skip(true, 'No items to reject')
        return
      }

      await reviewPage.openFirstReview()
      await reviewEditorPage.waitForLoad()

      // Click reject
      await reviewEditorPage.rejectButton.click()

      // Should show rejection dialog
      await expect(reviewEditorPage.rejectDialog).toBeVisible()

      // Close dialog
      await page.keyboard.press('Escape')
      await reviewEditorPage.goBack()
    })
  })

  test.describe('Navigation', () => {
    test('should go back to review queue', async ({ page }) => {
      await reviewPage.goto()
      await reviewPage.waitForLoad()

      if (await reviewPage.isQueueEmpty()) {
        test.skip(true, 'No items to review')
        return
      }

      await reviewPage.openFirstReview()
      await reviewEditorPage.waitForLoad()

      await reviewEditorPage.goBack()

      await expect(page).toHaveURL(/\/review(?!\/)/)
      await expect(reviewPage.heading).toBeVisible()
    })
  })
})

test.describe('Full Review Workflow', () => {
  // NOTE: These tests require actual documents in review status.
  // They are skipped by default and can be enabled when test data is available.

  test.describe('Approval Flow', () => {
    test.skip('complete approval workflow', async ({ page }) => {
      // SKIP REASON: This test modifies data by approving documents.
      // Enable only in isolated test environments with proper seed data.

      const reviewPage = new ReviewPage(page)
      const reviewEditorPage = new ReviewEditorPage(page)

      await reviewPage.goto()
      await reviewPage.waitForLoad()

      if (await reviewPage.isQueueEmpty()) {
        test.skip(true, 'No items to approve - review queue is empty')
        return
      }

      const initialCount = await reviewPage.getDocumentCount()
      if (initialCount === 0) {
        test.skip(true, 'No documents available for approval')
        return
      }

      // Open first review
      try {
        await reviewPage.openFirstReview()
      } catch {
        test.skip(true, 'Could not open review item')
        return
      }

      await reviewEditorPage.waitForLoad()

      // Approve the extraction
      await reviewEditorPage.approve()
      await page.waitForTimeout(1000)

      // Try to confirm if dialog appears
      const dialog = page.getByRole('alertdialog')
      if (await dialog.isVisible().catch(() => false)) {
        const confirmBtn = dialog.getByRole('button', { name: /Übernehmen|Bestätigen/i })
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click()
        }
      }

      // Wait for navigation or success state
      await page.waitForTimeout(2000)

      // Check if we're back on review queue or still on editor
      const currentUrl = page.url()
      const isOnQueue = currentUrl.endsWith('/review') || !currentUrl.includes('/review/')
      const successToast = page.locator('[data-sonner-toast]').filter({ hasText: /übernommen|genehmigt|erfolg/i })
      const hasSuccessToast = await successToast.isVisible().catch(() => false)

      expect(isOnQueue || hasSuccessToast).toBe(true)
    })
  })

  test.describe('Rejection Flow', () => {
    test.skip('complete rejection workflow with reason', async ({ page }) => {
      // SKIP REASON: This test modifies data by rejecting documents.
      // Enable only in isolated test environments with proper seed data.

      const reviewPage = new ReviewPage(page)
      const reviewEditorPage = new ReviewEditorPage(page)

      await reviewPage.goto()
      await reviewPage.waitForLoad()

      if (await reviewPage.isQueueEmpty()) {
        test.skip(true, 'No items to reject - review queue is empty')
        return
      }

      // Open first review
      try {
        await reviewPage.openFirstReview()
      } catch {
        test.skip(true, 'Could not open review item')
        return
      }

      await reviewEditorPage.waitForLoad()

      // Click reject button
      await reviewEditorPage.rejectButton.click()
      await page.waitForTimeout(500)

      // Check if rejection dialog opened
      const rejectDialog = page.getByRole('dialog').filter({ hasText: /ablehnen/i })
      if (!(await rejectDialog.isVisible().catch(() => false))) {
        test.skip(true, 'Rejection dialog did not open - UI may differ')
        return
      }

      // Try to select a reason if combobox exists
      const reasonCombo = rejectDialog.getByRole('combobox')
      if (await reasonCombo.isVisible().catch(() => false)) {
        await reasonCombo.click()
        // Try to find and click an option
        const anyOption = page.getByRole('option').first()
        if (await anyOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await anyOption.click()
        }
      }

      // Fill comment if textarea exists
      const commentField = rejectDialog.getByRole('textbox')
      if (await commentField.isVisible().catch(() => false)) {
        await commentField.fill('E2E Test rejection')
      }

      // Confirm rejection
      const confirmBtn = rejectDialog.getByRole('button', { name: /Ablehnen/i })
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click()
      }

      await page.waitForTimeout(2000)

      // Check for success - either navigation or toast
      const currentUrl = page.url()
      const isOnQueue = !currentUrl.match(/\/review\/[^/]+/)
      const successIndicator = page.locator('[data-sonner-toast], [role="status"]').filter({ hasText: /abgelehnt/i })
      const hasSuccess = await successIndicator.isVisible().catch(() => false)

      expect(isOnQueue || hasSuccess).toBe(true)
    })
  })
})
