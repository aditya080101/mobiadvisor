/**
 * One-time script to migrate data from local CSV to Turso cloud database
 * Run with: npx tsx scripts/migrate-to-turso.ts
 */

import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    console.error('Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(1);
}

const client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
});

async function createSchema() {
    console.log('Creating schema...');

    await client.execute(`
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
    )
  `);

    await client.execute('CREATE INDEX IF NOT EXISTS idx_company ON phones(company_name)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_price ON phones(price_inr)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_rating ON phones(user_rating)');

    console.log('Schema created successfully!');
}

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

async function loadData() {
    const csvPath = path.join(process.cwd(), 'data', 'mobiles_india.csv');

    if (!fs.existsSync(csvPath)) {
        console.error('CSV file not found:', csvPath);
        process.exit(1);
    }

    console.log('Reading CSV file...');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1); // Skip header

    console.log(`Found ${dataLines.length} phones to import...`);

    let imported = 0;
    let failed = 0;

    for (const line of dataLines) {
        const values = parseCSVLine(line);
        if (values.length >= 19) {
            try {
                await client.execute({
                    sql: `INSERT INTO phones (
            company_name, model_name, processor, launched_year, user_rating,
            user_review, camera_rating, battery_rating, design_rating,
            display_rating, performance_rating, memory_gb, weight_g, ram_gb,
            front_camera_mp, back_camera_mp, battery_mah, price_inr, screen_size
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                        values[0]?.toLowerCase().trim() || '',
                        values[1]?.toLowerCase().trim() || '',
                        values[2]?.trim() || '',
                        parseInt(values[3]) || 0,
                        parseFloat(values[4]) || 0,
                        values[5]?.trim() || '',
                        parseFloat(values[6]) || 0,
                        parseFloat(values[7]) || 0,
                        parseFloat(values[8]) || 0,
                        parseFloat(values[9]) || 0,
                        parseFloat(values[10]) || 0,
                        parseInt(values[11]) || 0,
                        parseFloat(values[12]) || 0,
                        parseFloat(values[13]) || 0,
                        parseFloat(values[14]) || 0,
                        parseFloat(values[15]) || 0,
                        parseInt(values[16]) || 0,
                        parseInt(values[17]) || 0,
                        parseFloat(values[18]) || 0
                    ]
                });
                imported++;
                if (imported % 50 === 0) {
                    console.log(`Imported ${imported} phones...`);
                }
            } catch (e) {
                failed++;
                console.error('Failed to insert:', values[1], e);
            }
        }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Imported: ${imported} phones`);
    console.log(`   Failed: ${failed} phones`);
}

async function verifyData() {
    console.log('\nVerifying data...');
    const result = await client.execute('SELECT COUNT(*) as count FROM phones');
    const count = result.rows[0]?.count;
    console.log(`Total phones in Turso database: ${count}`);

    const sample = await client.execute('SELECT company_name, model_name, price_inr FROM phones LIMIT 3');
    console.log('\nSample data:');
    for (const row of sample.rows) {
        console.log(`  - ${row.company_name} ${row.model_name}: ₹${row.price_inr}`);
    }
}

async function main() {
    try {
        console.log('🚀 Starting Turso migration...\n');
        console.log(`Database URL: ${TURSO_DATABASE_URL}\n`);

        await createSchema();
        await loadData();
        await verifyData();

        console.log('\n✅ Migration successful! Your Turso database is ready.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

main();
