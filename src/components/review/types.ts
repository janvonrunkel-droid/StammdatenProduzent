import type { ExtractionPosition, ExtractionTotals, ExtractionRawData, ExtractionResult } from '@/components/documents/extraction-result-dialog'

// Re-export for convenience
export type { ExtractionPosition, ExtractionTotals, ExtractionRawData, ExtractionResult }

// Extended types for review functionality
export interface ReviewDocument {
  id: string
  original_filename: string | null
  document_number: string | null
  document_date: string | null
  type: 'invoice' | 'quote' | 'manual'
  status: string
  file_url?: string
  file_path: string
  uploaded_at: string
  supplier?: {
    id: string
    name: string
  } | null
}

export interface ReviewExtraction extends ExtractionResult {
  document: ReviewDocument
}

export interface ReviewQueueItem {
  id: string
  document_id: string
  document_filename: string | null
  document_number: string | null
  document_type: 'invoice' | 'quote' | 'manual'
  supplier_name: string | null
  supplier_id: string | null
  positions_count: number
  confidence_score: number | null
  extraction_method: string | null
  has_warnings: boolean
  uploaded_at: string
  created_at: string
}

export interface ReviewQueueResponse {
  data: ReviewQueueItem[]
  total: number
}

// Position with edit state
export interface EditablePosition extends ExtractionPosition {
  id: string
  article_id?: string | null
  is_deleted?: boolean
  is_new?: boolean
  original_unit?: string | null // Original unit before normalization
}

// Review state for the editor
export interface ReviewState {
  metadata: {
    supplier_id: string | null
    document_date: string | null
    document_number: string | null
    document_type: 'invoice' | 'quote'
  }
  positions: EditablePosition[]
  corrections: Correction[]
  isDirty: boolean
  saveStatus: 'saved' | 'saving' | 'error'
}

export interface Correction {
  field: string
  original: unknown
  corrected: unknown
  timestamp: string
}

// Article match for suggestions
export interface ArticleMatch {
  id: string
  name: string
  article_number: string | null
  unit_name: string
  unit_abbreviation: string | null
  match_score: number
  last_price?: {
    price_per_unit: number
    supplier_name: string
    price_date: string
  } | null
}

// Unit for normalization
export interface UnitOption {
  id: string
  name: string
  abbreviation: string | null
}

// Reject reasons
export const REJECT_REASONS = [
  { value: 'not_readable', label: 'Nicht lesbar' },
  { value: 'wrong_document', label: 'Falsches Dokument (keine Rechnung/Angebot)' },
  { value: 'duplicate', label: 'Duplikat' },
  { value: 'incomplete', label: 'Unvollständig' },
  { value: 'other', label: 'Sonstiges' },
] as const

export type RejectReason = typeof REJECT_REASONS[number]['value']
