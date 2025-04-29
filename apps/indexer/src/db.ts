import { Pool } from "pg";
import { IndexerConfigError } from "./errors";

export type EventSchema = {
  number: number;
  key: string;
  value: Record<string, unknown>;
  module: string;
};

export type Database<T> = {
  get inner(): T;
  getMissingEvents: (
    limit?: number,
    latestEventNumber?: number,
  ) => Promise<number[]>;
  insertEvent: (event: EventSchema) => Promise<void>;
  disconnect: () => Promise<void>;
};

export type PostgresDatabase = Database<Pool>;

export function postgresDatabase(connectionString: string): PostgresDatabase {
  const pool = new Pool({ connectionString });

  return {
    inner: pool,
    async getMissingEvents(limit?: number, latestEventNumber?: number) {
      const values = [limit ?? 500];

      if (latestEventNumber) {
        values.push(latestEventNumber);
      }

      const result = await pool.query(
        `
        WITH number_range AS (
          SELECT min(number) AS min_number, ${
            latestEventNumber ? "$2::integer" : "max(number)"
          } AS max_number FROM rollup_events
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
        values,
      );

      return result.rows.map((row) => row.number);
    },
    async insertEvent(event) {
      const query = `
        INSERT INTO rollup_events 
          (number, key, value, module) 
        VALUES 
          ($1, $2, $3, $4)
        RETURNING id;
      `;
      const values = [event.number, event.key, event.value, event.module];

      await pool.query(query, values);
    },
    disconnect() {
      return pool.end();
    },
  };
}

export function getDefaultDatabase(): Database<unknown> {
  if (process.env.DATABASE_URL === undefined) {
    throw new IndexerConfigError("DATABASE_URL env var not set");
  }

  return postgresDatabase(process.env.DATABASE_URL);
}
