/**
 * LifeSync Database Connection Layer
 * -----------------------------------------------------------------
 * Seamless dual-mode database adapter:
 * - Production: Connects to PostgreSQL via DATABASE_URL (Render, Railway, Neon, Supabase)
 * - Local / Offline: Defaults to zero-config local SQLite (lifesync.db)
 *
 * Exposes a standardized async query(sql, params) interface returning { rows, rowCount }.
 */

const path = require('path');
const fs = require('fs');

let dbDriver = null; // 'pg' or 'sqlite'
let pool = null;     // pg.Pool
let sqliteDb = null; // sqlite3.Database

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.trim();

if (databaseUrl) {
    // PostgreSQL connection
    const { Pool } = require('pg');
    dbDriver = 'pg';
    const sslConfig = (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1'))
        ? false
        : { rejectUnauthorized: false };

    pool = new Pool({
        connectionString: databaseUrl,
        ssl: sslConfig
    });

    console.log('📦 Using PostgreSQL database connection.');
} else {
    // SQLite connection
    const sqlite3 = require('sqlite3').verbose();
    dbDriver = 'sqlite';
    const dbPath = path.join(__dirname, '..', 'lifesync.db');
    sqliteDb = new sqlite3.Database(dbPath);
    console.log(`📦 Using local SQLite database at: ${dbPath}`);
}

/**
 * Standardized query interface matching pg.Pool.query(sql, params)
 * @param {string} text - SQL query string
 * @param {Array} params - Array of parameter values
 * @returns {Promise<{ rows: Array, rowCount: number }>}
 */
function query(text, params = []) {
    if (dbDriver === 'pg') {
        return pool.query(text, params).then(res => ({
            rows: res.rows || [],
            rowCount: res.rowCount || 0
        }));
    }

    // SQLite adapter
    return new Promise((resolve, reject) => {
        // Convert PostgreSQL style $1, $2, $3 to SQLite ?
        let sqliteText = text.replace(/\$(\d+)/g, '?');

        // Check if query is a SELECT
        const trimmed = sqliteText.trim().toUpperCase();
        const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA');
        const hasReturning = trimmed.includes('RETURNING');

        if (isSelect || hasReturning) {
            sqliteDb.all(sqliteText, params, function (err, rows) {
                if (err) return reject(err);
                resolve({
                    rows: rows || [],
                    rowCount: rows ? rows.length : 0
                });
            });
        } else {
            sqliteDb.run(sqliteText, params, function (err) {
                if (err) return reject(err);
                resolve({
                    rows: [],
                    rowCount: this.changes || 0,
                    lastID: this.lastID
                });
            });
        }
    });
}

/**
 * Initialize all relational tables if they do not already exist
 */
async function initDatabase() {
    if (dbDriver === 'sqlite') {
        // Enable foreign key constraints in SQLite
        await query('PRAGMA foreign_keys = ON;');
    }

    const isPg = dbDriver === 'pg';
    const idType = isPg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    const timestampType = isPg ? 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP';
    const numericType = isPg ? 'NUMERIC(10, 2)' : 'REAL';

    // 1. Users Table
    await query(`
        CREATE TABLE IF NOT EXISTS users (
            id ${idType},
            name VARCHAR(100) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            avatar_letter VARCHAR(5),
            created_at ${timestampType}
        );
    `);

    // 2. Tasks Table
    await query(`
        CREATE TABLE IF NOT EXISTS tasks (
            id ${idType},
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            category VARCHAR(50) DEFAULT 'Study',
            deadline DATE,
            priority VARCHAR(20) DEFAULT 'Medium',
            status VARCHAR(20) DEFAULT 'Pending',
            description TEXT,
            created_at ${timestampType},
            completed_at ${timestampType}
        );
    `);

    // 3. Calendar Events Table
    await query(`
        CREATE TABLE IF NOT EXISTS events (
            id ${idType},
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            date DATE NOT NULL,
            time VARCHAR(10) DEFAULT '09:00',
            event_type VARCHAR(50) DEFAULT 'Study',
            reminder BOOLEAN DEFAULT 0,
            created_at ${timestampType}
        );
    `);

    // 4. Budget Transactions Table
    await query(`
        CREATE TABLE IF NOT EXISTS transactions (
            id ${idType},
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(20) NOT NULL,
            category VARCHAR(50) NOT NULL,
            amount ${numericType} NOT NULL,
            date DATE NOT NULL,
            description TEXT,
            created_at ${timestampType}
        );
    `);

    // 5. Budget Settings Table (runway, late night safe, monthly target)
    await query(`
        CREATE TABLE IF NOT EXISTS budget_settings (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            monthly_budget ${numericType} DEFAULT 15000,
            runway_sum ${numericType} DEFAULT 20000,
            runway_buffer_pct INTEGER DEFAULT 15,
            night_safe_limit ${numericType} DEFAULT 500,
            night_safe_spent ${numericType} DEFAULT 0,
            night_safe_locked BOOLEAN DEFAULT 0
        );
    `);

    // 6. Mental Wellness Records Table
    await query(`
        CREATE TABLE IF NOT EXISTS wellness_records (
            id ${idType},
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            mood VARCHAR(30) NOT NULL,
            note TEXT,
            stress INTEGER DEFAULT 2,
            energy INTEGER DEFAULT 3,
            date DATE NOT NULL,
            created_at ${timestampType}
        );
    `);

    // 7. Student Profiles Table
    await query(`
        CREATE TABLE IF NOT EXISTS profiles (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(100),
            email VARCHAR(255),
            university VARCHAR(255) DEFAULT 'National Institute of Technology',
            major VARCHAR(255) DEFAULT 'Computer Science & Engineering',
            year_semester VARCHAR(100) DEFAULT '3rd Year / 5th Semester',
            student_id VARCHAR(100) DEFAULT 'STU-2026-8841',
            currency VARCHAR(10) DEFAULT '₹',
            xp INTEGER DEFAULT 120,
            notifications_enabled BOOLEAN DEFAULT 1
        );
    `);

    console.log('✅ Database schema verified and initialized.');
}

module.exports = {
    query,
    initDatabase,
    getDriver: () => dbDriver
};
