// Error handling utilities - ported from Python implementation

export type ErrorType = 
  | 'rate_limit'
  | 'network'
  | 'timeout'
  | 'auth'
  | 'invalid_response'
  | 'unknown';

export interface ClassifiedError {
  type: ErrorType;
  message: string;
  retryable: boolean;
  retryDelayMs: number;
}

export class APIErrorHandler {
  /**
   * Classify an error to determine how to handle it
   */
  static classifyError(error: unknown): ClassifiedError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Rate limit errors
      if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
        return {
          type: 'rate_limit',
          message: 'Rate limit exceeded. Retrying...',
          retryable: true,
          retryDelayMs: 2000
        };
      }
      
      // Network errors
      if (message.includes('network') || message.includes('fetch') || message.includes('econnrefused')) {
        return {
          type: 'network',
          message: 'Network error. Retrying...',
          retryable: true,
          retryDelayMs: 1000
        };
      }
      
      // Timeout errors
      if (message.includes('timeout') || message.includes('timed out')) {
        return {
          type: 'timeout',
          message: 'Request timed out. Retrying...',
          retryable: true,
          retryDelayMs: 1500
        };
      }
      
      // Auth errors
      if (message.includes('401') || message.includes('403') || message.includes('unauthorized') || message.includes('forbidden')) {
        return {
          type: 'auth',
          message: 'Authentication error. Check API keys.',
          retryable: false,
          retryDelayMs: 0
        };
      }
      
      // Invalid response
      if (message.includes('invalid') || message.includes('malformed') || message.includes('parse')) {
        return {
          type: 'invalid_response',
          message: 'Invalid response received.',
          retryable: true,
          retryDelayMs: 500
        };
      }
    }
    
    return {
      type: 'unknown',
      message: 'An unknown error occurred.',
      retryable: false,
      retryDelayMs: 0
    };
  }
  
  /**
   * Execute a function with retry logic
   */
  static async handleWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    onRetry?: (attempt: number, error: ClassifiedError) => void
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const classified = this.classifyError(error);
        
        if (!classified.retryable || attempt === maxRetries) {
          throw lastError;
        }
        
        if (onRetry) {
          onRetry(attempt, classified);
        }
        
        // Exponential backoff
        const delay = classified.retryDelayMs * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }
  
  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Format price in INR
 */
export function formatPriceINR(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(price);
}

/**
 * Generate buy links for a phone
 */
export function generateBuyLinks(company: string, model: string): { amazon: string; flipkart: string } {
  const searchQuery = encodeURIComponent(`${company} ${model}`);
  return {
    amazon: `https://www.amazon.in/s?k=${searchQuery}`,
    flipkart: `https://www.flipkart.com/search?q=${searchQuery}`
  };
}
