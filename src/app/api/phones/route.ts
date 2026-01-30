import { NextRequest, NextResponse } from 'next/server';
import { getAllPhones } from '@/lib/db/database';
import { Phone } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SortField = 'price' | 'rating' | 'battery' | 'camera' | 'ram' | 'storage';
type SortOrder = 'asc' | 'desc';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sortBy = (searchParams.get('sortBy') as SortField) || 'rating';
    const order = (searchParams.get('order') as SortOrder) || 'desc';
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const search = searchParams.get('search') || '';

    // Get all phones
    let phones = await getAllPhones();

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      phones = phones.filter(p =>
        p.model_name.toLowerCase().includes(searchLower) ||
        p.company_name.toLowerCase().includes(searchLower)
      );
    }

    // Sort phones
    phones.sort((a, b) => {
      let aVal: number, bVal: number;

      switch (sortBy) {
        case 'price':
          aVal = a.price_inr;
          bVal = b.price_inr;
          break;
        case 'rating':
          aVal = a.user_rating;
          bVal = b.user_rating;
          break;
        case 'battery':
          aVal = a.battery_mah;
          bVal = b.battery_mah;
          break;
        case 'camera':
          aVal = a.back_camera_mp;
          bVal = b.back_camera_mp;
          break;
        case 'ram':
          aVal = a.ram_gb;
          bVal = b.ram_gb;
          break;
        case 'storage':
          aVal = a.memory_gb;
          bVal = b.memory_gb;
          break;
        default:
          aVal = a.user_rating;
          bVal = b.user_rating;
      }

      return order === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Paginate
    const offset = (page - 1) * limit;
    const paginatedPhones = phones.slice(offset, offset + limit);

    return NextResponse.json({
      phones: paginatedPhones,
      total: phones.length,
      page,
      limit,
      totalPages: Math.ceil(phones.length / limit)
    });
  } catch (error) {
    console.error('Phones API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch phones' },
      { status: 500 }
    );
  }
}
