import { type EventPayload, Rollup } from "@sovereign-sdk/web3";
import logger from "./logger";
import { Database } from "./db";

export type IndexerOpts = {
  database: Database;
  rollup: Rollup<any, any>;
};

export class Indexer {
  private readonly database: Database;
  private readonly rollup: Rollup<any, any>;

  constructor(opts: IndexerOpts) {
    this.database = opts.database;
    this.rollup = opts.rollup;
  }

  async run(): Promise<void> {
    logger.info("Indexer is starting");
  }

  async stop(): Promise<void> {
    logger.info("Indexer is shutting down");
    logger.info("Disconnecting from database");

    await this.database.disconnect();
  }

  async onNewEvent(event: EventPayload): Promise<void> {
    logger.debug("Handling new event", event);
  }
}
