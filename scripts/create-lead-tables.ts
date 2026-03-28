/**
 * Creates the consumer_leads and lead_activity tables in the database.
 * Run with: npx tsx scripts/create-lead-tables.ts
 */
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Create consumer_leads table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consumer_leads (
        id SERIAL PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        zip_code TEXT NOT NULL,
        county TEXT,
        state TEXT,
        quiz_answers JSONB,
        top_plan_ids JSONB,
        money_on_table REAL,
        assigned_agent_id INTEGER REFERENCES app_users(id),
        status TEXT NOT NULL DEFAULT 'new',
        source TEXT,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        contacted_at TIMESTAMP
      );
    `);
    console.log("Created consumer_leads table");

    // Create indexes for consumer_leads
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_consumer_leads_zip ON consumer_leads(zip_code);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_consumer_leads_status ON consumer_leads(status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_consumer_leads_agent ON consumer_leads(assigned_agent_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_consumer_leads_created ON consumer_leads(created_at);`);
    console.log("Created consumer_leads indexes");

    // Create lead_activity table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lead_activity (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER NOT NULL REFERENCES consumer_leads(id),
        action TEXT NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Created lead_activity table");

    // Create indexes for lead_activity
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_lead_activity_lead ON lead_activity(lead_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_lead_activity_created ON lead_activity(created_at);`);
    console.log("Created lead_activity indexes");

    console.log("\nAll tables and indexes created successfully!");
  } catch (err: any) {
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
