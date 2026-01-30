import { createClient, Client, ResultSet } from '@libsql/client';
import { Phone, Filters, FiltersMetadata } from '@/types';

// Singleton database client
let dbClient: Client | null = null;

/**
 * Get or create the Turso database client
 */
export function getDatabase(): Client {
  if (!dbClient) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error('TURSO_DATABASE_URL environment variable is not set');
    }

    dbClient = createClient({
      url,
      authToken,
    });
  }

  return dbClient;
}

/**
 * Execute a SQL query and return phones
 */
export async function queryPhones(sql: string, params: unknown[] = []): Promise<Phone[]> {
  const db = getDatabase();
  try {
    const result = await db.execute({ sql, args: params as any[] });
    return result.rows.map(mapRowToPhone);
  } catch (error) {
    console.error('Query error:', error);
    return [];
  }
}

/**
 * Get all phones from database
 */
export async function getAllPhones(): Promise<Phone[]> {
  const db = getDatabase();
  const result = await db.execute('SELECT * FROM phones');
  return result.rows.map(mapRowToPhone);
}

/**
 * Get all phones with optional filters
 */
export async function getFilteredPhones(filters: Filters): Promise<Phone[]> {
  let sql = 'SELECT * FROM phones WHERE 1=1';
  const params: unknown[] = [];

  if (filters.company) {
    sql += ' AND LOWER(company_name) = LOWER(?)';
    params.push(filters.company);
  }

  if (filters.minPrice !== undefined) {
    sql += ' AND price_inr >= ?';
    params.push(filters.minPrice);
  }

  if (filters.maxPrice !== undefined) {
    sql += ' AND price_inr <= ?';
    params.push(filters.maxPrice);
  }

  if (filters.minCamera !== undefined) {
    sql += ' AND back_camera_mp >= ?';
    params.push(filters.minCamera);
  }

  if (filters.maxCamera !== undefined) {
    sql += ' AND back_camera_mp <= ?';
    params.push(filters.maxCamera);
  }

  if (filters.minBattery !== undefined) {
    sql += ' AND battery_mah >= ?';
    params.push(filters.minBattery);
  }

  if (filters.maxBattery !== undefined) {
    sql += ' AND battery_mah <= ?';
    params.push(filters.maxBattery);
  }

  if (filters.minRam !== undefined) {
    sql += ' AND ram_gb >= ?';
    params.push(filters.minRam);
  }

  if (filters.maxRam !== undefined) {
    sql += ' AND ram_gb <= ?';
    params.push(filters.maxRam);
  }

  if (filters.minStorage !== undefined) {
    sql += ' AND memory_gb >= ?';
    params.push(filters.minStorage);
  }

  if (filters.maxStorage !== undefined) {
    sql += ' AND memory_gb <= ?';
    params.push(filters.maxStorage);
  }

  sql += ' ORDER BY user_rating DESC, price_inr ASC LIMIT 50';

  return queryPhones(sql, params);
}

/**
 * Get phone by ID
 */
export async function getPhoneById(id: number): Promise<Phone | null> {
  const db = getDatabase();
  const result = await db.execute({
    sql: 'SELECT * FROM phones WHERE id = ?',
    args: [id]
  });
  return result.rows.length > 0 ? mapRowToPhone(result.rows[0]) : null;
}

/**
 * Get all unique companies
 */
export async function getCompanies(): Promise<string[]> {
  const db = getDatabase();
  const result = await db.execute('SELECT DISTINCT company_name FROM phones ORDER BY company_name');
  return result.rows.map(r => r.company_name as string);
}

/**
 * Get filter metadata (ranges for all filter options)
 */
export async function getFiltersMetadata(): Promise<FiltersMetadata> {
  const db = getDatabase();

  const statsResult = await db.execute(`
    SELECT 
      MIN(price_inr) as min_price,
      MAX(price_inr) as max_price,
      MIN(back_camera_mp) as min_camera,
      MAX(back_camera_mp) as max_camera,
      MIN(battery_mah) as min_battery,
      MAX(battery_mah) as max_battery,
      MIN(ram_gb) as min_ram,
      MAX(ram_gb) as max_ram,
      MIN(memory_gb) as min_storage,
      MAX(memory_gb) as max_storage
    FROM phones
  `);

  const stats = statsResult.rows[0] as Record<string, number>;
  const companies = await getCompanies();

  return {
    companies,
    priceRange: { min: stats.min_price || 0, max: stats.max_price || 200000 },
    cameraRange: { min: stats.min_camera || 0, max: stats.max_camera || 200 },
    batteryRange: { min: stats.min_battery || 0, max: stats.max_battery || 7000 },
    ramRange: { min: stats.min_ram || 0, max: stats.max_ram || 16 },
    storageRange: { min: stats.min_storage || 0, max: stats.max_storage || 512 }
  };
}

/**
 * Get all phones for a specific company
 */
export async function getPhonesByCompany(company: string): Promise<Phone[]> {
  const db = getDatabase();
  const result = await db.execute({
    sql: 'SELECT * FROM phones WHERE LOWER(company_name) = LOWER(?) ORDER BY user_rating DESC',
    args: [company]
  });
  return result.rows.map(mapRowToPhone);
}

/**
 * Search phones by model name
 */
export async function searchPhonesByModel(searchTerm: string): Promise<Phone[]> {
  const db = getDatabase();
  const result = await db.execute({
    sql: 'SELECT * FROM phones WHERE LOWER(model_name) LIKE LOWER(?) ORDER BY user_rating DESC LIMIT 10',
    args: [`%${searchTerm}%`]
  });
  return result.rows.map(mapRowToPhone);
}

/**
 * Map database row to Phone type
 */
function mapRowToPhone(row: any): Phone {
  return {
    id: row.id as number,
    company_name: row.company_name as string,
    model_name: row.model_name as string,
    processor: row.processor as string,
    launched_year: row.launched_year as number,
    user_rating: row.user_rating as number,
    user_review: row.user_review as string,
    camera_rating: row.camera_rating as number,
    battery_rating: row.battery_rating as number,
    design_rating: row.design_rating as number,
    display_rating: row.display_rating as number,
    performance_rating: row.performance_rating as number,
    memory_gb: row.memory_gb as number,
    weight_g: row.weight_g as number,
    ram_gb: row.ram_gb as number,
    front_camera_mp: row.front_camera_mp as number,
    back_camera_mp: row.back_camera_mp as number,
    battery_mah: row.battery_mah as number,
    price_inr: row.price_inr as number,
    screen_size: row.screen_size as number
  };
}
