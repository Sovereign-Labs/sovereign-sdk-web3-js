import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  type EventSchema,
  type PostgresDatabase,
  postgresDatabase,
} from "../src/db";

function getTestEvent(number: number): EventSchema {
  return {
    key: "Bank/TokenTransfer",
    value: { data: "stuff" },
    module: "Bank",
    number,
  };
}

// Note: these tests currently reuse the same database/data
describe("Postgres queries", () => {
  let db: PostgresDatabase | undefined;
  let container: StartedPostgreSqlContainer | undefined;

  beforeAll(async () => {
    container = await new PostgreSqlContainer().start();
    db = postgresDatabase(container.getConnectionUri());
    const migration = readFileSync(
      join(__dirname, "..", "db", "create_events_table.sql"),
      "utf8"
    );
    await db.inner.query(migration);
    await db.disconnect();
    await container.snapshot();
  });

  beforeEach(async () => {
    db = postgresDatabase(container!.getConnectionUri());
  });

  afterEach(async () => {
    await db?.disconnect();
    await container?.restoreSnapshot();
  });

  afterAll(async () => {
    await container?.stop();
  });

  describe("getMissingEvents", () => {
    it("should be empty if there are no events", async () => {
      const actualMissing = await db?.getMissingEvents();
      expect(actualMissing).toEqual([]);
    });
    it("should return numbers of events that are missing", async () => {
      const events = [
        getTestEvent(1),
        getTestEvent(2),
        getTestEvent(4),
        getTestEvent(9),
        getTestEvent(15),
        getTestEvent(16),
        getTestEvent(17),
        getTestEvent(18),
        getTestEvent(19),
        getTestEvent(21),
      ];
      for (const event of events) {
        await db?.insertEvent(event);
      }
      const expectedMissing = [3, 5, 6, 7, 8, 10, 11, 12, 13, 14, 20];
      const actualMissing = await db?.getMissingEvents();

      expect(actualMissing).toEqual(expectedMissing);
    });
    it("should return numbers of events with limit", async () => {
      const events = [
        getTestEvent(1),
        getTestEvent(2),
        getTestEvent(4),
        getTestEvent(7),
        getTestEvent(10),
      ];
      for (const event of events) {
        await db?.insertEvent(event);
      }
      const expectedMissing = [3, 5, 6];
      const actualMissing = await db?.getMissingEvents(3);

      expect(actualMissing).toEqual(expectedMissing);
    });
  });
});
