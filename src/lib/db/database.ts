import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { Phone, Filters, FiltersMetadata } from '@/types';

// Singleton database instance
let dbInstance: Database.Database | null = null;

// Check if running in production/serverless environment
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

/**
 * Get or create the database instance
 */
export function getDatabase(): Database.Database {
  if (!dbInstance) {
    const dbPath = path.join(process.cwd(), 'data', 'mobiles_india.db');

    // In serverless (Vercel), open as readonly since filesystem is read-only
    if (isServerless) {
      dbInstance = new Database(dbPath, { readonly: true, fileMustExist: true });
    } else {
      // Create data directory if it doesn't exist (local development)
      const dataDir = path.dirname(dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      dbInstance = new Database(dbPath);
      dbInstance.pragma('journal_mode = WAL');

      // Initialize database if it doesn't have data
      initializeDatabase(dbInstance);
    }
  }

  return dbInstance;
}

/**
 * Initialize database from CSV if needed
 */
function initializeDatabase(db: Database.Database): void {
  // Check if table exists and has data
  const tableCheck = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='phones'"
  ).get();

  if (!tableCheck) {
    createSchema(db);
    loadDataFromCSV(db);
  } else {
    const count = db.prepare('SELECT COUNT(*) as count FROM phones').get() as { count: number };
    if (count.count === 0) {
      loadDataFromCSV(db);
    }
  }
}

/**
 * Create database schema
 */
function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS phones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      model_name TEXT NOT NULL,
      processor TEXT,
      launched_year INTEGER,
      user_rating REAL,
      user_review TEXT,
      camera_rating REAL,
      battery_rating REAL,
      design_rating REAL,
      display_rating REAL,
      performance_rating REAL,
      memory_gb INTEGER,
      weight_g REAL,
      ram_gb REAL,
      front_camera_mp REAL,
      back_camera_mp REAL,
      battery_mah INTEGER,
      price_inr INTEGER,
      screen_size REAL
    );
    
    CREATE INDEX IF NOT EXISTS idx_company ON phones(company_name);
    CREATE INDEX IF NOT EXISTS idx_price ON phones(price_inr);
    CREATE INDEX IF NOT EXISTS idx_rating ON phones(user_rating);
  `);
}

/**
 * Load data from CSV file
 */
function loadDataFromCSV(db: Database.Database): void {
  const csvPath = path.join(process.cwd(), 'data', 'mobiles_india.csv');

  if (!fs.existsSync(csvPath)) {
    console.warn('CSV file not found:', csvPath);
    return;
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());

  // Skip header
  const dataLines = lines.slice(1);

  const insertStmt = db.prepare(`
    INSERT INTO phones (
      company_name, model_name, processor, launched_year, user_rating,
      user_review, camera_rating, battery_rating, design_rating,
      display_rating, performance_rating, memory_gb, weight_g, ram_gb,
      front_camera_mp, back_camera_mp, battery_mah, price_inr, screen_size
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((lines: string[]) => {
    for (const line of lines) {
      const values = parseCSVLine(line);
      if (values.length >= 19) {
        try {
          insertStmt.run(
            values[0]?.toLowerCase().trim() || '',  // company_name
            values[1]?.toLowerCase().trim() || '',  // model_name
            values[2]?.trim() || '',                // processor
            parseInt(values[3]) || 0,               // launched_year
            parseFloat(values[4]) || 0,             // user_rating
            values[5]?.trim() || '',                // user_review
            parseFloat(values[6]) || 0,             // camera_rating
            parseFloat(values[7]) || 0,             // battery_rating
            parseFloat(values[8]) || 0,             // design_rating
            parseFloat(values[9]) || 0,             // display_rating
            parseFloat(values[10]) || 0,            // performance_rating
            parseInt(values[11]) || 0,              // memory_gb
            parseFloat(values[12]) || 0,            // weight_g
            parseFloat(values[13]) || 0,            // ram_gb
            parseFloat(values[14]) || 0,            // front_camera_mp
            parseFloat(values[15]) || 0,            // back_camera_mp
            parseInt(values[16]) || 0,              // battery_mah
            parseInt(values[17]) || 0,              // price_inr
            parseFloat(values[18]) || 0             // screen_size
          );
        } catch (e) {
          console.warn('Failed to insert row:', e);
        }
      }
    }
  });

  insertMany(dataLines);
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Execute a SQL query and return phones
 */
export function queryPhones(sql: string, params: unknown[] = []): Phone[] {
  const db = getDatabase();
  try {
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map(mapRowToPhone);
  } catch (error) {
    console.error('Query error:', error);
    return [];
  }
}

/**
 * Get all phones from database
 */
export function getAllPhones(): Phone[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM phones').all() as Record<string, unknown>[];
  return rows.map(mapRowToPhone);
}

/**
 * Get all phones with optional filters
 */
export function getFilteredPhones(filters: Filters): Phone[] {
  const db = getDatabase();

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
export function getPhoneById(id: number): Phone | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM phones WHERE id = ?');
  const row = stmt.get(id) as Record<string, unknown> | undefined;
  return row ? mapRowToPhone(row) : null;
}

/**
 * Get all unique companies
 */
export function getCompanies(): string[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT DISTINCT company_name FROM phones ORDER BY company_name');
  const rows = stmt.all() as { company_name: string }[];
  return rows.map(r => r.company_name);
}

/**
 * Get filter metadata (ranges for all filter options)
 */
export function getFiltersMetadata(): FiltersMetadata {
  const db = getDatabase();

  const stats = db.prepare(`
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
  `).get() as Record<string, number>;

  return {
    companies: getCompanies(),
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
export function getPhonesByCompany(company: string): Phone[] {
  const db = getDatabase();
  const stmt = db.prepare(
    'SELECT * FROM phones WHERE LOWER(company_name) = LOWER(?) ORDER BY user_rating DESC'
  );
  const rows = stmt.all(company) as Record<string, unknown>[];
  return rows.map(mapRowToPhone);
}

/**
 * Search phones by model name
 */
export function searchPhonesByModel(searchTerm: string): Phone[] {
  const db = getDatabase();
  const stmt = db.prepare(
    'SELECT * FROM phones WHERE LOWER(model_name) LIKE LOWER(?) ORDER BY user_rating DESC LIMIT 10'
  );
  const rows = stmt.all(`%${searchTerm}%`) as Record<string, unknown>[];
  return rows.map(mapRowToPhone);
}

/**
 * Map database row to Phone type
 */
function mapRowToPhone(row: Record<string, unknown>): Phone {
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
