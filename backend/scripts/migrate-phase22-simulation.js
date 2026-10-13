/**
 * Phase 22 Migration: Add simulation_started_at column to order_deliveries
 */
const { pool } = require('../src/config/db');

async function migrate() {
  try {
    const [cols] = await pool.query(
      "SHOW COLUMNS FROM order_deliveries LIKE 'simulation_started_at';"
    );

    if (cols.length === 0) {
      console.log('Adding simulation_started_at column to order_deliveries table...');
      await pool.query(
        "ALTER TABLE order_deliveries ADD COLUMN simulation_started_at TIMESTAMP NULL DEFAULT NULL AFTER assigned_at;"
      );
      console.log('✓ Successfully added simulation_started_at column.');
    } else {
      console.log('✓ simulation_started_at column already exists in order_deliveries.');
    }

    // Backfill any existing order_deliveries with assigned_at if simulation_started_at is NULL
    await pool.query(
      "UPDATE order_deliveries SET simulation_started_at = assigned_at WHERE simulation_started_at IS NULL AND assigned_at IS NOT NULL;"
    );
    console.log('✓ Backfilled existing records.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
