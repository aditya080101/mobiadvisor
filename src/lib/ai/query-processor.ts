import { getLLMClient, LLMClient } from './llm-client';
import { getVectorClient, VectorClient } from '@/lib/vector/vector-client';
import { queryPhones, getFilteredPhones } from '@/lib/db/database';
import { Phone, Filters, ParsedIntent, ChatResponse, ChatHistoryMessage } from '@/types';

/**
 * Query Processor - Main orchestrator for the chat agent
 * Supports conversation history for context-aware responses
 */
export class QueryProcessor {
  private llm: LLMClient;
  private vector: VectorClient;

  constructor() {
    this.llm = getLLMClient();
    this.vector = getVectorClient();
  }

  /**
   * Process a user query with optional conversation history
   */
  async process(
    userQuery: string,
    filters: Filters = {},
    history: ChatHistoryMessage[] = [],
    onStatus?: (status: string) => void
  ): Promise<ChatResponse> {
    try {
      // PRE-CHECK: Handle follow-up queries directly without LLM classification
      const previousPhones = this.getPhonesFromHistory(history);
      if (this.isFollowUpQuery(userQuery) && previousPhones.length > 0) {
        onStatus?.('Understanding your query...');

        // Check if user is asking for the "best" phone - only return the top one
        const isBestQuery = this.isBestPhoneQuery(userQuery);

        if (isBestQuery && previousPhones.length > 1) {
          // Sort by rating and return only the best phone
          const sortedPhones = [...previousPhones].sort((a, b) => b.user_rating - a.user_rating);
          const bestPhone = sortedPhones[0];
          const summary = await this.llm.summarize(userQuery, [bestPhone], history);
          return {
            message: summary,
            phones: [bestPhone]
          };
        }

        // This is a general follow-up about phones, return all
        const summary = await this.llm.summarize(userQuery, previousPhones, history);
        return {
          message: summary,
          phones: previousPhones.slice(0, 5)
        };
      }

      // Step 1: Parse intent with history context
      onStatus?.('Understanding your query...');
      const intent = await this.llm.parseIntent(userQuery, history);


      // Check for rejected queries (safety) - be more lenient
      if (intent.task === 'reject') {
        // Double-check: if there are phones in history and query seems related, don't reject
        if (previousPhones.length > 0) {
          // User might be asking about previous phones, try to help anyway
          const summary = await this.llm.summarize(userQuery, previousPhones, history);
          return {
            message: summary,
            phones: previousPhones.slice(0, 5)
          };
        }
        return {
          message: "I'm sorry, but I can only help with questions about mobile phones and related technology. Is there something about phones I can help you with?"
        };
      }

      // Step 2: Handle general QA
      if (intent.task === 'general_qa') {
        onStatus?.('Thinking...');
        const answer = await this.llm.answerGeneral(userQuery, history);
        return { message: answer };
      }

      // Step 3: Apply typo corrections
      onStatus?.('Searching phones...');
      const correctedIntent = await this.applyCorrections(intent);


      // Step 4: Merge filters
      const mergedFilters = this.mergeFilters(filters, correctedIntent);

      // Step 5: Execute query
      let phones: Phone[];

      if (correctedIntent.comparison_type === 'multi' && correctedIntent.entities?.model?.length) {
        // Multi-model comparison
        phones = await this.processMultiModel(correctedIntent);
      } else if (correctedIntent.comparison_type === 'multi' && correctedIntent.entities?.company?.length && correctedIntent.entities.company.length >= 2) {
        // Multi-brand comparison (e.g., "iPhone vs Samsung")
        phones = await this.processMultiBrand(correctedIntent);
      } else if (this.isFollowUpQuery(userQuery) && previousPhones.length > 0) {
        // Follow-up query - use phones from history
        phones = previousPhones;
      } else {
        // Single query - pass original query for semantic search
        phones = await this.processSingleQuery(correctedIntent, mergedFilters, userQuery);
      }

      // Step 7: Generate summary with history context
      onStatus?.('Preparing response...');
      const summary = await this.llm.summarize(userQuery, phones, history);

      return {
        message: summary,
        phones: phones.slice(0, 5)
      };
    } catch (error) {
      console.error('Query processing error:', error);

      // Detect specific error types for better messaging
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = this.classifyError(errorMessage);

      // FALLBACK STRATEGY: Try to get database results even if LLM fails
      try {
        onStatus?.('Searching database...');
        const fallbackPhones = await this.getFallbackResults(userQuery);

        if (fallbackPhones.length > 0) {
          // Return phones with a helpful message explaining the situation
          return {
            message: this.generateFallbackMessage(errorDetails.userMessage, fallbackPhones),
            phones: fallbackPhones.slice(0, 5),
            warning: errorDetails.userMessage
          };
        }
      } catch (fallbackError) {
        console.error('Fallback search also failed:', fallbackError);
      }

      // If fallback also failed, return detailed error
      return {
        message: errorDetails.userMessage,
        error: errorDetails.technicalMessage
      };
    }
  }

