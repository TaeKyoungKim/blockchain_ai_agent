import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import fs from "fs";
import { config } from "./config.js";

// Ensure storage directory exists
const dbDir = path.dirname(path.resolve(config.databasePath));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export let dbInstance;

/**
 * Initialize database schema
 * Strictly isolates off-chain PII & full contract details from on-chain storage.
 */
export async function initDatabase() {
  dbInstance = await open({
    filename: path.resolve(config.databasePath),
    driver: sqlite3.Database
  });

  await dbInstance.exec("PRAGMA journal_mode = WAL;");

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      contract_type TEXT NOT NULL, -- 'SALE' | 'JEONSE' | 'MONTHLY_RENT'
      status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT' | 'REVIEWED' | 'SIGNED' | 'FINALIZED_ONCHAIN'
      property_address TEXT NOT NULL,
      deposit_amount REAL NOT NULL DEFAULT 0,
      monthly_rent REAL NOT NULL DEFAULT 0,
      lessor_name TEXT NOT NULL,
      lessor_id_number TEXT NOT NULL,
      lessee_name TEXT NOT NULL,
      lessee_id_number TEXT NOT NULL,
      special_clauses TEXT, -- JSON array of special clauses (특약사항)
      ai_review_result TEXT, -- JSON cache of AI risk review
      pdf_path TEXT, -- Local storage path to generated PDF
      document_hash TEXT, -- 0x SHA-256 hash
      tx_hash TEXT, -- Geth transaction hash
      onchain_timestamp INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS signatures (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      signer_role TEXT NOT NULL, -- 'LESSOR' | 'LESSEE'
      signer_name TEXT NOT NULL,
      signature_data TEXT NOT NULL, -- Base64 or digital signature
      signed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    );
  `);

  console.log("[DB] SQLite database initialized at:", path.resolve(config.databasePath));
  return dbInstance;
}
