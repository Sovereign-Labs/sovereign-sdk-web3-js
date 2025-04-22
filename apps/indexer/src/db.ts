import { Pool } from "pg";

export type Database = {
  disconnect: () => Promise<void>;
};

export function getDefaultDatabase(): Database {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  return {
    disconnect() {
      return pool.end();
    },
  };
}
