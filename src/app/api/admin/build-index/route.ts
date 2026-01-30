import { NextRequest, NextResponse } from 'next/server';
import { getVectorClient } from '@/lib/vector/vector-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin endpoint to build the Pinecone product index for RAG
 * POST /api/admin/build-index
 * 
 * This embeds all phone products for semantic search.
 * Should be run once when setting up Pinecone, or when data changes.
 */
export async function POST(request: NextRequest) {
    try {
        // Optional: Add authentication check here
        // const authHeader = request.headers.get('authorization');
        // if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
        //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // }

        const vectorClient = getVectorClient();

        const result = await vectorClient.buildProductIndex();

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: result.message,
                count: result.count
            });
        } else {
            return NextResponse.json({
                success: false,
                message: result.message
            }, { status: 500 });
        }
    } catch (error) {
        console.error('Build index error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

/**
 * GET endpoint to check index status
 */
export async function GET() {
    try {
        const vectorClient = getVectorClient();
        const hasIndex = await vectorClient.hasProductIndex();

        return NextResponse.json({
            hasProductIndex: hasIndex,
            message: hasIndex
                ? 'Product index is available for semantic search'
                : 'No product index found. Run POST /api/admin/build-index to create it.'
        });
    } catch (error) {
        return NextResponse.json({
            hasProductIndex: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * DELETE endpoint to recreate the index with new dimensions
 * Use when switching embedding models (e.g., Gemini 768-dim -> OpenAI 1536-dim)
 */
export async function DELETE() {
    try {
        const vectorClient = getVectorClient();

        const result = await vectorClient.recreateIndex();

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: result.message
            });
        } else {
            return NextResponse.json({
                success: false,
                message: result.message
            }, { status: 500 });
        }
    } catch (error) {
        console.error('Recreate index error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
