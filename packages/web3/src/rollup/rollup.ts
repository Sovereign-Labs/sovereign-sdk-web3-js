import SovereignClient from "@sovereign-sdk/client";
import type { APIError } from "@sovereign-sdk/client";
import type { Signer } from "@sovereign-sdk/signers";
import { bytesToHex } from "@sovereign-sdk/utils";
import { Base64 } from "js-base64";
import { VersionMismatchError } from "../errors";
import {
  type RollupSerializer,
  createSerializerFromHttp,
} from "../serialization";
import {
  type Subscription,
  type SubscriptionToCallbackMap,
  createSubscription,
} from "../subscriptions";
import type { BaseTypeSpec } from "../type-spec";
import type { DeepPartial } from "../utils";

export type UnsignedTransactionContext<
  S extends BaseTypeSpec,
  C extends RollupContext,
> = {
  runtimeCall: S["RuntimeCall"];
  // Provides the ability to override the generation data instead of retrieving it automatically.
  overrides: DeepPartial<S["UnsignedTransaction"]>;
  rollup: Rollup<S, C>;
};

export type TransactionContext<
  S extends BaseTypeSpec,
  C extends RollupContext,
> = {
  unsignedTx: S["UnsignedTransaction"];
  sender: Uint8Array;
  signature: Uint8Array;
  rollup: Rollup<S, C>;
};

export type TypeBuilder<S extends BaseTypeSpec, C extends RollupContext> = {
  unsignedTransaction: (
    context: UnsignedTransactionContext<S, C>,
  ) => Promise<S["UnsignedTransaction"]>;

  transaction: (context: TransactionContext<S, C>) => Promise<S["Transaction"]>;
};

/**
 * Arbitrary context that is associated with the rollup.
 */
export type RollupContext = Record<string, unknown>;

/**
 * The configuration for a rollup client.
 */
export type RollupConfig<C extends RollupContext> = {
  /**
   * The base URL of the rollup full node API.
   */
  url?: string;
  /**
   * The Sovereign SDK client to use for the rollup.
   * If not provided, the default client will be used using {@link PartialRollupConfig.url}.
   */
  client: SovereignClient;
  /**
   * The serializer to use for the rollup.
   * If not provided, a serializer will be created using the provided client and the rollup HTTP endpoint.
   */
  serializer: RollupSerializer;
  /**
   * Arbitrary context that is associated with the rollup.
   */
  context: C;
};

/**
 * The result of signing and submitting a transaction.
 *
 * @template Tx The type of the transaction
 */
export type TransactionResult<Tx> = {
  /**
   * The response from the sequencer.
   */
  response: SovereignClient.Sequencer.TxCreateResponse;
  /**
   * The transaction that was submitted.
   */
  transaction: Tx;
};

/**
 * The parameters for signing and submitting a transaction.
 */
export type SignerParams = {
  /**
   * The signer to use for signing the transaction.
   */
  signer: Signer;
};

/**
 * The parameters for calling executing a runtime call transaction.
 */
export type CallParams<S extends BaseTypeSpec> = {
  overrides?: DeepPartial<S["UnsignedTransaction"]>;
} & SignerParams;

/**
 * A generic rollup client.
 *
 * @template S - The type specification for the rollup.
 *               If not provided, the base type specification will be used which uses `any` for all types.
 * @template C - The context for the rollup.
 */
export class Rollup<S extends BaseTypeSpec, C extends RollupContext> {
  private readonly _config: RollupConfig<C>;
  private readonly _typeBuilder: TypeBuilder<S, C>;

  /**
   * Creates a new rollup client.
   *
   * @param config - The configuration for the rollup client.
   * @param typeBuilder - The type builder for the rollup.
   */
  constructor(config: RollupConfig<C>, typeBuilder: TypeBuilder<S, C>) {
    this._config = config;
    this._typeBuilder = typeBuilder;
  }

  /**
   * Retrieve dedup information about the provided address.
   *
   * @param address - The public key to dedup.
   */
  async dedup(address: Uint8Array): Promise<S["Dedup"]> {
    const response = await this.rollup.addresses.dedup(bytesToHex(address));
    return response as S["Dedup"];
  }

  /**
   * Submits a transaction to the rollup.
   *
   * @param transaction - The transaction to submit.
   * @param {SovereignClient.RequestOptions} options - The options for the request.
   */
  async submitTransaction(
    transaction: S["Transaction"],
    options?: SovereignClient.RequestOptions,
  ): Promise<SovereignClient.Sequencer.TxCreateResponse> {
    const serializedTx = this.serializer.serializeTx(transaction);

    return this.sequencer.txs
      .create({ body: Base64.fromUint8Array(serializedTx) }, options)
      .catch(async (e) => {
        if (isVersionMismatchError(e as APIError)) {
          const oldVersion = bytesToHex(this.chainHash);
          this._config.serializer = await createSerializerFromHttp(this.http);
          const newVersion = bytesToHex(this.chainHash);

          if (oldVersion !== newVersion) {
            throw new VersionMismatchError(
              "Schema version mismatch when submitting transaction",
              newVersion,
              oldVersion,
            );
          }
        }
        throw e;
      });
  }