  /**
   * Classify error type and provide appropriate user messaging
   */
  private classifyError(errorMessage: string): { userMessage: string; technicalMessage: string } {
    const lowerError = errorMessage.toLowerCase();

    // Rate limit / quota errors
    if (lowerError.includes('rate_limit') || lowerError.includes('rate limit') ||
      lowerError.includes('429') || lowerError.includes('too many requests')) {
      return {
        userMessage: "⏳ Our AI service is temporarily busy. While waiting, here are some phones that might match your query:",
        technicalMessage: "Rate limit exceeded"
      };
    }

    // Quota / billing errors
    if (lowerError.includes('quota') || lowerError.includes('insufficient_quota') ||
      lowerError.includes('billing') || lowerError.includes('exceeded')) {
      return {
        userMessage: "⚠️ AI service quota reached. Here are phones from our database that match your search:",
        technicalMessage: "API quota exceeded"
      };
    }

    // Network / connection errors
    if (lowerError.includes('network') || lowerError.includes('connection') ||
      lowerError.includes('econnrefused') || lowerError.includes('timeout') ||
      lowerError.includes('fetch failed')) {
      return {
        userMessage: "🌐 Connection issue with AI service. Here are phones that might help:",
        technicalMessage: "Network connection error"
      };
    }

    // Invalid API key
    if (lowerError.includes('invalid_api_key') || lowerError.includes('authentication') ||
      lowerError.includes('unauthorized') || lowerError.includes('401')) {
      return {
        userMessage: "🔑 AI service configuration issue. Here are some phone recommendations from our database:",
        technicalMessage: "API authentication error"
      };
    }

    // Generic error
    return {
      userMessage: "Sorry, I couldn't generate a personalized response. Here are some phones that might match your search:",
      technicalMessage: errorMessage
    };
  }

  /**
   * Get fallback results using simple keyword search in database
   */
  private async getFallbackResults(query: string): Promise<Phone[]> {
    const keywords = query.toLowerCase().split(/\s+/);

    // Extract potential filters from query
    const filters: Filters = {};

    // Check for price mentions
    const priceMatch = query.match(/(\d{1,3})[k,K]|\₹?\s*(\d{4,6})/);
    if (priceMatch) {
      const priceValue = priceMatch[1]
        ? parseInt(priceMatch[1]) * 1000
        : parseInt(priceMatch[2] || '0');

      if (query.toLowerCase().includes('under') || query.toLowerCase().includes('below')) {
        filters.maxPrice = priceValue;
      } else if (query.toLowerCase().includes('above') || query.toLowerCase().includes('over')) {
        filters.minPrice = priceValue;
      } else {
        // Assume under if price mentioned
        filters.maxPrice = priceValue + 10000;
        filters.minPrice = Math.max(0, priceValue - 10000);
      }
    }

    // Check for brand mentions
    const brands = ['samsung', 'apple', 'iphone', 'xiaomi', 'oneplus', 'vivo', 'oppo', 'realme', 'motorola'];
    for (const brand of brands) {
      if (keywords.includes(brand) || keywords.includes(brand + 's')) {
        filters.company = brand === 'iphone' ? 'apple' : brand;
        break;
      }
    }

    // Get phones with extracted filters
    const phones = await getFilteredPhones(filters);

    // Sort by relevance (user rating and popularity)
    return phones.sort((a, b) => (b.user_rating || 0) - (a.user_rating || 0)).slice(0, 8);
  }

