// AI Configuration - supports OpenAI models

export const AI_CONFIG = {
  // OpenAI models
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',

  // Embedding dimension - OpenAI text-embedding-3-small uses 1536
  EMBEDDING_DIM: 1536,

  // Rate limiting
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,

  // Pinecone config
  PINECONE_INDEX_NAME: 'phone-shopping-agent',

  // Database
  DB_PATH: './data/mobiles_india.db',
  CSV_PATH: './data/mobiles_india.csv',

  // Table schema columns (for reference)
  TABLE_SCHEMA: [
    'Company Name',
    'Model Name',
    'Processor',
    'Launched Year',
    'User Rating.1',
    'User Review.1',
    'User Camera Rating',
    'User Battery Life Rating',
    'User Design Rating',
    'User Display Rating',
    'User Performance Rating',
    'Memory (GB)',
    'Mobile Weight (g)',
    'RAM (GB)',
    'Front Camera (MP)',
    'Back Camera (MP)',
    'Battery Capacity (mAh)',
    'Launched Price (INR)',
    'Screen Size (inches)'
  ],

  TABLE_NAME: 'phones'
};

// Environment variables
export function getOpenAIApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return key;
}

export function getPineconeApiKey(): string {
  const key = process.env.PINECONE_API_KEY;
  if (!key) {
    console.warn('PINECONE_API_KEY not set - vector search will use fallback mode');
    return '';
  }
  return key;
}

// Legacy Gemini function (kept for compatibility if needed)
export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn('GEMINI_API_KEY not set');
    return '';
  }
  return key;
}
