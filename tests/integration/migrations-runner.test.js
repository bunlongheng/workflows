import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../server/migrations');

// Same splitter used by server/index.js migrate(): split on ';' followed by
// a newline (or end of input), strip line comments, drop blanks. DO $$...$$
// blocks are intentionally kept on one logical line in the .sql files so this
// simple splitter doesn't break them apart.
function splitStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/--.*$/gm, '').trim())
    .filter(Boolean);
}

describe('migrations splitter', () => {
  it('001_indexes.sql -> 4 non-empty statements', () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, '001_indexes.sql'), 'utf-8');
    const stmts = splitStatements(sql);
    expect(stmts).toHaveLength(4);
    for (const s of stmts) {
      expect(s.length).toBeGreaterThan(0);
      expect(s.trim()).toBe(s);
    }
    // Every statement in 001 is a CREATE INDEX CONCURRENTLY IF NOT EXISTS.
    for (const s of stmts) {
      expect(s).toMatch(/^CREATE INDEX CONCURRENTLY IF NOT EXISTS/);
    }
  });

  it('002_constraints.sql -> 3 non-empty statements', () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, '002_constraints.sql'), 'utf-8');
    const stmts = splitStatements(sql);
    expect(stmts).toHaveLength(3);
    for (const s of stmts) {
      expect(s.length).toBeGreaterThan(0);
      expect(s.trim()).toBe(s);
    }
    // The first statement is the DO $$...$$ block that adds the FK.
    expect(stmts[0]).toMatch(/^DO \$\$/);
    expect(stmts[0]).toMatch(/automation_logs_automation_id_fkey/);
  });

  it('003_validate_fk.sql -> 2 non-empty statements (DELETE + VALIDATE)', () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, '003_validate_fk.sql'), 'utf-8');
    const stmts = splitStatements(sql);
    expect(stmts).toHaveLength(2);
    for (const s of stmts) {
      expect(s.length).toBeGreaterThan(0);
      expect(s.trim()).toBe(s);
    }
    // First statement: orphan-cleanup DELETE.
    expect(stmts[0]).toMatch(/^DELETE FROM automation_logs/);
    expect(stmts[0]).toMatch(/automation_id NOT IN \(SELECT id FROM automations\)/);
    // Second statement: DO $$...$$ block that VALIDATEs the FK constraint.
    expect(stmts[1]).toMatch(/^DO \$\$/);
    expect(stmts[1]).toMatch(/VALIDATE CONSTRAINT automation_logs_automation_id_fkey/);
  });

  it('strips leading SQL line comments from 003 before splitting', () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, '003_validate_fk.sql'), 'utf-8');
    const stmts = splitStatements(sql);
    // The big comment header must not survive as its own statement.
    for (const s of stmts) {
      expect(s.startsWith('--')).toBe(false);
    }
  });

  it('keeps the DO $$...$$ block in 003 intact (single logical statement)', () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, '003_validate_fk.sql'), 'utf-8');
    const stmts = splitStatements(sql);
    const doBlock = stmts.find((s) => s.startsWith('DO $$'));
    // The semicolons inside the DO block must NOT split it apart.
    expect(doBlock).toContain('BEGIN');
    expect(doBlock).toContain('EXCEPTION WHEN undefined_object THEN NULL');
    expect(doBlock).toContain('END $$');
  });
});
