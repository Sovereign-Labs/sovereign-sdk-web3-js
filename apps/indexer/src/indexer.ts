import type { EventPayload, Rollup, Subscription } from "@sovereign-sdk/web3";
import type { Database, EventSchema } from "./db";
import logger from "./logger";
import { chunkArray } from "./utils";

export type IndexerOpts = {
  database: Database<unknown>;
  // biome-ignore lint/suspicious/noExplicitAny: types arent used
  rollup: Rollup<any, any>;
  backfillIntervalMs?: number;
};

export class Indexer {
  private readonly database: Database<unknown>;
  // biome-ignore lint/suspicious/noExplicitAny: types arent used
  private readonly rollup: Rollup<any, any>;
  private subscription?: Subscription;
  private lastMessageTimestampMs: number;
  private readonly backfillIntervalMs: number;
  private backfillHandle?: ReturnType<typeof setTimeout>;

  constructor(opts: IndexerOpts) {
    // set it to now so we don't need to deal with an undefined case
    this.lastMessageTimestampMs = Date.now();
    this.backfillIntervalMs = opts.backfillIntervalMs ?? 200;
    this.database = opts.database;
    this.rollup = opts.rollup;
  }

  async run(): Promise<void> {
    logger.info("Indexer started");

    this.doBackfill();
    this.subscription = this.rollup.subscribe("events", (event) =>
      this.onSubscriptionMessage(event),
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

  private async onSubscriptionMessage(event: EventPayload): Promise<void> {
    this.lastMessageTimestampMs = Date.now();
    return this.onNewEvent({ ...event, module: event.module.name });
  }

  private async onNewEvent(event: EventSchema): Promise<void> {
    logger.debug("Handling new event", event);
    return this.database.insertEvent(event).catch((e) => this.onError(e));
  }

  private async doBackfill(): Promise<void> {
    const missingEventNums = await this.getMissingEventNumbers();
    logger.debug("Amount of events being backfilled", missingEventNums.length);
    const events = await this.fetchEvents(missingEventNums);

    // TODO: batch insert
    for (const event of events) {
      this.onNewEvent(event);
    }

    this.backfillHandle = setTimeout(
      () => this.doBackfill(),
      this.backfillIntervalMs,
    );
  }

  private async fetchEvents(eventNums: number[]): Promise<EventSchema[]> {
    const chunkedEventNums = chunkArray(eventNums, 15);
    const events: EventSchema[] = [];

    for (const chunk of chunkedEventNums) {
      const promises = chunk.map(async (n) => {
        const eventResponse = await this.rollup.ledger.events.retrieve(n);

        if (!eventResponse.data) {
          throw new Error(
            "Response didnt contain data field, this shouldn't be possible",
          );
        }

        const event = eventResponse.data;
        events.push({ ...event, module: event.module.name });
      });
      await Promise.allSettled(promises);
    }

    return events;
  }

  private async getMissingEventNumbers(): Promise<number[]> {
    // We've received websocket events recently, no need to query the REST api for latest event
    if (Date.now() - this.lastMessageTimestampMs < 2000) {
      return this.database.getMissingEvents();
    }

    try {
      const response = await this.rollup.ledger.events.latest();
      const event = response.data;

      return this.database.getMissingEvents(500, event?.number);
    } catch {
      logger.debug(
        "Failed to retrieve latest event, falling back to latest event number in db",
      );
      return this.database.getMissingEvents();
    }
  }
}
