import type { EventPayload } from "@sovereign-sdk/web3";
import { Pool } from "pg";

export type Database = {
  getMissingEvents: () => Promise<number[]>;
  insertEvent: (event: EventPayload) => Promise<void>;
  disconnect: () => Promise<void>;
};

export function getDefaultDatabase(): Database {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  return {
    async getMissingEvents() {
      return [];
    },
    async insertEvent(event) {
      const query = `
        INSERT INTO events 
          (tx_hash, number, key, value, module) 
        VALUES 
          ($1, $2, $3, $4, $5)
        RETURNING id;
      `;
      const values = [
        event.tx_hash,
        event.number,
        event.key,
        event.value,
        event.module.name,
      ];

      await pool.query(query, values);
    },
    disconnect() {
      return pool.end();
    },
  };
}
