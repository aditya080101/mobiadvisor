// Phone data types
export interface Phone {
  id: number;
  company_name: string;
  model_name: string;
  processor: string;
  launched_year: number;
  user_rating: number;
  user_review: string;
  camera_rating: number;
  battery_rating: number;
  design_rating: number;
  display_rating: number;
  performance_rating: number;
  memory_gb: number;
  weight_g: number;
  ram_gb: number;
  front_camera_mp: number;
  back_camera_mp: number;
  battery_mah: number;
  price_inr: number;
  screen_size: number;
}

// Filter types
export interface Filters {
  company?: string;
  minPrice?: number;
  maxPrice?: number;
  minCamera?: number;
  maxCamera?: number;
  minBattery?: number;
  maxBattery?: number;
  minRam?: number;
  maxRam?: number;
  minStorage?: number;
  maxStorage?: number;
}

// Chat message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  phones?: Phone[];
  timestamp: Date;
  status?: 'pending' | 'processing' | 'complete' | 'error';
}

// Intent types (from LLM parsing)
export interface ParsedIntent {
  task: 'query' | 'general_qa' | 'reject';
  entities: {
    company?: string[];
    model?: string[];
    price_range?: { min?: number; max?: number };
    features?: string[];
  };
  constraints: {
    min_price?: number;
    max_price?: number;
    min_ram?: number;
    max_ram?: number;
    min_battery?: number;
    max_battery?: number;
    min_camera?: number;
    max_camera?: number;
    min_storage?: number;
    max_storage?: number;
  };
  priority_features?: string[];
  comparison_type?: 'single' | 'multi' | 'range';
}

// API Response types
export interface ChatResponse {
  message: string;
  phones?: Phone[];
  error?: string;
  warning?: string;
}

export interface FiltersMetadata {
  companies: string[];
  priceRange: { min: number; max: number };
  cameraRange: { min: number; max: number };
  batteryRange: { min: number; max: number };
  ramRange: { min: number; max: number };
  storageRange: { min: number; max: number };
}

// Comparison types
export interface ComparisonItem {
  phone: Phone;
  selected: boolean;
}

// Vector search result
export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: {
    type: 'company' | 'model';
    value: string;
    company?: string;
  };
}

// Chat history message for context
export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  phones?: Phone[];
}