  /**
   * Generate a helpful fallback message with phone details
   */
  private generateFallbackMessage(warningMessage: string, phones: Phone[]): string {
    const phoneList = phones.slice(0, 5).map((p, i) =>
      `${i + 1}. **${p.company_name} ${p.model_name}** - ₹${p.price_inr?.toLocaleString('en-IN') || 'N/A'}`
    ).join('\n');

    return `${warningMessage}\n\n${phoneList}\n\n*Click on any phone card below for full specifications.*`;
  }

  /**
   * Check if query is a follow-up about previous phones
   */
  private isFollowUpQuery(query: string): boolean {
    const followUpPhrases = [
      'tell me more',
      'more about',
      'first one',
      'second one',
      'this phone',
      'that phone',
      'the first',
      'the second',
      'which one',
      'more details',
      'explain',
      'why',
      'what about',
      // Best phone phrases
      'which is best',
      'which is the best',
      'best among',
      'best one',
      'best phone',
      'recommend',
      'should i buy',
      'should i get',
      'which should i',
      'top pick',
      'top choice',
      'among these',
      'among all',
      'of these',
      'out of these'
    ];
    const lowerQuery = query.toLowerCase();
    return followUpPhrases.some(phrase => lowerQuery.includes(phrase));
  }

  /**
   * Check if query is asking for the "best" phone recommendation
   */
  private isBestPhoneQuery(query: string): boolean {
    const bestPhrases = [
      'which is best',
      'which one is best',
      'which phone is best',
      'which is the best',
      'which one is the best',
      'which phone is the best',
      'best among',
      'best one',
      'best phone',
      'recommend one',
      'recommend me one',
      'should i buy',
      'should i get',
      'which should i',
      'pick one',
      'top choice',
      'top pick'
    ];
    const lowerQuery = query.toLowerCase();
    return bestPhrases.some(phrase => lowerQuery.includes(phrase));
  }

