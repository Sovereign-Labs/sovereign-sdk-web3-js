import type { Rollup, Subscription } from "@sovereign-sdk/web3";
import type { Database, EventSchema } from "./db";
import logger from "./logger";

export type IndexerOpts = {
  database: Database<unknown>;
  // biome-ignore lint/suspicious/noExplicitAny: types arent used
  rollup: Rollup<any, any>;
};

// if amount of time since last websocket msg > timeout, fetch latest event from api
// so indexing continues if there's no liveness

export class Indexer {
  private readonly database: Database<unknown>;
  // biome-ignore lint/suspicious/noExplicitAny: types arent used
  private readonly rollup: Rollup<any, any>;
  private subscription?: Subscription;
  private backfillHandle?: ReturnType<typeof setTimeout>;

  constructor(opts: IndexerOpts) {
    this.database = opts.database;
    this.rollup = opts.rollup;
  }

  async run(): Promise<void> {
    logger.info("Indexer started");

    this.doBackfill();
    this.subscription = this.rollup.subscribe("events", (event) =>
      this.onNewEvent({ ...event, module: event.module.name })
    );

    logger.info("Subscribed to rollup events and performing event backfill");
  }

  async stop(): Promise<void> {
    logger.info("Indexer is shutting down");

    logger.info("Finishing backfill task");
    clearTimeout(this.backfillHandle);

    logger.info("Closing events subscription");
    this.subscription?.unsubscribe();

    logger.info("Disconnecting from database");
    await this.database.disconnect();

    logger.info("Shutdown complete");
  }

  private onError(err: Error): void {
    logger.error("An error occurred", err);
  }

  private async onNewEvent(event: EventSchema): Promise<void> {
    logger.debug("Handling new event", event);
    return this.database.insertEvent(event).catch((e) => this.onError(e));
  }

  private async doBackfill(): Promise<void> {
    const missingEventNums = await this.database.getMissingEvents(500);
    logger.debug("Amount of events being backfilled", missingEventNums.length);

    for (const num of missingEventNums) {
      try {
        const eventResponse = await this.rollup.ledger.events.retrieve(num);

        if (!eventResponse.data) {
          logger.warn(
            "Response didnt contain data field, this shouldn't be possible",
            eventResponse
          );
          continue;
        }

        const event = eventResponse.data;
        this.onNewEvent({ ...event, module: event.module.name });
      } catch (err) {
        this.onError(err as Error);
      }
    }

    this.backfillHandle = setTimeout(() => this.doBackfill(), 200);
  }
}
