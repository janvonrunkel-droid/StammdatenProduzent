/**
 * Test Fixtures for Article Matcher Tests
 *
 * Realistic test data based on typical German food/beverage articles
 */

import type { ArticleWithSupplierPrices, ExtractedPosition } from '../../src/lib/extraction/article-matcher'

// Test Articles (simulating articles table)
export const testArticles: ArticleWithSupplierPrices[] = [
  {
    id: 'art-001',
    name: 'Coca Cola 1L PET',
    article_number: 'CC-1000',
    unit_id: 'unit-liter',
    has_supplier_prices: true,
  },
  {
    id: 'art-002',
    name: 'Coca Cola 0,5L PET',
    article_number: 'CC-500',
    unit_id: 'unit-liter',
    has_supplier_prices: false,
  },
  {
    id: 'art-003',
    name: 'Mineralwasser Classic 1L',
    article_number: 'MW-1000-C',
    unit_id: 'unit-liter',
    has_supplier_prices: true,
  },
  {
    id: 'art-004',
    name: 'Mineralwasser Still 1L',
    article_number: 'MW-1000-S',
    unit_id: 'unit-liter',
    has_supplier_prices: false,
  },
  {
    id: 'art-005',
    name: 'Rinderfilet frisch',
    article_number: 'RF-001',
    unit_id: 'unit-kg',
    has_supplier_prices: true,
  },
  {
    id: 'art-006',
    name: 'Schweinefilet frisch',
    article_number: 'SF-001',
    unit_id: 'unit-kg',
    has_supplier_prices: false,
  },
  {
    id: 'art-007',
    name: 'Bio Kartoffeln festkochend',
    article_number: null,
    unit_id: 'unit-kg',
    has_supplier_prices: true,
  },
  {
    id: 'art-008',
    name: 'Kartoffeln mehlig kochend',
    article_number: null,
    unit_id: 'unit-kg',
    has_supplier_prices: false,
  },
  {
    id: 'art-009',
    name: 'Olivenöl Extra Vergine 1L',
    article_number: 'OEV-1000',
    unit_id: 'unit-liter',
    has_supplier_prices: true,
  },
  {
    id: 'art-010',
    name: 'Sonnenblumenöl 1L',
    article_number: 'SBO-1000',
    unit_id: 'unit-liter',
    has_supplier_prices: false,
  },
]

// Similar articles for ambiguity testing
export const similarArticles: ArticleWithSupplierPrices[] = [
  {
    id: 'sim-001',
    name: 'Tomatensoße Classic',
    article_number: 'TS-001',
    unit_id: 'unit-liter',
    has_supplier_prices: false,
  },
  {
    id: 'sim-002',
    name: 'Tomatensoße Classico',
    article_number: 'TS-002',
    unit_id: 'unit-liter',
    has_supplier_prices: false,
  },
  {
    id: 'sim-003',
    name: 'Tomatensauce Classic Bio',
    article_number: 'TS-003',
    unit_id: 'unit-liter',
    has_supplier_prices: false,
  },
]

// Test Extracted Positions (simulating PDF extraction results)
export const testPositions: ExtractedPosition[] = [
  // Exact article number match
  {
    article_name: 'Cola 1 Liter',
    article_number: 'CC-1000',
    unit: 'L',
  },
  // High confidence name match
  {
    article_name: 'Coca Cola 1L PET Flasche',
    article_number: null,
    unit: 'L',
  },
  // Low confidence name match (should be suggestion)
  {
    article_name: 'Mineralwasser',
    article_number: null,
    unit: 'L',
  },
  // No match expected
  {
    article_name: 'Champagner Dom Perignon',
    article_number: 'DP-001',
    unit: 'Fl',
  },
  // Article number with different formatting
  {
    article_name: 'Rinderfilet',
    article_number: 'RF 001',
    unit: 'kg',
  },
]

// Edge case positions
export const edgeCasePositions: ExtractedPosition[] = [
  // Empty name
  {
    article_name: '',
    article_number: null,
    unit: null,
  },
  // Very short name
  {
    article_name: 'A',
    article_number: null,
    unit: null,
  },
  // Special characters
  {
    article_name: 'Öl / Olivenöl (Extra Vergine)',
    article_number: null,
    unit: 'L',
  },
  // Case insensitive match
  {
    article_name: 'COCA COLA 1L PET',
    article_number: null,
    unit: 'L',
  },
]
