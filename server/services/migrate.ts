import { pool } from "../db";

/**
 * Ensures all required tables exist in the database.
 * Uses CREATE TABLE IF NOT EXISTS so it's safe to run repeatedly.
 * Note: uses "app_users" to avoid conflict with Supabase auth.users
 */
export async function ensureTables(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_users (
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
        user_id INTEGER,
        name TEXT NOT NULL,
        criteria JSONB NOT NULL,
        result_count INTEGER,
        last_run_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS favorite_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        plan_id INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        agent_user_id INTEGER,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth TEXT,
        gender TEXT,
        zip_code TEXT NOT NULL,
        county TEXT,
        fips TEXT,
        current_coverage TEXT,
        current_plan_name TEXT,
        max_monthly_premium REAL,
        max_annual_oop REAL,
        chronic_conditions JSONB,
        mobility_level TEXT,
        hospitalized_last_year BOOLEAN,
        medications JSONB,
        preferred_doctors JSONB,
        must_have_benefits JSONB,
        benefit_weights JSONB,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'intake',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS client_recommendations (
        id SERIAL PRIMARY KEY,
        client_id INTEGER,
        plan_id INTEGER,
        score REAL NOT NULL,
        score_breakdown JSONB NOT NULL,
        rank INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS interaction_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        client_id INTEGER,
        action TEXT NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS scope_of_appointments (
        id SERIAL PRIMARY KEY,
        agent_user_id INTEGER,
        client_id INTEGER,
        beneficiary_name TEXT NOT NULL,
        soa_date TIMESTAMP NOT NULL,
        plan_types_discussed JSONB NOT NULL,
        beneficiary_initiated BOOLEAN NOT NULL DEFAULT FALSE,
        method TEXT NOT NULL,
        signature_name TEXT NOT NULL,
        signature_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS formulary_drugs (
        id SERIAL PRIMARY KEY,
        contract_id TEXT NOT NULL,
        formulary_id TEXT NOT NULL,
        rxcui TEXT NOT NULL,
        drug_name TEXT NOT NULL,
        tier INTEGER NOT NULL,
        prior_authorization BOOLEAN DEFAULT FALSE,
        step_therapy BOOLEAN DEFAULT FALSE,
        quantity_limit BOOLEAN DEFAULT FALSE,
        quantity_limit_amount REAL,
        quantity_limit_days INTEGER,
        contract_year INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS drug_cache (
        id SERIAL PRIMARY KEY,
        input_name TEXT NOT NULL UNIQUE,
        rxcui TEXT,
        resolved_name TEXT,
        strength TEXT,
        dosage_form TEXT,
        resolved_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS drug_cost_estimates (
        id SERIAL PRIMARY KEY,
        client_id INTEGER,
        plan_id INTEGER,
        medications JSONB NOT NULL,
        estimated_annual_cost REAL NOT NULL,
        cost_breakdown JSONB NOT NULL,
        calculated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS provider_cache (
        id SERIAL PRIMARY KEY,
        npi TEXT NOT NULL UNIQUE,
        first_name TEXT,
        last_name TEXT,
        organization_name TEXT,
        specialty TEXT,
        address_line1 TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        phone TEXT,
        resolved_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ai_explanations (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER NOT NULL,
        client_id INTEGER,
        explanation_type TEXT NOT NULL,
        content TEXT NOT NULL,
        model TEXT NOT NULL,
        tokens_used INTEGER,
        plan_data_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS plan_history (
        id SERIAL PRIMARY KEY,
        contract_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        segment_id TEXT NOT NULL,
        fips TEXT NOT NULL,
        contract_year INTEGER NOT NULL,
        snapshot_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS data_validation_logs (
        id SERIAL PRIMARY KEY,
        plan_id_ref INTEGER,
        rule_name TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        field_name TEXT,
        field_value TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS export_logs (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        export_type TEXT NOT NULL,
        export_scope TEXT NOT NULL,
        filters JSONB,
        row_count INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );

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
        assigned_agent_id INTEGER,
        status TEXT DEFAULT 'new',
        source TEXT,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        contacted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS lead_activity (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER,
        action TEXT NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("[migrate] All tables ensured");
  } catch (err: any) {
    console.log("[migrate] Error ensuring tables:", err.message);
    // Non-fatal — tables may already exist with different schemas
  }
}