  /**
   * Extract phones from conversation history
   */
  private getPhonesFromHistory(history: ChatHistoryMessage[]): Phone[] {
    // Look through history in reverse to find the most recent phones
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].phones && history[i].phones!.length > 0) {
        return history[i].phones!;
      }
    }
    return [];
  }

  /**
   * Apply typo corrections using vector similarity
   */
  private async applyCorrections(intent: ParsedIntent): Promise<ParsedIntent> {
    const corrected = { ...intent };

    // Correct company names
    if (intent.entities?.company) {
      const correctedCompanies: string[] = [];
      for (const company of intent.entities.company) {
        const similar = await this.vector.findSimilar(company, 'company');
        if (similar.length > 0 && similar[0].score > 0.7) {
          correctedCompanies.push(similar[0].metadata.value);
        } else {
          correctedCompanies.push(company);
        }
      }
      corrected.entities = { ...corrected.entities, company: correctedCompanies };
    }

    // Correct model names
    if (intent.entities?.model) {
      const correctedModels: string[] = [];
      for (const model of intent.entities.model) {
        const similar = await this.vector.findSimilar(model, 'model');
        if (similar.length > 0 && similar[0].score > 0.7) {
          correctedModels.push(similar[0].metadata.value);
        } else {
          correctedModels.push(model);
        }
      }
      corrected.entities = { ...corrected.entities, model: correctedModels };
    }

    return corrected;
  }

  /**
   * Merge sidebar filters with LLM-extracted constraints
   */
  private mergeFilters(filters: Filters, intent: ParsedIntent): Filters {
    const merged = { ...filters };

    // Apply constraints from intent
    const constraints = intent.constraints || {};

    if (constraints.min_price && (!merged.minPrice || constraints.min_price > merged.minPrice)) {
      merged.minPrice = constraints.min_price;
    }
    if (constraints.max_price && (!merged.maxPrice || constraints.max_price < merged.maxPrice)) {
      merged.maxPrice = constraints.max_price;
    }
    if (constraints.min_ram && (!merged.minRam || constraints.min_ram > merged.minRam)) {
      merged.minRam = constraints.min_ram;
    }
    if (constraints.max_ram && (!merged.maxRam || constraints.max_ram < merged.maxRam)) {
      merged.maxRam = constraints.max_ram;
    }
    if (constraints.min_battery && (!merged.minBattery || constraints.min_battery > merged.minBattery)) {
      merged.minBattery = constraints.min_battery;
    }
    if (constraints.max_battery && (!merged.maxBattery || constraints.max_battery < merged.maxBattery)) {
      merged.maxBattery = constraints.max_battery;
    }
    if (constraints.min_camera && (!merged.minCamera || constraints.min_camera > merged.minCamera)) {
      merged.minCamera = constraints.min_camera;
    }
    if (constraints.max_camera && (!merged.maxCamera || constraints.max_camera < merged.maxCamera)) {
      merged.maxCamera = constraints.max_camera;
    }
    if (constraints.min_storage && (!merged.minStorage || constraints.min_storage > merged.minStorage)) {
      merged.minStorage = constraints.min_storage;
    }
    if (constraints.max_storage && (!merged.maxStorage || constraints.max_storage < merged.maxStorage)) {
      merged.maxStorage = constraints.max_storage;
    }

    // Apply company from intent if not in filters
    if (intent.entities?.company?.length && !merged.company) {
      merged.company = intent.entities.company[0];
    }

    return merged;
  }

  /**
   * Infer company from model name for better matching
   */
  private inferCompanyFromModel(model: string): string | null {
    const lowerModel = model.toLowerCase();
    const companyPatterns: Record<string, string[]> = {
      'samsung': ['galaxy', 's24', 's23', 's22', 's21', 'a55', 'a54', 'a53', 'm54', 'm53', 'fold', 'flip'],
      'apple': ['iphone'],
      'google': ['pixel'],
      'oneplus': ['oneplus', 'nord'],
      'xiaomi': ['redmi', 'poco', 'mi '],
      'realme': ['realme'],
      'oppo': ['oppo', 'reno', 'find'],
      'vivo': ['vivo', 'iqoo'],
      'motorola': ['moto', 'edge', 'razr'],
      'nothing': ['nothing', 'phone ('],
      'honor': ['honor', 'magic'],
      'huawei': ['huawei', 'mate', 'p60', 'p50'],
    };

    for (const [company, patterns] of Object.entries(companyPatterns)) {
      if (patterns.some(p => lowerModel.includes(p))) {
        return company;
      }
    }
    return null;
  }

  /**
   * Process multi-brand comparison query (e.g., "iPhone vs Samsung")
   * Fetches top-rated phones from each brand for comparison
   */
  private async processMultiBrand(intent: ParsedIntent): Promise<Phone[]> {
    const phones: Phone[] = [];
    const companies = intent.entities?.company || [];


    // Brand name mappings to handle variations
    const brandMappings: Record<string, string[]> = {
      'apple': ['apple', 'iphone'],
      'samsung': ['samsung', 'galaxy'],
      'google': ['google', 'pixel'],
      'oneplus': ['oneplus', 'one plus'],
      'xiaomi': ['xiaomi', 'redmi', 'poco'],
      'realme': ['realme'],
      'oppo': ['oppo', 'reno'],
      'vivo': ['vivo', 'iqoo'],
      'motorola': ['motorola', 'moto'],
      'nothing': ['nothing'],
      'honor': ['honor'],
      'huawei': ['huawei'],
    };

    for (const company of companies) {
      const lowerCompany = company.toLowerCase();

      // Find matching brand names
      let searchTerms: string[] = [lowerCompany];
      for (const [brand, aliases] of Object.entries(brandMappings)) {
        if (aliases.some(alias => lowerCompany.includes(alias)) || lowerCompany.includes(brand)) {
          searchTerms = [brand, ...aliases];
          break;
        }
      }


      // Query for top phones from this brand
      let results: Phone[] = [];
      for (const term of searchTerms) {
        const sql = `
          SELECT * FROM phones 
          WHERE LOWER(company_name) LIKE LOWER(?)
          ORDER BY user_rating DESC, price_inr ASC
          LIMIT 3
        `;
        results = await queryPhones(sql, [`%${term}%`]);
        if (results.length > 0) {
          break;
        }
      }

      // Add unique phones to results
      for (const phone of results) {
        if (!phones.some(p => p.id === phone.id)) {
          phones.push(phone);
        }
      }
    }

    return phones;
  }

  /**
   * Process multi-model comparison query
   * Improved with comprehensive aliases, company inference, and smart search
   */
  private async processMultiModel(intent: ParsedIntent): Promise<Phone[]> {
    const phones: Phone[] = [];
    const models = intent.entities?.model || [];
    const companies = intent.entities?.company || [];

    // Comprehensive model aliases
    const modelAliases: Record<string, string[]> = {
      // Samsung Galaxy S-series
      's24': ['galaxy s24 128gb', 'galaxy s24 256gb', 'galaxy s24'],
      's24 ultra': ['galaxy s24 ultra 128gb', 'galaxy s24 ultra 256gb', 's24 ultra'],
      's24+': ['galaxy s24+ 128gb', 'galaxy s24+ 256gb', 's24+'],
      's23': ['galaxy s23 128gb', 'galaxy s23 256gb', 'galaxy s23'],
      's23 ultra': ['galaxy s23 ultra', 's23 ultra'],
      // Samsung Galaxy A-series
      'a55': ['galaxy a55', 'a55 5g'],
      'a54': ['galaxy a54', 'a54 5g'],
      // iPhones
      'iphone 15': ['iphone 15', 'iphone 15 128gb'],
      'iphone 15 pro': ['iphone 15 pro', 'iphone 15 pro 128gb', 'iphone 15 pro 256gb'],
      'iphone 15 pro max': ['iphone 15 pro max', 'iphone 15 pro max 128gb', 'iphone 15 pro max 256gb'],
      'iphone 14': ['iphone 14', 'iphone 14 128gb'],
      // Google Pixel
      'pixel 8': ['pixel 8', 'pixel 8 128gb'],
      'pixel 8 pro': ['pixel 8 pro', 'pixel 8 pro 128gb'],
      'pixel 8a': ['pixel 8a', 'pixel 8a 128gb'],
      // OnePlus
      'oneplus 12': ['oneplus 12', 'oneplus 12 256gb'],
      'oneplus 12r': ['oneplus 12r', 'oneplus 12r 128gb'],
      'oneplus nord': ['nord ce', 'nord 3', 'nord 4'],
      // Xiaomi/Redmi
      'redmi note 13': ['redmi note 13', 'redmi note 13 pro', 'redmi note 13 pro+'],
      // Nothing
      'nothing phone': ['phone (1)', 'phone (2)', 'phone 2a'],
    };

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      // Get company from intent or infer from model name
      let company = companies[i] || companies[0] || this.inferCompanyFromModel(model);

      let results: Phone[] = [];
      const lowerModel = model.toLowerCase();


      // Strategy 1: Try exact model aliases first
      const aliases = modelAliases[lowerModel] || [];
      for (const alias of aliases) {
        const sql = `
          SELECT * FROM phones 
          WHERE LOWER(model_name) LIKE LOWER(?)
          ORDER BY user_rating DESC 
          LIMIT 1
        `;
        results = await queryPhones(sql, [`%${alias}%`]);
        if (results.length > 0) {
          break;
        }
      }

      // Strategy 2: Company + model search
      if (results.length === 0 && company) {
        const sql = `
          SELECT * FROM phones 
          WHERE LOWER(company_name) LIKE LOWER(?) 
            AND LOWER(model_name) LIKE LOWER(?)
          ORDER BY user_rating DESC 
          LIMIT 1
        `;
        results = await queryPhones(sql, [`%${company}%`, `%${model}%`]);
      }

      // Strategy 3: Direct model search (broader)
      if (results.length === 0) {
        const sql = `
          SELECT * FROM phones 
          WHERE LOWER(model_name) LIKE LOWER(?)
          ORDER BY user_rating DESC 
          LIMIT 1
        `;
        results = await queryPhones(sql, [`%${model}%`]);
      }

      // Strategy 4: Galaxy prefix for Samsung models
      if (results.length === 0 && (company === 'samsung' || lowerModel.match(/^s\d+/))) {
        const sql = `
          SELECT * FROM phones 
          WHERE LOWER(model_name) LIKE LOWER(?)
          ORDER BY user_rating DESC 
          LIMIT 1
        `;
        results = await queryPhones(sql, [`%galaxy ${model}%`]);
      }

      // Strategy 5: iPhone prefix for Apple models
      if (results.length === 0 && company === 'apple' && !lowerModel.includes('iphone')) {
        const sql = `
          SELECT * FROM phones 
          WHERE LOWER(model_name) LIKE LOWER(?)
          ORDER BY user_rating DESC 
          LIMIT 1
        `;
        results = await queryPhones(sql, [`%iphone ${model}%`]);
      }

      if (results.length > 0) {
        phones.push(...results);
      } else {
        // Model not found, continue to next
      }
    }

    return phones;
  }

  /**
   * Process single search query
   * Uses semantic search (Pinecone) first for RAG, with SQL/filter fallback
   */
  private async processSingleQuery(
    intent: ParsedIntent,
    filters: Filters,
    originalQuery?: string
  ): Promise<Phone[]> {
    // Step 1: Try semantic search first (RAG approach)
    try {
      const semanticFilters = {
        maxPrice: filters.maxPrice || intent.constraints?.max_price,
        minPrice: filters.minPrice || intent.constraints?.min_price,
        minRam: filters.minRam || intent.constraints?.min_ram,
        minBattery: filters.minBattery || intent.constraints?.min_battery,
        company: filters.company || intent.entities?.company?.[0]
      };

      // Use original query for semantic search for better results
      const searchQuery = originalQuery ||
        (intent.entities?.features?.join(' ') || '') + ' ' +
        (intent.entities?.company?.join(' ') || '') + ' ' +
        (intent.entities?.model?.join(' ') || '');

      const phones = await this.vector.searchProducts(searchQuery.trim(), semanticFilters, 5);

      if (phones.length > 0) {
        return phones;
      }
    } catch {
      // Semantic search failed, falling back to SQL
    }

    // Step 2: Fallback to SQL generation
    try {
      const sql = await this.llm.generateSQL(intent, filters);
      const phones = await queryPhones(sql);

      if (phones.length > 0) {
        return phones;
      }
    } catch {
      // SQL generation failed, using filter fallback
    }

    // Step 3: Final fallback to filter-based query
    return await getFilteredPhones(filters);
  }
}

// Singleton instance
let queryProcessorInstance: QueryProcessor | null = null;

export function getQueryProcessor(): QueryProcessor {
  if (!queryProcessorInstance) {
    queryProcessorInstance = new QueryProcessor();
  }
  return queryProcessorInstance;
}
