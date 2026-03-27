import { pool } from "../db";

/**
 * Ensures all required tables exist in the database.
 * Uses CREATE TABLE IF NOT EXISTS so it's safe to run repeatedly.
 */
export async function ensureTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        role TEXT NOT NULL DEFAULT 'agent',
        organization TEXT,
        npn TEXT,
        phone TEXT,
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS saved_searches (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        criteria JSONB NOT NULL,
        result_count INTEGER,
        last_run_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);

      CREATE TABLE IF NOT EXISTS favorite_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        plan_id INTEGER NOT NULL REFERENCES plans(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_favorite_user_plan ON favorite_plans(user_id, plan_id);
      CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorite_plans(user_id);

      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        date_of_birth TEXT,
        zip_code TEXT,
        county TEXT,
        state TEXT,
        current_plan_id INTEGER,
        medicare_id TEXT,
        eligibility_date TEXT,
        notes TEXT,
        tags JSONB DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id);

      CREATE TABLE IF NOT EXISTS client_recommendations (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id),
        plan_id INTEGER NOT NULL REFERENCES plans(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        reason TEXT,
        priority INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_client_recs_client ON client_recommendations(client_id);

      CREATE TABLE IF NOT EXISTS interaction_logs (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        type TEXT NOT NULL,
        subject TEXT,
        notes TEXT,
        outcome TEXT,
        follow_up_date TIMESTAMP,
        duration_minutes INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_interaction_logs_client ON interaction_logs(client_id);

      CREATE TABLE IF NOT EXISTS scope_of_appointments (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        appointment_date TIMESTAMP NOT NULL,
        scope_types JSONB NOT NULL DEFAULT '[]',
        beneficiary_signature TEXT,
        agent_signature TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        signed_at TIMESTAMP,
        expires_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_soa_client ON scope_of_appointments(client_id);
      CREATE INDEX IF NOT EXISTS idx_soa_user ON scope_of_appointments(user_id);

      CREATE TABLE IF NOT EXISTS drug_cache (
        id SERIAL PRIMARY KEY,
        query TEXT NOT NULL,
        results JSONB NOT NULL,
        source TEXT NOT NULL DEFAULT 'rxnorm',
        fetched_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_drug_cache_query ON drug_cache(query);

      CREATE TABLE IF NOT EXISTS drug_cost_estimates (
        id SERIAL PRIMARY KEY,
        drug_rxcui TEXT NOT NULL,
        plan_id INTEGER NOT NULL REFERENCES plans(id),
        tier INTEGER,
        copay REAL,
        coinsurance REAL,
        prior_auth BOOLEAN DEFAULT false,
        step_therapy BOOLEAN DEFAULT false,
        quantity_limit TEXT,
        estimated_annual_cost REAL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_drug_cost_plan ON drug_cost_estimates(plan_id);

      CREATE TABLE IF NOT EXISTS provider_cache (
        id SERIAL PRIMARY KEY,
        query TEXT NOT NULL,
        results JSONB NOT NULL,
        source TEXT NOT NULL DEFAULT 'nppes',
        fetched_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_provider_cache_query ON provider_cache(query);

      CREATE TABLE IF NOT EXISTS ai_explanations (
        id SERIAL PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        explanation TEXT NOT NULL,
        model TEXT DEFAULT 'gpt-4o-mini',
        tokens_used INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ai_explanations_entity ON ai_explanations(entity_type, entity_id);

      CREATE TABLE IF NOT EXISTS plan_history (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER NOT NULL REFERENCES plans(id),
        year INTEGER NOT NULL,
        snapshot JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_plan_history_plan ON plan_history(plan_id);
      CREATE INDEX IF NOT EXISTS idx_plan_history_year ON plan_history(year);

      CREATE TABLE IF NOT EXISTS data_validation_logs (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER REFERENCES plans(id),
        field TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'warning',
        message TEXT NOT NULL,
        current_value TEXT,
        suggested_value TEXT,
        resolved BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_validation_logs_plan ON data_validation_logs(plan_id);

      CREATE TABLE IF NOT EXISTS export_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        export_type TEXT NOT NULL,
        filters JSONB,
        row_count INTEGER,
        file_size INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS formulary_drugs (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER NOT NULL REFERENCES plans(id),
        drug_name TEXT NOT NULL,
        rxcui TEXT,
        ndc TEXT,
        tier INTEGER,
        prior_auth BOOLEAN DEFAULT false,
        step_therapy BOOLEAN DEFAULT false,
        quantity_limit TEXT,
        copay_30day REAL,
        copay_90day REAL,
        coinsurance REAL,
        specialty BOOLEAN DEFAULT false,
        generic_available BOOLEAN DEFAULT false,
        category TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_formulary_plan ON formulary_drugs(plan_id);
      CREATE INDEX IF NOT EXISTS idx_formulary_drug_name ON formulary_drugs(drug_name);
      CREATE INDEX IF NOT EXISTS idx_formulary_rxcui ON formulary_drugs(rxcui);
    `);
    console.log("[migrate] All required tables ensured.");
  } catch (err: any) {
    console.error("[migrate] Error ensuring tables:", err.message);
  } finally {
    client.release();
  }
}
