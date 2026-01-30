/**
 * Unit normalization configuration
 * Maps various spellings and abbreviations to standard unit abbreviations
 */

// Mapping from various input spellings to standard abbreviation
export const UNIT_MAPPINGS: Record<string, string> = {
  // Square meters (m²)
  'qm': 'm²',
  'QM': 'm²',
  'quadratmeter': 'm²',
  'Quadratmeter': 'm²',
  'm2': 'm²',
  'M2': 'm²',
  'm²': 'm²',

  // Cubic meters (m³)
  'cbm': 'm³',
  'CBM': 'm³',
  'kubikmeter': 'm³',
  'Kubikmeter': 'm³',
  'm3': 'm³',
  'M3': 'm³',
  'm³': 'm³',

  // Pieces (Stück)
  'stk': 'Stück',
  'Stk': 'Stück',
  'stk.': 'Stück',
  'Stk.': 'Stück',
  'st': 'Stück',
  'St': 'Stück',
  'st.': 'Stück',
  'St.': 'Stück',
  'stück': 'Stück',
  'Stück': 'Stück',
  'stueck': 'Stück',
  'Stueck': 'Stück',
  'pcs': 'Stück',
  'Pcs': 'Stück',

  // Kilograms (kg)
  'kg': 'kg',
  'Kg': 'kg',
  'KG': 'kg',
  'kilogramm': 'kg',
  'Kilogramm': 'kg',
  'kilo': 'kg',
  'Kilo': 'kg',

  // Tons (t)
  'to': 't',
  'To': 't',
  'TO': 't',
  't': 't',
  'T': 't',
  'tonne': 't',
  'Tonne': 't',
  'tonnen': 't',
  'Tonnen': 't',

  // Linear meters (lfm)
  'lfm': 'lfm',
  'Lfm': 'lfm',
  'LFM': 'lfm',
  'lfdm': 'lfm',
  'Lfdm': 'lfm',
  'laufmeter': 'lfm',
  'Laufmeter': 'lfm',
  'lfd. m': 'lfm',
  'lfd.m': 'lfm',

  // Meters (m)
  'm': 'm',
  'M': 'm',
  'meter': 'm',
  'Meter': 'm',

  // Liters (l)
  'l': 'l',
  'L': 'l',
  'ltr': 'l',
  'Ltr': 'l',
  'liter': 'l',
  'Liter': 'l',

  // Flat rate / Pauschal
  'psch': 'Pauschal',
  'Psch': 'Pauschal',
  'PSCH': 'Pauschal',
  'psch.': 'Pauschal',
  'Psch.': 'Pauschal',
  'pauschal': 'Pauschal',
  'Pauschal': 'Pauschal',
  'pausch': 'Pauschal',
  'Pausch': 'Pauschal',
  'pauschale': 'Pauschal',
  'Pauschale': 'Pauschal',
  'pa': 'Pauschal',
  'PA': 'Pauschal',

  // Hours (Stunden)
  'std': 'Std',
  'Std': 'Std',
  'std.': 'Std',
  'Std.': 'Std',
  'stunden': 'Std',
  'Stunden': 'Std',
  'stunde': 'Std',
  'Stunde': 'Std',
  'h': 'Std',
  'H': 'Std',

  // Packages (Packung)
  'pkg': 'Pkg',
  'Pkg': 'Pkg',
  'pkg.': 'Pkg',
  'Pkg.': 'Pkg',
  'pack': 'Pkg',
  'Pack': 'Pkg',
  'packung': 'Pkg',
  'Packung': 'Pkg',

  // Bags (Sack)
  'sack': 'Sack',
  'Sack': 'Sack',
  'säck': 'Sack',
  'Säck': 'Sack',

  // Pallets (Palette)
  'pal': 'Palette',
  'Pal': 'Palette',
  'pal.': 'Palette',
  'Pal.': 'Palette',
  'palette': 'Palette',
  'Palette': 'Palette',
  'paletten': 'Palette',
  'Paletten': 'Palette',
}

/**
 * Normalize a unit string to its standard form
 * @param input The raw unit string from extraction
 * @returns The normalized unit string, or the original if no mapping found
 */
export function normalizeUnit(input: string | null | undefined): string | null {
  if (!input) return null

  // Trim and try direct lookup
  const trimmed = input.trim()
  if (UNIT_MAPPINGS[trimmed]) {
    return UNIT_MAPPINGS[trimmed]
  }

  // Try lowercase lookup
  const lower = trimmed.toLowerCase()
  for (const [key, value] of Object.entries(UNIT_MAPPINGS)) {
    if (key.toLowerCase() === lower) {
      return value
    }
  }

  // No mapping found, return original
  return trimmed
}

/**
 * Get the original unit alongside its normalized form
 * @param input The raw unit string from extraction
 * @returns Object with original and normalized values
 */
export function getNormalizedUnitInfo(input: string | null | undefined): {
  original: string | null
  normalized: string | null
  wasNormalized: boolean
} {
  if (!input) {
    return { original: null, normalized: null, wasNormalized: false }
  }

  const normalized = normalizeUnit(input)
  return {
    original: input.trim(),
    normalized,
    wasNormalized: normalized !== input.trim(),
  }
}

/**
 * Get all standard unit abbreviations
 */
export function getStandardUnits(): string[] {
  return [...new Set(Object.values(UNIT_MAPPINGS))]
}
