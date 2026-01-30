import { Pinecone } from '@pinecone-database/pinecone';
import { AI_CONFIG, getPineconeApiKey } from '@/lib/ai/config';
import { getLLMClient } from '@/lib/ai/llm-client';
import { getCompanies, searchPhonesByModel, getAllPhones, getPhoneById, getFilteredPhones } from '@/lib/db/database';
import { VectorSearchResult, Phone, Filters } from '@/types';

/**
 * Vector Client for Pinecone
 * Used for typo correction and semantic similarity
 * Ported from Python implementation
 */
export class VectorClient {
  private pinecone: Pinecone;
  private indexName: string;
  private initialized: boolean = false;
  private hasApiKey: boolean = false;

  constructor() {
    const apiKey = getPineconeApiKey();
    this.hasApiKey = !!apiKey;

    if (this.hasApiKey) {
      this.pinecone = new Pinecone({ apiKey });
    } else {
      // Create a dummy instance - will use fallback mode
      this.pinecone = null as unknown as Pinecone;
    }
    this.indexName = AI_CONFIG.PINECONE_INDEX_NAME;
  }

  /**
   * Initialize the Pinecone index
   */
  async initIndex(): Promise<void> {
    if (this.initialized) return;

    // Skip if no API key - use fallback mode
    if (!this.hasApiKey) {
      this.initialized = false;
      return;
    }

    try {
      // Check if index exists
      const indexes = await this.pinecone.listIndexes();
      const indexExists = indexes.indexes?.some(idx => idx.name === this.indexName);

      if (!indexExists) {
        // Create index
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: AI_CONFIG.EMBEDDING_DIM,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });

        // Wait for index to be ready
        await this.waitForIndex();
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Pinecone index:', error);
      // Continue without vector search - graceful degradation
      this.initialized = false;
    }
  }

  /**
   * Wait for index to be ready
   */
  private async waitForIndex(): Promise<void> {
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      const description = await this.pinecone.describeIndex(this.indexName);
      if (description.status?.ready) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error('Timeout waiting for Pinecone index');
  }

  /**
   * Find similar items for typo correction
   */
  async findSimilar(
    query: string,
    typeFilter?: 'company' | 'model',
    companyFilter?: string,
    threshold: number = 0.7
  ): Promise<VectorSearchResult[]> {
    if (!this.initialized) {
      await this.initIndex();
    }

    if (!this.initialized) {
      // Fallback to fuzzy matching without vectors
      return this.fallbackSimilar(query, typeFilter);
    }

    try {
      const llm = getLLMClient();
      const embedding = await llm.embed(query.toLowerCase());

      const index = this.pinecone.index(this.indexName);

      // Build filter
      const filter: Record<string, unknown> = {};
      if (typeFilter) {
        filter.type = typeFilter;
      }
      if (companyFilter) {
        filter.company = companyFilter.toLowerCase();
      }

      const results = await index.query({
        vector: embedding,
        topK: 5,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        includeMetadata: true
      });

      return (results.matches || [])
        .filter(match => match.score && match.score >= threshold)
        .map(match => ({
          id: match.id,
          score: match.score || 0,
          metadata: match.metadata as VectorSearchResult['metadata']
        }));
    } catch (error) {
      console.error('Vector search failed:', error);
      return this.fallbackSimilar(query, typeFilter);
    }
  }

  /**
   * Fallback similarity using simple string matching
   */
  private async fallbackSimilar(
    query: string,
    typeFilter?: 'company' | 'model'
  ): Promise<VectorSearchResult[]> {
    const queryLower = query.toLowerCase();
    const results: VectorSearchResult[] = [];

    if (!typeFilter || typeFilter === 'company') {
      const companies = await getCompanies();
      for (const company of companies) {
        const score = this.stringSimilarity(queryLower, company.toLowerCase());
        if (score > 0.5) {
          results.push({
            id: `company-${company}`,
            score,
            metadata: { type: 'company', value: company }
          });
        }
      }
    }

    if (!typeFilter || typeFilter === 'model') {
      const phones = await searchPhonesByModel(query);
      for (const phone of phones.slice(0, 5)) {
        const score = this.stringSimilarity(queryLower, phone.model_name.toLowerCase());
        results.push({
          id: `model-${phone.id}`,
          score: Math.max(score, 0.6),
          metadata: {
            type: 'model',
            value: phone.model_name,
            company: phone.company_name
          }
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  /**
   * Simple string similarity (Levenshtein-based)
   */
  private stringSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Levenshtein distance
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  /**
   * Build index with company and model data (legacy - for typo correction)
   */
  async buildIndex(): Promise<void> {
    if (!this.initialized) {
      await this.initIndex();
    }

    if (!this.initialized) {
      return;
    }

    try {
      const llm = getLLMClient();
      const index = this.pinecone.index(this.indexName);

      // Index companies
      const companies = await getCompanies();
      const companyVectors = [];

      for (const company of companies) {
        const embedding = await llm.embed(company);
        companyVectors.push({
          id: `company-${company}`,
          values: embedding,
          metadata: { type: 'company', value: company }
        });
      }

      if (companyVectors.length > 0) {
        await index.upsert(companyVectors);
      }
    } catch (error) {
      console.error('Failed to build vector index:', error);
    }
  }

  /**
   * Build product index with rich phone descriptions for RAG
   * This embeds all phones with their full specs for semantic search
   */
  async buildProductIndex(onProgress?: (current: number, total: number) => void): Promise<{ success: boolean; count: number; message: string }> {
    if (!this.hasApiKey) {
      return { success: false, count: 0, message: 'Pinecone API key not configured' };
    }

    if (!this.initialized) {
      await this.initIndex();
    }

    if (!this.initialized) {
      return { success: false, count: 0, message: 'Failed to initialize Pinecone index' };
    }

    try {
      const llm = getLLMClient();
      const index = this.pinecone.index(this.indexName);
      const phones = await getAllPhones();

      // Process in batches of 10 to avoid rate limits
      const batchSize = 10;
      let indexed = 0;

      for (let i = 0; i < phones.length; i += batchSize) {
        const batch = phones.slice(i, i + batchSize);
        const vectors = [];

        for (const phone of batch) {
          // Create rich text description for embedding
          const description = this.createPhoneDescription(phone);
          const embedding = await llm.embed(description);

          if (embedding.length > 0) {
            vectors.push({
              id: `product-${phone.id}`,
              values: embedding,
              metadata: {
                type: 'product',
                id: phone.id,
                company: phone.company_name,
                model: phone.model_name,
                price: phone.price_inr,
                ram: phone.ram_gb,
                battery: phone.battery_mah,
                camera: phone.back_camera_mp,
                rating: phone.user_rating,
                description: description.substring(0, 500) // Truncate for metadata
              }
            });
          }
        }

        if (vectors.length > 0) {
          await index.upsert(vectors);
          indexed += vectors.length;
        }

        onProgress?.(indexed, phones.length);

        // Small delay between batches to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      return { success: true, count: indexed, message: `Indexed ${indexed} phones successfully` };
    } catch (error) {
      console.error('Failed to build product index:', error);
      return { success: false, count: 0, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Create rich text description for a phone for embedding
   */
  private createPhoneDescription(phone: Phone): string {
    const features: string[] = [];

    // Camera features
    if (phone.back_camera_mp >= 100) features.push('flagship camera', '100MP+', 'pro photography');
    else if (phone.back_camera_mp >= 64) features.push('high resolution camera', '64MP+', 'good photography');
    else if (phone.back_camera_mp >= 48) features.push('quality camera', '48MP');

    if (phone.front_camera_mp >= 32) features.push('great selfie camera', 'vlogging', 'video calling');
    else if (phone.front_camera_mp >= 16) features.push('good front camera', 'selfies');

    // Gaming/Performance features
    if (phone.ram_gb >= 12) features.push('gaming powerhouse', 'multitasking', 'heavy gaming', 'BGMI', 'Free Fire');
    else if (phone.ram_gb >= 8) features.push('smooth gaming', 'good performance');
    else if (phone.ram_gb >= 6) features.push('casual gaming', 'everyday use');

    // Battery features
    if (phone.battery_mah >= 6000) features.push('massive battery', 'two-day battery', 'power user');
    else if (phone.battery_mah >= 5000) features.push('all-day battery', 'long lasting');
    else if (phone.battery_mah >= 4500) features.push('good battery life');

    // Storage features
    if (phone.memory_gb >= 256) features.push('lots of storage', 'store many apps', 'photos and videos');
    else if (phone.memory_gb >= 128) features.push('good storage', '128GB');

    // Price category features
    if (phone.price_inr < 15000) features.push('budget friendly', 'affordable', 'value for money', 'entry level');
    else if (phone.price_inr < 25000) features.push('mid-range', 'balanced', 'good value');
    else if (phone.price_inr < 40000) features.push('upper mid-range', 'premium features');
    else if (phone.price_inr < 60000) features.push('flagship', 'premium', 'high-end');
    else features.push('ultra premium', 'flagship killer', 'top of the line');

    // Screen features
    if (phone.screen_size >= 6.7) features.push('large display', 'big screen', 'media consumption', 'presentations');
    else if (phone.screen_size >= 6.4) features.push('comfortable display');
    else if (phone.screen_size <= 6.0) features.push('compact', 'one-hand use');

    // Rating features
    if (phone.user_rating >= 4.5) features.push('highly rated', 'user favorite', 'top rated');
    else if (phone.user_rating >= 4.0) features.push('well reviewed', 'good ratings');

    return `${phone.company_name} ${phone.model_name}. ` +
      `Price ₹${phone.price_inr.toLocaleString('en-IN')}. ` +
      `${phone.ram_gb}GB RAM, ${phone.memory_gb}GB storage. ` +
      `${phone.back_camera_mp}MP rear camera, ${phone.front_camera_mp}MP front camera. ` +
      `${phone.battery_mah}mAh battery. ` +
      `${phone.screen_size}" display. ` +
      `Processor: ${phone.processor}. ` +
      `Rating: ${phone.user_rating}/5. ` +
      `Features: ${features.join(', ')}.`;
  }

  /**
   * Semantic search for products using natural language query
   * This is the core RAG retrieval function
   */
  async searchProducts(
    query: string,
    filters?: {
      maxPrice?: number;
      minPrice?: number;
      minRam?: number;
      minBattery?: number;
      company?: string;
    },
    topK: number = 5
  ): Promise<Phone[]> {
    // If no API key or not initialized, fall back to database search
    if (!this.hasApiKey || !this.initialized) {
      return this.fallbackProductSearch(query, filters, topK);
    }

    try {
      const llm = getLLMClient();
      const embedding = await llm.embed(query);

      if (embedding.length === 0) {
        return this.fallbackProductSearch(query, filters, topK);
      }

      const index = this.pinecone.index(this.indexName);

      // Build Pinecone filter
      const pineconeFilter: Record<string, unknown> = { type: 'product' };

      if (filters?.maxPrice) {
        pineconeFilter.price = { $lte: filters.maxPrice };
      }
      if (filters?.minPrice) {
        pineconeFilter.price = { ...(pineconeFilter.price as object || {}), $gte: filters.minPrice };
      }
      if (filters?.minRam) {
        pineconeFilter.ram = { $gte: filters.minRam };
      }
      if (filters?.minBattery) {
        pineconeFilter.battery = { $gte: filters.minBattery };
      }
      if (filters?.company) {
        pineconeFilter.company = filters.company.toLowerCase();
      }

      const results = await index.query({
        vector: embedding,
        topK: topK,
        filter: pineconeFilter,
        includeMetadata: true
      });

      // Fetch full phone data from database
      const phones: Phone[] = [];
      for (const match of results.matches || []) {
        const phoneId = match.metadata?.id as number;
        if (phoneId) {
          const phone = await getPhoneById(phoneId);
          if (phone) {
            phones.push(phone);
          }
        }
      }

      return phones;
    } catch (error) {
      console.error('Semantic search failed:', error);
      return this.fallbackProductSearch(query, filters, topK);
    }
  }

  /**
   * Fallback product search using database when Pinecone is unavailable
   */
  private async fallbackProductSearch(
    query: string,
    filters?: {
      maxPrice?: number;
      minPrice?: number;
      minRam?: number;
      minBattery?: number;
      company?: string;
    },
    limit: number = 5
  ): Promise<Phone[]> {
    const dbFilters: Filters = {};

    if (filters?.maxPrice) dbFilters.maxPrice = filters.maxPrice;
    if (filters?.minPrice) dbFilters.minPrice = filters.minPrice;
    if (filters?.minRam) dbFilters.minRam = filters.minRam;
    if (filters?.minBattery) dbFilters.minBattery = filters.minBattery;
    if (filters?.company) dbFilters.company = filters.company;

    const phones = await getFilteredPhones(dbFilters);
    return phones.slice(0, limit);
  }

  /**
   * Check if product index exists and has data
   */
  async hasProductIndex(): Promise<boolean> {
    if (!this.hasApiKey || !this.initialized) {
      return false;
    }

    try {
      const index = this.pinecone.index(this.indexName);
      const stats = await index.describeIndexStats();
      return (stats.totalRecordCount || 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Delete and recreate the index with correct dimensions
   * Use this when switching embedding models (e.g., Gemini -> OpenAI)
   */
  async recreateIndex(): Promise<{ success: boolean; message: string }> {
    if (!this.hasApiKey) {
      return { success: false, message: 'Pinecone API key not configured' };
    }

    try {
      // Delete existing index if it exists
      const indexes = await this.pinecone.listIndexes();
      const indexExists = indexes.indexes?.some(idx => idx.name === this.indexName);

      if (indexExists) {
        await this.pinecone.deleteIndex(this.indexName);

        // Wait for deletion to complete
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Create new index with correct dimensions
      await this.pinecone.createIndex({
        name: this.indexName,
        dimension: AI_CONFIG.EMBEDDING_DIM,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });

      // Wait for index to be ready
      await this.waitForIndex();

      this.initialized = true;
      return { success: true, message: `Index recreated with dimension ${AI_CONFIG.EMBEDDING_DIM}` };
    } catch (error) {
      console.error('Failed to recreate index:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Singleton instance
let vectorClientInstance: VectorClient | null = null;

export function getVectorClient(): VectorClient {
  if (!vectorClientInstance) {
    vectorClientInstance = new VectorClient();
  }
  return vectorClientInstance;
}
