import type { EventPayload } from "@sovereign-sdk/web3";
import { Pool } from "pg";

export type Database<T> = {
  get inner(): T;
  getMissingEvents: (limit?: number) => Promise<number[]>;
  insertEvent: (event: EventPayload) => Promise<void>;
  disconnect: () => Promise<void>;
};

export type PostgresDatabase = Database<Pool>;

export function postgresDatabase(connectionString: string): PostgresDatabase {
  const pool = new Pool({ connectionString });

  return {
    inner: pool,
    async getMissingEvents(limit?: number) {
      const result = await pool.query(
        `
        WITH number_range AS (
          SELECT min(number) AS min_number, max(number) AS max_number FROM rollup_events
        ),
        all_numbers AS (
          SELECT generate_series(min_number, max_number) AS number FROM number_range
        )
        SELECT a.number 
        FROM all_numbers a
        LEFT JOIN rollup_events e ON a.number = e.number
        WHERE e.number IS NULL
        ORDER BY a.number
        LIMIT $1;
      `,
        [limit ?? 25]
      );

      return result.rows.map((row) => row.number);
    },
    async insertEvent(event) {
      const query = `
        INSERT INTO rollup_events 
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

export function getDefaultDatabase(): Database<unknown> {
  return postgresDatabase(process.env.DATABASE_URL!);
}
