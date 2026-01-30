import { NextRequest, NextResponse } from 'next/server';
import { getQueryProcessor } from '@/lib/ai/query-processor';
import { Filters, ChatHistoryMessage } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, filters = {}, history = [] } = body as {
      query: string;
      filters?: Filters;
      history?: ChatHistoryMessage[];
    };

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Trim and validate query length
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      return NextResponse.json(
        { error: 'Query cannot be empty' },
        { status: 400 }
      );
    }

    if (trimmedQuery.length > 500) {
      return NextResponse.json(
        { error: 'Query too long. Please keep it under 500 characters.' },
        { status: 400 }
      );
    }

    const processor = getQueryProcessor();
    // Pass history to the processor for context-aware responses
    const response = await processor.process(trimmedQuery, filters, history);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        message: 'An error occurred while processing your request.',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
