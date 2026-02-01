import { test, expect } from '@playwright/test'
import { SuppliersPage } from '../page-objects/suppliers.page'

/**
 * E2E Tests for Suppliers page (/suppliers)
 * Covers CRUD operations, search, and validation
 */

test.describe('Suppliers Page', () => {
  let suppliersPage: SuppliersPage

  test.beforeEach(async ({ page }) => {
    suppliersPage = new SuppliersPage(page)
    await suppliersPage.goto()
  })

  test.describe('Page Load', () => {
    test('should display suppliers page with heading', async () => {
      await expect(suppliersPage.heading).toBeVisible()
      await expect(suppliersPage.newSupplierButton).toBeVisible()
      await expect(suppliersPage.searchInput).toBeVisible()
    })

    test('should show supplier count', async () => {
      await expect(suppliersPage.supplierCountText).toBeVisible()
      const count = await suppliersPage.getSupplierCount()
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  test.describe('Search', () => {
    test('should filter suppliers by search query', async ({ page }) => {
      const initialCount = await suppliersPage.getSupplierCount()

      if (initialCount === 0) {
        test.skip(true, 'No suppliers to search')
        return
      }

      // Get first supplier name from table
      const firstSupplierName = await page.locator('table tbody tr td').first().textContent()
      if (!firstSupplierName) {
        test.skip(true, 'Could not get supplier name')
        return
      }

      // Search for the supplier
      await suppliersPage.search(firstSupplierName.substring(0, 5))

      // Should show filtered results
      await suppliersPage.waitForLoad()
      await expect(suppliersPage.supplierTable).toBeVisible()
    })

    test('should show empty state for non-matching search', async () => {
      const initialCount = await suppliersPage.getSupplierCount()
      if (initialCount === 0) {
        test.skip(true, 'No suppliers to test empty search')
        return
      }

      await suppliersPage.search('xyznonexistent12345')
      await suppliersPage.waitForLoad()

      const count = await suppliersPage.getSupplierCount()
      expect(count).toBe(0)
    })

    test('should clear search and show all suppliers', async () => {
      await suppliersPage.search('test')
      await suppliersPage.clearSearch()
      await suppliersPage.waitForLoad()

      await expect(suppliersPage.supplierCountText).toBeVisible()
    })
  })

  test.describe('Create Supplier', () => {
    const testSupplierName = `E2E Test Supplier ${Date.now()}`

    test('should open new supplier dialog', async () => {
      await suppliersPage.openNewSupplierDialog()

      await expect(suppliersPage.formDialog).toBeVisible()
      await expect(suppliersPage.nameInput).toBeVisible()
      await expect(suppliersPage.saveButton).toBeVisible()
      await expect(suppliersPage.cancelButton).toBeVisible()
    })

    test('should close dialog on cancel', async () => {
      await suppliersPage.openNewSupplierDialog()
      await suppliersPage.cancelButton.click()

      await expect(suppliersPage.formDialog).not.toBeVisible()
    })

    test('should create a new supplier', async ({ page }) => {
      const initialCount = await suppliersPage.getSupplierCount()

      await suppliersPage.createSupplier({
        name: testSupplierName,
        email: 'test@example.com',
        phone: '+49 123 456789',
      })

      // Verify supplier was created
      await suppliersPage.waitForLoad()
      const newCount = await suppliersPage.getSupplierCount()
      expect(newCount).toBeGreaterThan(initialCount)

      // Verify supplier appears in list
      await suppliersPage.search(testSupplierName)
      await expect(suppliersPage.getSupplierRow(testSupplierName)).toBeVisible()

      // Cleanup: delete the test supplier
      await suppliersPage.deleteSupplier(testSupplierName)
    })

    test('should validate required fields', async ({ page }) => {
      await suppliersPage.openNewSupplierDialog()

      // Try to submit empty form
      await suppliersPage.submitForm()

      // Form should still be visible (validation failed)
      await expect(suppliersPage.formDialog).toBeVisible()

      // Should show validation error
      await expect(page.getByText(/erforderlich|Pflichtfeld|required/i)).toBeVisible()
    })
  })

  test.describe('Edit Supplier', () => {
    test('should edit an existing supplier', async ({ page }) => {
      const initialCount = await suppliersPage.getSupplierCount()
      if (initialCount === 0) {
        test.skip(true, 'No suppliers to edit')
        return
      }

      // Create a test supplier first
      const testName = `Edit Test ${Date.now()}`
      await suppliersPage.createSupplier({ name: testName })
      await suppliersPage.search(testName)

      // Edit the supplier
      const updatedName = `${testName} Updated`
      await suppliersPage.updateSupplier(testName, {
        name: updatedName,
        email: 'updated@example.com',
      })

      // Verify update
      await suppliersPage.clearSearch()
      await suppliersPage.search(updatedName)
      await expect(suppliersPage.getSupplierRow(updatedName)).toBeVisible()

      // Cleanup
      await suppliersPage.deleteSupplier(updatedName)
    })
  })

  test.describe('Delete Supplier', () => {
    test('should delete a supplier with confirmation', async () => {
      // Create a test supplier first
      const testName = `Delete Test ${Date.now()}`
      await suppliersPage.createSupplier({ name: testName })
      await suppliersPage.search(testName)

      const countBefore = await suppliersPage.getSupplierCount()

      // Delete the supplier
      await suppliersPage.deleteSupplier(testName)

      // Verify deletion
      await suppliersPage.clearSearch()
      await suppliersPage.search(testName)
      const supplierExists = await suppliersPage.supplierExists(testName)
      expect(supplierExists).toBe(false)
    })

    test('should cancel deletion', async () => {
      const count = await suppliersPage.getSupplierCount()
      if (count === 0) {
        test.skip(true, 'No suppliers to test deletion cancel')
        return
      }

      // Create a test supplier
      const testName = `Cancel Delete ${Date.now()}`
      await suppliersPage.createSupplier({ name: testName })
      await suppliersPage.search(testName)

      // Start delete but cancel
      await suppliersPage.clickDeleteSupplier(testName)
      await suppliersPage.cancelDelete()

      // Supplier should still exist
      await expect(suppliersPage.getSupplierRow(testName)).toBeVisible()

      // Cleanup
      await suppliersPage.deleteSupplier(testName)
    })
  })

  test.describe('Sorting', () => {
    test('should sort suppliers by name', async ({ page }) => {
      const count = await suppliersPage.getSupplierCount()
      if (count < 2) {
        test.skip(true, 'Need at least 2 suppliers to test sorting')
        return
      }

      await suppliersPage.sortByName()

      // Verify table is still visible after sort
      await expect(suppliersPage.supplierTable).toBeVisible()
    })
  })
})

test.describe('Suppliers Accessibility', () => {
  test('should have accessible form controls', async ({ page }) => {
    const suppliersPage = new SuppliersPage(page)
    await suppliersPage.goto()
    await suppliersPage.openNewSupplierDialog()

    // Check that form inputs have labels
    await expect(page.getByLabel('Name')).toBeVisible()

    // Check that buttons are accessible
    await expect(suppliersPage.saveButton).toBeVisible()
    await expect(suppliersPage.saveButton).toBeEnabled()
  })

  test('should be keyboard navigable', async ({ page }) => {
    const suppliersPage = new SuppliersPage(page)
    await suppliersPage.goto()

    // Focus the new supplier button directly and activate with keyboard
    await suppliersPage.newSupplierButton.focus()
    await page.keyboard.press('Enter')

    // Dialog should be focusable
    await expect(suppliersPage.formDialog).toBeVisible({ timeout: 5000 })

    // Escape should close dialog
    await page.keyboard.press('Escape')
    await expect(suppliersPage.formDialog).not.toBeVisible()
  })
})
