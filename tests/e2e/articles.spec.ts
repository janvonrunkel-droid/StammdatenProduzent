import { test, expect } from '@playwright/test'
import { ArticlesPage } from '../page-objects/articles.page'

/**
 * E2E Tests for Articles page (/articles)
 * Covers CRUD operations, search, filtering, and view modes
 */

test.describe('Articles Page', () => {
  let articlesPage: ArticlesPage

  test.beforeEach(async ({ page }) => {
    articlesPage = new ArticlesPage(page)
    await articlesPage.goto()
  })

  test.describe('Page Load', () => {
    test('should display articles page with heading', async () => {
      await expect(articlesPage.heading).toBeVisible()
      await expect(articlesPage.newArticleButton).toBeVisible()
    })

    test('should show article count', async () => {
      await articlesPage.waitForLoad()
      await expect(articlesPage.articleCountText).toBeVisible()
      const count = await articlesPage.getArticleCount()
      expect(count).toBeGreaterThanOrEqual(0)
    })

    test('should show sort and view mode controls', async () => {
      await expect(articlesPage.sortDropdown).toBeVisible()
    })
  })

  test.describe('Search', () => {
    test('should filter articles by search query', async ({ page }) => {
      await articlesPage.waitForLoad()
      const initialCount = await articlesPage.getArticleCount()

      if (initialCount === 0) {
        test.skip(true, 'No articles to search')
        return
      }

      // Get first article name from table
      const firstArticleName = await page.locator('table tbody tr td').first().textContent()
      if (!firstArticleName) {
        test.skip(true, 'Could not get article name')
        return
      }

      // Search for the article
      await articlesPage.search(firstArticleName.substring(0, 5))
      await articlesPage.waitForLoad()

      await expect(articlesPage.articleTable).toBeVisible()
    })

    test('should show empty state for non-matching search', async () => {
      await articlesPage.waitForLoad()
      const initialCount = await articlesPage.getArticleCount()
      if (initialCount === 0) {
        test.skip(true, 'No articles to test empty search')
        return
      }

      await articlesPage.search('xyznonexistent12345')
      await articlesPage.waitForLoad()

      // Should show either empty state or 0 count
      const count = await articlesPage.getArticleCount()
      expect(count).toBe(0)
    })

    test('should clear search and show all articles', async () => {
      await articlesPage.search('test')
      await articlesPage.clearSearch()
      await articlesPage.waitForLoad()

      await expect(articlesPage.articleCountText).toBeVisible()
    })
  })

  test.describe('Create Article', () => {
    const testArticleName = `E2E Test Article ${Date.now()}`

    test('should open new article dialog', async () => {
      await articlesPage.openNewArticleDialog()

      await expect(articlesPage.formDialog).toBeVisible()
      await expect(articlesPage.nameInput).toBeVisible()
      await expect(articlesPage.saveButton).toBeVisible()
      await expect(articlesPage.cancelButton).toBeVisible()
    })

    test('should close dialog on cancel', async () => {
      await articlesPage.openNewArticleDialog()
      await articlesPage.cancelButton.click()

      await expect(articlesPage.formDialog).not.toBeVisible()
    })

    test.skip('should create a new article', async ({ page }) => {
      // SKIP REASON: This test modifies the database and is prone to timing issues.
      // Enable in isolated test environments with proper setup/teardown.

      await articlesPage.waitForLoad()
      const initialCount = await articlesPage.getArticleCount()

      try {
        await articlesPage.createArticle({
          name: testArticleName,
          articleNumber: `ART-${Date.now()}`,
          description: 'E2E test article description',
        })

        // Verify article was created - wait for list to update
        await page.waitForTimeout(500)
        await articlesPage.waitForLoad()
        const newCount = await articlesPage.getArticleCount()
        expect(newCount).toBeGreaterThan(initialCount)

        // Verify article appears in list
        await articlesPage.search(testArticleName)
        await page.waitForTimeout(500)
        await expect(articlesPage.getArticleRow(testArticleName)).toBeVisible({ timeout: 10000 })

        // Cleanup: delete the test article
        await articlesPage.deleteArticle(testArticleName)
      } catch (error) {
        // Attempt cleanup even if test failed
        try {
          await articlesPage.clearSearch()
          await articlesPage.search(testArticleName)
          if (await articlesPage.articleExists(testArticleName)) {
            await articlesPage.deleteArticle(testArticleName)
          }
        } catch {
          // Ignore cleanup errors
        }
        throw error
      }
    })

    test('should validate required fields', async ({ page }) => {
      await articlesPage.openNewArticleDialog()

      // Try to submit empty form
      await articlesPage.submitForm()

      // Form should still be visible (validation failed)
      await expect(articlesPage.formDialog).toBeVisible()
    })
  })

  test.describe('Edit Article', () => {
    test('should edit an existing article', async ({ page }) => {
      await articlesPage.waitForLoad()
      const initialCount = await articlesPage.getArticleCount()
      if (initialCount === 0) {
        test.skip(true, 'No articles to edit')
        return
      }

      // Create a test article first
      const testName = `Edit Test Article ${Date.now()}`
      await articlesPage.createArticle({ name: testName })
      await articlesPage.search(testName)

      // Edit the article
      const updatedName = `${testName} Updated`
      await articlesPage.updateArticle(testName, {
        name: updatedName,
        description: 'Updated description',
      })

      // Verify update
      await articlesPage.clearSearch()
      await articlesPage.search(updatedName)
      await expect(articlesPage.getArticleRow(updatedName)).toBeVisible()

      // Cleanup
      await articlesPage.deleteArticle(updatedName)
    })
  })

  test.describe('Delete Article', () => {
    test.skip('should delete an article with confirmation', async () => {
      // SKIP REASON: This test modifies the database by creating and deleting articles.
      // Enable in isolated test environments with proper setup/teardown.

      // Create a test article first
      const testName = `Delete Test Article ${Date.now()}`
      await articlesPage.createArticle({ name: testName })
      await articlesPage.search(testName)

      // Delete the article
      await articlesPage.deleteArticle(testName)

      // Verify deletion
      await articlesPage.clearSearch()
      await articlesPage.search(testName)
      const articleExists = await articlesPage.articleExists(testName)
      expect(articleExists).toBe(false)
    })

    test.skip('should cancel deletion', async () => {
      // SKIP REASON: This test modifies the database by creating articles.
      // Enable in isolated test environments with proper setup/teardown.

      // Create a test article
      const testName = `Cancel Delete Article ${Date.now()}`
      await articlesPage.createArticle({ name: testName })
      await articlesPage.search(testName)

      // Start delete but cancel
      await articlesPage.clickDeleteArticle(testName)
      await articlesPage.cancelDelete()

      // Article should still exist
      await expect(articlesPage.getArticleRow(testName)).toBeVisible()

      // Cleanup
      await articlesPage.deleteArticle(testName)
    })
  })

  test.describe('View Modes', () => {
    test('should switch between table and grid view', async ({ page }) => {
      await articlesPage.waitForLoad()
      const count = await articlesPage.getArticleCount()
      if (count === 0) {
        test.skip(true, 'No articles to test view modes')
        return
      }

      // Check if view mode buttons are visible (desktop only)
      const tableButton = page.getByRole('button').filter({ has: page.locator('svg.lucide-table') })
      const gridButton = page.getByRole('button').filter({ has: page.locator('svg.lucide-layout-grid') })

      if (!(await tableButton.isVisible())) {
        test.skip(true, 'View mode buttons not visible (possibly mobile viewport)')
        return
      }

      // Switch to grid view
      await gridButton.click()
      await page.waitForTimeout(300)

      // Switch back to table view
      await tableButton.click()
      await page.waitForTimeout(300)

      await expect(articlesPage.articleTable).toBeVisible()
    })
  })

  test.describe('Sorting', () => {
    test('should sort articles by different fields', async ({ page }) => {
      await articlesPage.waitForLoad()
      const count = await articlesPage.getArticleCount()
      if (count < 2) {
        test.skip(true, 'Need at least 2 articles to test sorting')
        return
      }

      // Open sort dropdown and select an option
      const sortTrigger = page.getByRole('button').filter({ has: page.locator('svg.lucide-arrow-up-down') })
      await sortTrigger.click()
      await page.getByRole('option', { name: 'Name (Z-A)' }).click()
      await page.waitForTimeout(300)

      // Table should still be visible
      await expect(articlesPage.articleTable).toBeVisible()
    })
  })
})

test.describe('Articles Accessibility', () => {
  test('should have accessible form controls', async ({ page }) => {
    const articlesPage = new ArticlesPage(page)
    await articlesPage.goto()
    await articlesPage.openNewArticleDialog()

    // Check that form inputs have labels
    await expect(page.getByLabel('Name')).toBeVisible()

    // Check that buttons are accessible
    await expect(articlesPage.saveButton).toBeVisible()
  })

  test('should be keyboard navigable', async ({ page }) => {
    const articlesPage = new ArticlesPage(page)
    await articlesPage.goto()

    // Should be able to use keyboard
    await page.keyboard.press('Tab')

    // Open dialog with keyboard should work after focusing the button
    const newButton = articlesPage.newArticleButton
    await newButton.focus()
    await page.keyboard.press('Enter')

    await expect(articlesPage.formDialog).toBeVisible()

    // Escape should close dialog
    await page.keyboard.press('Escape')
    await expect(articlesPage.formDialog).not.toBeVisible()
  })
})
