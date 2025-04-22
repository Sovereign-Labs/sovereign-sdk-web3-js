import type { EventPayload, Rollup, Subscription } from "@sovereign-sdk/web3";
import type { Database } from "./db";
import logger from "./logger";

export type IndexerOpts = {
  database: Database;
  // biome-ignore lint/suspicious/noExplicitAny: types arent used
  rollup: Rollup<any, any>;
};

export class Indexer {
  private readonly database: Database;
  // biome-ignore lint/suspicious/noExplicitAny: types arent used
  private readonly rollup: Rollup<any, any>;
  private subscription?: Subscription;

  constructor(opts: IndexerOpts) {
    this.database = opts.database;
    this.rollup = opts.rollup;
  }

  async run(): Promise<void> {
    logger.info("Indexer is starting");

    // need to get the latest event
    // start a backfill task

    this.subscription = this.rollup.subscribe("events", (event) =>
      this.onNewEvent(event),
    );
  }

  async stop(): Promise<void> {
    logger.info("Indexer is shutting down");

    logger.info("Closing events subscription");
    this.subscription?.unsubscribe();

    logger.info("Disconnecting from database");
    await this.database.disconnect();

    logger.info("Shutdown complete");
  }

  async onNewEvent(event: EventPayload): Promise<void> {
    logger.info("Handling new event", event);
    return this.database.insertEvent(event);
  }
}