  /**
   * Signs and submits a transaction to the rollup.
   * Utilizes the provided signer to sign the transaction.
   *
   * @param unsignedTx - The unsigned transaction to sign and submit.
   * @param {SignerParams} params - The params for signing and submitting the transaction.
   * @param {SovereignClient.RequestOptions} options - The options for the request.
   */
  async signAndSubmitTransaction(
    unsignedTx: S["UnsignedTransaction"],
    { signer }: SignerParams,
    options?: SovereignClient.RequestOptions,
  ): Promise<TransactionResult<S["Transaction"]>> {
    const serializedUnsignedTx =
      this.serializer.serializeUnsignedTx(unsignedTx);
    const signature = await signer.sign(
      new Uint8Array([...serializedUnsignedTx, ...this.chainHash]),
    );
    const publicKey = await signer.publicKey();
    const context = {
      unsignedTx,
      sender: publicKey,
      signature,
      rollup: this,
    };
    const tx = await this._typeBuilder.transaction(context);
    const result = await this.submitTransaction(tx, options);

    return { transaction: tx, response: result };
  }

  /**
   * Performs a runtime call transaction.
   * Utilizes the provided signer to sign the transaction.
   *
   * @param runtimeCall - The runtime message to call.
   * @param {CallParams<S>} params - The params for submitting a runtime call transaction.
   * @param {SovereignClient.RequestOptions} options - The options for the request.
   */
  async call(
    runtimeCall: S["RuntimeCall"],
    { signer, overrides }: CallParams<S>,
    options?: SovereignClient.RequestOptions,
  ): Promise<TransactionResult<S["Transaction"]>> {
    const context = {
      runtimeCall,
      rollup: this,
      overrides: overrides ?? ({} as DeepPartial<S["UnsignedTransaction"]>),
    };
    const unsignedTx = await this._typeBuilder.unsignedTransaction(context);

    return this.signAndSubmitTransaction(
      unsignedTx,
      {
        signer,
      },
      options,
    );
  }

  /**
   * Create a subscription to events emitted over websockets by the rollup.
   */
  subscribe<T extends keyof SubscriptionToCallbackMap>(
    type: T,
    callback: SubscriptionToCallbackMap[T],
  ): Subscription {
    return createSubscription(type, callback, this.http);
  }

  /**
   * Performs a healthcheck against the rollup to determine if it is currently healthy.
   *
   * @param timeout - Request timeout in milliseconds.
   * @returns `true` if the rollup is considered healthy otherwise `false`.
   */
  async healthcheck(timeout = 5000): Promise<boolean> {
    try {
      await this.http.get("/healthcheck", { timeout, maxRetries: 1 });
      return true;
    } catch (e) {
      return !(e instanceof SovereignClient.APIConnectionError);
    }
  }

  /**
   * A ledger client that can be used to query the ledger.
   */
  get ledger(): SovereignClient.Ledger {
    return this.http.ledger;
  }

  /**
   * A sequencer client that can be used to submit transactions & batches to the rollup.
   */
  get sequencer(): SovereignClient.Sequencer {
    return this.http.sequencer;
  }

  /**
   * A rollup client that can be used to perform operations on the rollup.
   */
  get rollup(): SovereignClient.Rollup {
    return this.http.rollup;
  }

  /**
   * A client that can be used to perform HTTP requests to the Sovereign API.
   * This can be used as an escape hatch to execute arbitrary requests to the Sovereign API
   * if the operation is not supported by `ledger`, `sequencer`, or `rollup` clients.
   */
  get http(): SovereignClient {
    return this._config.client;
  }

  /**
   * The serializer for the rollup.
   * Can be used to serialize transactions, runtime calls, etc.
   * See {@link RollupSerializer} for more information.
   */
  get serializer(): RollupSerializer {
    return this._config.serializer;
  }

  /**
   * The context for the rollup.
   */
  get context(): C {
    return this._config.context;
  }

  /**
   * The chain hash of the rollup.
   */
  get chainHash(): Uint8Array {
    return this.serializer.schema.chainHash;
  }
}

function isVersionMismatchError(e: APIError): boolean {
  if (
    // biome-ignore lint/suspicious/noExplicitAny: yolo
    (e.error as any)?.details?.error?.includes("Signature verification failed")
  ) {
    return true;
  }

  return false;
}
