import pg from 'pg';

// Shared Postgres connection pool used across the VPS server.
// Single pool prevents connection exhaustion when multiple modules query.
export const pool = new pg.Pool({
  host: '/var/run/postgresql',
  database: '2026',
  user: 'postgres',
});

export default pool;
