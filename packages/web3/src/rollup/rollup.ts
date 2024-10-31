import SovereignClient from "@sovereign-sdk/client";
import type { Signer } from "@sovereign-sdk/signers";
import { Base64 } from "js-base64";
import {
  type RollupSchema,
  type RollupSerializer,
  createSerializer,
} from "../serialization";
import type { BaseTypeSpec } from "../type-spec";
import { bytesToHex } from "../utils";

export type UnsignedTransactionContext<
  S extends BaseTypeSpec,
  C extends RollupContext
> = {
  runtimeCall: S["RuntimeCall"];
  sender: Uint8Array;
  // able to override nonce
  overrides: Partial<S["UnsignedTransaction"]>;
  rollup: Rollup<S, C>;
};

export type TransactionContext<
  S extends BaseTypeSpec,
  C extends RollupContext
> = {
  unsignedTx: S["UnsignedTransaction"];
  sender: Uint8Array;
  signature: Uint8Array;
  rollup: Rollup<S, C>;
};

export type TypeBuilder<S extends BaseTypeSpec, C extends RollupContext> = {
  unsignedTransaction: (
    context: UnsignedTransactionContext<S, C>
  ) => Promise<S["UnsignedTransaction"]>;

  transaction: (context: TransactionContext<S, C>) => Promise<S["Transaction"]>;
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
   * The schema of the rollup.
   */
  schema: RollupSchema;

  /**
   * Arbitrary context that is associated with the rollup.
   */
  context: C;
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
  overrides: Partial<S["UnsignedTransaction"]>;
} & SignerParams;

/**
 * The parameters for simulating a runtime call transaction.
 */
type SimulateParams = {
  /**
   * The transaction details to use for the simulation.
   * @deprecated This will be removed soon to remove Sovereign SDK specific types.
   *             In favor of a looser type specification.
   */
  txDetails: any;
} & SignerParams;

/**
 * The rollup client.
 *
 * @template S - The type specification for the rollup.
 *               If not provided, the base type specification will be used which uses `any` for all types.
 */
export class Rollup<S extends BaseTypeSpec, C extends RollupContext> {
  private readonly _config: RollupConfig<C>;
  private readonly _client: SovereignClient;
  private readonly _serializer: RollupSerializer;
  private readonly _builder: TypeBuilder<S, C>;

  /**
   * Creates a new rollup client.
   *
   * @param config - The configuration for the rollup client.
   */
  constructor(config: RollupConfig<C>, builder: TypeBuilder<S, C>) {
    this._client = new SovereignClient({ baseURL: config.url });
    this._serializer = createSerializer(config.schema);
    this._config = config;
    this._builder = builder;
  }

  /**
   * Submits a batch to the rollup.
   *
   * @param batch - The batch of transactions to submit.
   */
  async submitBatch(
    batch: S["Transaction"][]
  ): Promise<SovereignClient.Sequencer.BatchCreateResponse> {
    const transactions = batch.map((tx) => {
      const txBytes = this._serializer.serializeTx(tx);
      return Base64.fromUint8Array(txBytes);
    });

    return this.sequencer.batches.create({ transactions });
  }

  /**
   * Submits a transaction to the rollup.
   *
   * @param transaction - The transaction to submit.
   */
  async submitTransaction(
    transaction: S["Transaction"]
  ): Promise<SovereignClient.Sequencer.TxCreateResponse> {
    const serializedTx = this.serializer.serializeTx(transaction);

    return this.sequencer.txs.create({
      body: Base64.fromUint8Array(serializedTx),
    });
  }

  /**
   * Signs and submits a transaction to the rollup.
   * Utilizes the provided signer to sign the transaction.
   *
   * @param unsignedTx - The unsigned transaction to sign and submit.
   */
  async signAndSubmitTransaction(
    unsignedTx: S["UnsignedTransaction"],
    { signer }: SignerParams
  ): Promise<TransactionResult<S["Transaction"]>> {
    const serializedUnsignedTx =
      this.serializer.serializeUnsignedTx(unsignedTx);
    const signature = await signer.sign(serializedUnsignedTx);
    const publicKey = await signer.publicKey();
    const context = {
      unsignedTx,
      sender: publicKey,
      signature,
      rollup: this,
    };
    const tx = await this._builder.transaction(context);
    const result = await this.submitTransaction(tx);

    return { transaction: tx, response: result };
  }

  /**
   * Performs a runtime call transaction.
   * Utilizes the provided signer to sign the transaction.
   *
   * @param runtimeCall - The runtime message to call.
   */
  async call(
    runtimeCall: S["RuntimeCall"],
    { signer, overrides }: CallParams<S>
  ): Promise<TransactionResult<S["Transaction"]>> {
    const publicKey = await signer.publicKey();
    const context = {
      runtimeCall,
      sender: publicKey,
      rollup: this,
      overrides,
    };
    const unsignedTx = await this._builder.unsignedTransaction(context);

    return this.signAndSubmitTransaction(unsignedTx, {
      signer,
    });
  }

  /**
   * Simulates a runtime call transaction.
   *
   * This method can be useful to estimate the gas cost of a runtime call transaction.
   *
   * @remarks DEVELOPER NOTE: This endpoint is currently tightly coupled to sovereign specific
   * data types, it should be made more generic or moved to StandardRollup in the meantime.
   *
   * @param runtimeMessage - The runtime message to call.
   */
  private async _simulate(
    runtimeMessage: S["RuntimeCall"],
    { signer, txDetails }: SimulateParams
  ): Promise<SovereignClient.Rollup.SimulateExecutionResponse> {
    const runtimeCall = this.serializer.serializeRuntimeCall(runtimeMessage);
    const publicKey = await signer.publicKey();
    const dedup = await this.rollup.addresses.dedup(bytesToHex(publicKey));
    // biome-ignore lint/suspicious/noExplicitAny: fix later
    const nonce = (dedup.data as any).nonce as number;
    const response = await this.rollup.simulate({
      body: {
        details: txDetails,
        encoded_call_message: bytesToHex(runtimeCall),
        nonce,
        sender_pub_key: bytesToHex(publicKey),
      },
    });

    // biome-ignore lint/style/noNonNullAssertion: fix later
    return response.data!;
  }

  /**
   * A ledger client that can be used to query the ledger.
   */
  get ledger(): SovereignClient.Ledger {
    return this._client.ledger;
  }

  /**
   * A sequencer client that can be used to submit transactions & batches to the rollup.
   */
  get sequencer(): SovereignClient.Sequencer {
    return this._client.sequencer;
  }

  /**
   * A rollup client that can be used to perform operations on the rollup.
   */
  get rollup(): SovereignClient.Rollup {
    return this._client.rollup;
  }

  /**
   * A client that can be used to perform HTTP requests to the Sovereign API.
   * This can be used as an escape hatch to execute arbitrary requests to the Sovereign API
   * if the operation is not supported by `ledger`, `sequencer`, or `rollup` clients.
   */
  get http(): SovereignClient {
    return this._client;
  }

  /**
   * The serializer for the rollup.
   * Can be used to serialize transactions, runtime calls, etc.
   * See {@link RollupSerializer} for more information.
   */
  get serializer(): RollupSerializer {
    return this._serializer;
  }

  get context(): C {
    return this._config.context;
  }
}
