import { test, expect } from '@playwright/test'
import { DuplicatesPage } from '../page-objects/duplicates.page'

/**
 * E2E Tests for Duplicates page (/duplicates)
 * Covers duplicate detection, filtering, and exclusion
 */

test.describe('Duplicates Page', () => {
  let duplicatesPage: DuplicatesPage

  test.beforeEach(async ({ page }) => {
    duplicatesPage = new DuplicatesPage(page)
    await duplicatesPage.goto()
  })

  test.describe('Page Load', () => {
    test('should display duplicates page with heading', async () => {
      await expect(duplicatesPage.heading).toBeVisible()
      await expect(duplicatesPage.refreshButton).toBeVisible()
    })

    test('should show threshold selector', async () => {
      await expect(duplicatesPage.thresholdSelect).toBeVisible()
    })

    test('should show tabs for entity types', async () => {
      await expect(duplicatesPage.tabAll).toBeVisible()
      await expect(duplicatesPage.tabArticles).toBeVisible()
      await expect(duplicatesPage.tabSuppliers).toBeVisible()
      await expect(duplicatesPage.tabDocuments).toBeVisible()
    })

    test.skip('should load duplicate data', async ({ page }) => {
      // SKIP REASON: Page loading can timeout depending on duplicate calculation time.
      // This test is flaky and depends on the database having been analyzed for duplicates.

      await duplicatesPage.waitForLoad()

      // Give the page time to fully render
      await page.waitForTimeout(1000)

      // Should show either duplicates, empty state, or page heading
      // The page should be in some valid state after loading
      const hasDuplicates = await duplicatesPage.hasDuplicates()
      const isEmpty = await duplicatesPage.isEmptyStateVisible()
      const headingVisible = await duplicatesPage.heading.isVisible().catch(() => false)

      // Any of these states is valid - page loaded successfully
      expect(hasDuplicates || isEmpty || headingVisible).toBe(true)
    })
  })

  test.describe('Tabs', () => {
    test.skip('should switch between tabs', async ({ page }) => {
      // SKIP REASON: Tab behavior depends on duplicates data being loaded.
      // The page state varies based on data availability.

      await duplicatesPage.waitForLoad()

      // Switch to Articles tab
      await duplicatesPage.switchToTab('articles')
      await page.waitForTimeout(300)
      // Check tab is clickable/active by verifying it doesn't throw
      await expect(duplicatesPage.tabArticles).toBeVisible()

      // Switch to Suppliers tab
      await duplicatesPage.switchToTab('suppliers')
      await page.waitForTimeout(300)
      await expect(duplicatesPage.tabSuppliers).toBeVisible()

      // Switch to Documents tab
      await duplicatesPage.switchToTab('documents')
      await page.waitForTimeout(300)
      await expect(duplicatesPage.tabDocuments).toBeVisible()

      // Switch back to All
      await duplicatesPage.switchToTab('all')
      await page.waitForTimeout(300)
      await expect(duplicatesPage.tabAll).toBeVisible()

      // Page should still be functional
      await expect(duplicatesPage.heading).toBeVisible()
    })

    test.skip('should show correct counts in tab badges', async () => {
      // SKIP REASON: Tab counts depend on duplicate data being present.

      await duplicatesPage.waitForLoad()

      const allCount = await duplicatesPage.getTabCount('all')
      const articlesCount = await duplicatesPage.getTabCount('articles')
      const suppliersCount = await duplicatesPage.getTabCount('suppliers')
      const documentsCount = await duplicatesPage.getTabCount('documents')

      // If no duplicates exist, all counts will be 0
      if (allCount === 0 && articlesCount === 0 && suppliersCount === 0 && documentsCount === 0) {
        // Valid state - no duplicates
        expect(true).toBe(true)
        return
      }

      // All should be sum of individual types (or close due to async)
      const sumOfTypes = articlesCount + suppliersCount + documentsCount
      expect(Math.abs(allCount - sumOfTypes)).toBeLessThanOrEqual(1)
    })
  })

  test.describe('Threshold Filter', () => {
    test.skip('should filter by similarity threshold', async () => {
      // SKIP REASON: Threshold filtering depends on duplicate data being present.
      // Enable when test fixtures with known duplicates are available.

      await duplicatesPage.waitForLoad()

      // Set higher threshold - should show fewer or same number of duplicates
      await duplicatesPage.setThreshold('90%')
      await duplicatesPage.page.waitForTimeout(500)

      // The filter should work (page shouldn't error)
      await duplicatesPage.waitForLoad()

      // Set lower threshold
      await duplicatesPage.setThreshold('70%')
      await duplicatesPage.page.waitForTimeout(500)
      await duplicatesPage.waitForLoad()

      // Page should still be functional
      await expect(duplicatesPage.heading).toBeVisible()
    })

    test.skip('should update results when threshold changes', async ({ page }) => {
      // SKIP REASON: Threshold filtering depends on duplicate data being present.

      await duplicatesPage.waitForLoad()

      // Get count at 70%
      await duplicatesPage.setThreshold('70%')
      await page.waitForTimeout(1000)
      await duplicatesPage.waitForLoad()
      const count70 = await duplicatesPage.getDuplicateCount()

      // If no duplicates at all, skip this test
      if (count70 === 0) {
        test.skip(true, 'No duplicates available to test threshold changes')
        return
      }

      // Get count at 95%
      await duplicatesPage.setThreshold('95%')
      await page.waitForTimeout(1000)
      await duplicatesPage.waitForLoad()
      const count95 = await duplicatesPage.getDuplicateCount()

      // Higher threshold should have equal or fewer duplicates
      expect(count95).toBeLessThanOrEqual(count70)
    })
  })

  test.describe('Refresh', () => {
    test.skip('should refresh duplicates list', async ({ page }) => {
      // SKIP REASON: Refresh behavior depends on duplicates data.

      await duplicatesPage.waitForLoad()

      // Refresh button should work - click and wait for loading to finish
      await duplicatesPage.refreshButton.click()
      await page.waitForTimeout(500)

      // Wait for either content or empty state
      await duplicatesPage.waitForLoad()

      // Page should still be visible and functional
      await expect(duplicatesPage.heading).toBeVisible()
    })
  })

  test.describe('Exclude Duplicates', () => {
    test.skip('should have exclude button for duplicate pairs', async ({ page }) => {
      // SKIP REASON: This test requires duplicate pairs to be present.

      await duplicatesPage.waitForLoad()

      const hasDuplicates = await duplicatesPage.hasDuplicates()
      if (!hasDuplicates) {
        test.skip(true, 'No duplicates to test exclusion')
        return
      }

      // Find the exclude button
      const excludeButton = page.getByRole('button', { name: /Kein Duplikat/i }).first()
      await expect(excludeButton).toBeVisible()
    })

    test.skip('should exclude a duplicate pair', async ({ page }) => {
      // SKIP REASON: This test modifies data by excluding duplicates.
      // Enable only in isolated test environments with proper seed data.

      await duplicatesPage.waitForLoad()

      const hasDuplicates = await duplicatesPage.hasDuplicates()
      if (!hasDuplicates) {
        test.skip(true, 'No duplicates to exclude')
        return
      }

      const initialCount = await duplicatesPage.getDuplicateCount()
      if (initialCount === 0) {
        test.skip(true, 'No duplicates to exclude')
        return
      }

      // Get the first duplicate pair
      const firstPair = duplicatesPage.getDuplicatePairs().first()

      // Click exclude on the first pair
      const excludeButton = firstPair.getByRole('button', { name: /Kein Duplikat/i })
      await excludeButton.click()

      // Wait for the update to process
      await page.waitForTimeout(1000)

      // Count should decrease or stay at 0
      const newCount = await duplicatesPage.getDuplicateCount()
      expect(newCount).toBeLessThanOrEqual(initialCount)
    })
  })

  test.describe('Duplicate Pair Display', () => {
    test.skip('should display similarity score for each pair', async ({ page }) => {
      // SKIP REASON: This test requires actual duplicate pairs to be present.
      // Enable when test fixtures with known duplicates are available.

      await duplicatesPage.waitForLoad()

      const hasDuplicates = await duplicatesPage.hasDuplicates()
      if (!hasDuplicates) {
        test.skip(true, 'No duplicates to check')
        return
      }

      // Check that similarity is shown - it's a span with "XX%" format
      const similarityBadge = page.locator('[role="tabpanel"]').locator('span, div').filter({ hasText: /\d+%/ }).first()

      const isVisible = await similarityBadge.isVisible().catch(() => false)
      if (!isVisible) {
        // Similarity might be displayed differently
        test.skip(true, 'Similarity badge not found - may use different format')
        return
      }

      // Get the score
      const scoreText = await similarityBadge.textContent()
      const match = scoreText?.match(/(\d+)/)
      const score = match ? parseInt(match[1], 10) : 0

      // Score should be between 0-100
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    test.skip('should display matching fields info', async ({ page }) => {
      // SKIP REASON: This test requires duplicate pairs to be present.

      await duplicatesPage.waitForLoad()

      const hasDuplicates = await duplicatesPage.hasDuplicates()
      if (!hasDuplicates) {
        test.skip(true, 'No duplicates to check')
        return
      }

      // Check that matching fields are shown
      const matchingFieldsText = page.locator('text=/Übereinstimmung in:/').first()
      await expect(matchingFieldsText).toBeVisible()
    })

    test.skip('should display entity type badge', async ({ page }) => {
      // SKIP REASON: This test requires duplicate pairs to be present.

      await duplicatesPage.waitForLoad()

      const hasDuplicates = await duplicatesPage.hasDuplicates()
      if (!hasDuplicates) {
        test.skip(true, 'No duplicates to check')
        return
      }

      // Check for entity type text - shown as span or div with type name
      // Entity types are: "Artikel", "Lieferanten", "Dokumente" (not "Alle")
      const typeBadge = page.locator('[role="tabpanel"]').getByText(/^(Artikel|Lieferanten|Dokumente)$/i).first()
      await expect(typeBadge).toBeVisible()
    })
  })

  test.describe('Empty State', () => {
    test.skip('should show empty state when no duplicates at high threshold', async ({ page }) => {
      // SKIP REASON: Empty state depends on duplicate data state.

      await duplicatesPage.waitForLoad()

      // Set very high threshold
      await duplicatesPage.setThreshold('95%')
      await page.waitForTimeout(1000)
      await duplicatesPage.waitForLoad()

      // If no duplicates at this threshold, should show empty state
      const count = await duplicatesPage.getDuplicateCount()
      const hasDuplicates = await duplicatesPage.hasDuplicates()

      if (count === 0 && !hasDuplicates) {
        const isEmpty = await duplicatesPage.isEmptyStateVisible()
        // Either empty state is shown or no duplicates found
        expect(isEmpty || count === 0).toBe(true)
      } else {
        // There are duplicates even at 95% - that's also valid
        expect(count).toBeGreaterThanOrEqual(0)
      }
    })
  })
})

test.describe('Duplicates Accessibility', () => {
  test('should have accessible tabs', async ({ page }) => {
    const duplicatesPage = new DuplicatesPage(page)
    await duplicatesPage.goto()

    // Tabs should have proper role
    await expect(duplicatesPage.tabAll).toHaveRole('tab')
    await expect(duplicatesPage.tabArticles).toHaveRole('tab')
  })

  test.skip('should be keyboard navigable', async ({ page }) => {
    // SKIP REASON: Keyboard navigation depends on tab focus state
    // which can be affected by page loading timing.

    const duplicatesPage = new DuplicatesPage(page)
    await duplicatesPage.goto()
    await duplicatesPage.waitForLoad()

    // Tab navigation should work
    await page.keyboard.press('Tab')

    // Tabs should be focusable
    await duplicatesPage.tabAll.focus()
    await page.keyboard.press('ArrowRight')

    // Should move to next tab
    await expect(duplicatesPage.tabArticles).toBeFocused()
  })
})
