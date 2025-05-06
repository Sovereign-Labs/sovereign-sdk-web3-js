import {
  type EventPayload,
  type Rollup,
  SovereignClient,
  type Subscription,
} from "@sovereign-sdk/web3";
import type { Database, EventSchema } from "./db";
import logger from "./logger";
import { chunkArray } from "./utils";

export type IndexerOpts = {
  database: Database<unknown>;
  // biome-ignore lint/suspicious/noExplicitAny: types arent used
  rollup: Rollup<any, any>;
  backfillIntervalMs?: number;
  healthcheckIntervalMs?: number;
};

export class Indexer {
  private readonly database: Database<unknown>;
  // biome-ignore lint/suspicious/noExplicitAny: types arent used
  private readonly rollup: Rollup<any, any>;
  private subscription?: Subscription;
  private lastMessageTimestampMs: number;
  private readonly backfillIntervalMs: number;
  private readonly healthcheckIntervalMs: number;
  private backfillHandle?: ReturnType<typeof setTimeout>;
  private healthcheckHandle?: ReturnType<typeof setTimeout>;
  private isRollupHealthy = true;

  constructor(opts: IndexerOpts) {
    // set it to now so we don't need to deal with an undefined case
    this.lastMessageTimestampMs = Date.now();
    this.backfillIntervalMs = opts.backfillIntervalMs ?? 200;
    this.healthcheckIntervalMs = opts.healthcheckIntervalMs ?? 5000;
    this.database = opts.database;
    this.rollup = opts.rollup;
  }

  async run(): Promise<void> {
    logger.info("Indexer started");

    this.isRollupHealthy = await this.rollup.healthcheck();

    if (!this.isRollupHealthy) {
      logger.info("Rollup offline on initial healthcheck");
      await this.handleRollupOffline();
    }

    this.doBackfill();
    this.subscription = this.rollup.subscribe("events", (event) =>
      this.onSubscriptionMessage(event)
    );

    logger.info("Subscribed to rollup events and performing event backfill");
  }

  async stop(): Promise<void> {
    logger.info("Indexer is shutting down");

    logger.info("Clearing background tasks");
    clearTimeout(this.backfillHandle);
    clearTimeout(this.healthcheckHandle);

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
    if (!this.isRollupHealthy) {
      // blocks until rollup is back online
      await this.handleRollupOffline();
    }

    const missingEventNums = await this.getMissingEventNumbers();
    logger.debug("Amount of events being backfilled", missingEventNums.length);
    const events = await this.fetchEvents(missingEventNums);

    // TODO: batch insert
    for (const event of events) {
      this.onNewEvent(event);
    }

    this.backfillHandle = setTimeout(
      () => this.doBackfill(),
      this.backfillIntervalMs
    );
  }

  private async fetchEvents(eventNums: number[]): Promise<EventSchema[]> {
    const chunkedEventNums = chunkArray(eventNums, 15);
    const events: EventSchema[] = [];

    // chunks can be pushed to workers if there's ever performance issues
    for (const chunk of chunkedEventNums) {
      const promises = chunk.map(async (n) => {
        const eventResponse = await this.rollup.ledger.events.retrieve(n);

        if (!eventResponse.data) {
          throw new Error(
            "Response didnt contain data field, this shouldn't be possible"
          );
        }

        const event = eventResponse.data;
        return { ...event, module: event.module.name };
      });

      for (const result of await Promise.allSettled(promises)) {
        if (result.status === "fulfilled") {
          events.push(result.value);
        } else if (
          result.reason instanceof SovereignClient.APIConnectionError
        ) {
          this.isRollupHealthy = false;
        }
      }

      // dont try any more chunks, they'll likely fail
      if (!this.isRollupHealthy) {
        return events;
      }
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
        "Failed to retrieve latest event, falling back to latest event number in db"
      );
      return this.database.getMissingEvents();
    }
  }

  private handleRollupOffline(): Promise<void> {
    logger.info(
      "Rollup appears to be offline, entering monitoring mode until it's healthy"
    );
    this.subscription?.unsubscribe();

    return new Promise((resolve, reject) => {
      const doHealthcheck = async () => {
        try {
          this.isRollupHealthy = await this.rollup.healthcheck();

          if (this.isRollupHealthy) {
            logger.info("Rollup is back online, resuming indexing");

            this.subscription = this.rollup.subscribe("events", (event) =>
              this.onSubscriptionMessage(event)
            );

            return resolve();
          }
          this.healthcheckHandle = setTimeout(
            doHealthcheck,
            this.healthcheckIntervalMs
          );
        } catch (err) {
          console.error("Error occurred during health check", err);
          return reject(err);
        }
      };

      doHealthcheck();
    });
  }
}
