export {
  generateEmbedding,
  generateEmbeddingsBatch,
  generateArticleEmbedding,
  createArticleSearchText,
  formatEmbeddingForPostgres,
  parsePostgresEmbedding,
  EMBEDDING_CONFIG,
} from './service'

export type { EmbeddingResult, ArticleEmbeddingInput } from './service'
