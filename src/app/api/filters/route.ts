import { NextResponse } from 'next/server';
import { getFiltersMetadata } from '@/lib/db/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const metadata = getFiltersMetadata();
    return NextResponse.json(metadata);
  } catch (error) {
    console.error('Filters API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filter metadata' },
      { status: 500 }
    );
  }
}
