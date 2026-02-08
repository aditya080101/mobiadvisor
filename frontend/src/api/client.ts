/**
 * API Client for Django backend
 */

import type { Phone, ChatResponse, ChatHistoryMessage, FiltersMetadata, AIAnalysis } from 'types';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

/**
 * Send a chat message to the AI assistant
 */
export async function sendChatMessage(
    query: string,
    history: ChatHistoryMessage[] = [],
    filters: Record<string, unknown> = {}
): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE}/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history, filters }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Failed to send message');
    }

    return response.json();
}

/**
 * Get AI-powered comparison analysis
 */
export async function getComparisonAnalysis(phones: Phone[]): Promise<{ analysis: AIAnalysis }> {
    const response = await fetch(`${API_BASE}/compare/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Failed to get comparison');
    }

    return response.json();
}

/**
 * Get list of phones with optional filters
 */
export async function getPhones(params: {
    search?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
    limit?: number;
    company?: string;
    minPrice?: number;
    maxPrice?: number;
    minRam?: number;
    minBattery?: number;
    minCamera?: number;
}): Promise<{ phones: Phone[]; total: number }> {
    const searchParams = new URLSearchParams();

    if (params.search) searchParams.set('search', params.search);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.order) searchParams.set('order', params.order);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.company) searchParams.set('company', params.company);
    if (params.minPrice) searchParams.set('minPrice', String(params.minPrice));
    if (params.maxPrice) searchParams.set('maxPrice', String(params.maxPrice));
    if (params.minRam) searchParams.set('minRam', String(params.minRam));
    if (params.minBattery) searchParams.set('minBattery', String(params.minBattery));
    if (params.minCamera) searchParams.set('minCamera', String(params.minCamera));

    const response = await fetch(`${API_BASE}/phones/?${searchParams}`);

    if (!response.ok) {
        throw new Error('Failed to fetch phones');
    }

    return response.json();
}

/**
 * Get a single phone by ID
 */
export async function getPhoneById(id: number): Promise<Phone> {
    const response = await fetch(`${API_BASE}/phones/${id}/`);

    if (!response.ok) {
        throw new Error('Phone not found');
    }

    return response.json();
}

/**
 * Get filter metadata (ranges, companies)
 */
export async function getFiltersMetadata(): Promise<FiltersMetadata> {
    const response = await fetch(`${API_BASE}/filters/`);

    if (!response.ok) {
        throw new Error('Failed to fetch filters');
    }

    return response.json();
}

/**
 * Trigger vector index rebuild (admin)
 */
export async function buildVectorIndex(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/admin/build-index/`, {
        method: 'POST',
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Failed to build index');
    }

    return response.json();
}
