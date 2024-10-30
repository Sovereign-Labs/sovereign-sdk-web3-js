import SovereignClient from "@sovereign-sdk/client";
import type { Signer } from "@sovereign-sdk/signers";
import { Base64 } from "js-base64";
import {
  type RollupSchema,
  type RollupSerializer,
  createSerializer,
} from "./serialization";
import type { BaseTypeSpec } from "./type-spec";
import { bytesToHex } from "./utils";

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
 * The configuration for a rollup client.
 */
export type RollupConfig = {
  /**
   * The base URL of the rollup full node API.
   */
  url?: string;
  /**
   * The schema of the rollup.
   */
  schema: RollupSchema;
  /**
   * The default transaction details.
   * This will be deprecated soon to remove Sovereign SDK specific types.
   * @deprecated
   * @private
   */
  defaultTxDetails: TxDetails;
};

type TxDetails = {
  max_priority_fee_bips: number;
  max_fee: number;
  gas_limit?: number[];
  chain_id: number;
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
export type CallParams = {
  /**
   * The transaction details to use for the call.
   * @deprecated This will be removed soon to remove Sovereign SDK specific types.
   *             In favor of a looser type specification.
   */
  txDetails?: TxDetails;
} & SignerParams;

/**
 * The parameters for simulating a runtime call transaction.
 */
export type SimulateParams = {
  /**
   * The transaction details to use for the simulation.
   * @deprecated This will be removed soon to remove Sovereign SDK specific types.
   *             In favor of a looser type specification.
   */
  txDetails: TxDetails;
} & SignerParams;

/**
 * The rollup client.
 *
 * @template T - The type specification for the rollup.
 *               If not provided, the base type specification will be used which uses `any` for all types.
 */
export class StandardRollup<T extends BaseTypeSpec = BaseTypeSpec> {
  private readonly _config: RollupConfig;
  private readonly _client: SovereignClient;
  private readonly _serializer: RollupSerializer;

  /**
   * Creates a new rollup client.
   *
   * @param config - The configuration for the rollup client.
   */
  constructor(config: RollupConfig) {
    this._client = new SovereignClient({ baseURL: config.url });
    this._serializer = createSerializer(config.schema);
    this._config = config;
  }

  /**
   * Submits a transaction to the rollup.
   *
   * @param transaction - The transaction to submit.
   */
  async submitTransaction(
    transaction: T["Transaction"],
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
    unsignedTx: T["UnsignedTransaction"],
    { signer }: SignerParams,
  ): Promise<TransactionResult<T["Transaction"]>> {
    const serializedUnsignedTx =
      this.serializer.serializeUnsignedTx(unsignedTx);
    const signature = await signer.sign(serializedUnsignedTx);
    const publicKey = await signer.publicKey();
    const tx = {
      pub_key: {
        pub_key: publicKey,
      },
      signature: {
        msg_sig: signature,
      },
      ...unsignedTx,
    } as T["Transaction"];
    const result = await this.submitTransaction(tx);

    return { transaction: tx, response: result };
  }

  /**
   * Performs a runtime call transaction.
   * Utilizes the provided signer to sign the transaction.
   *
   * @param runtimeMessage - The runtime message to call.
   */
  async call(
    runtimeMessage: T["RuntimeCall"],
    { signer, txDetails }: CallParams,
  ): Promise<TransactionResult<T["Transaction"]>> {
    const runtimeCall = this.serializer.serializeRuntimeCall(runtimeMessage);
    const publicKey = await signer.publicKey();
    const dedup = await this.rollup.addresses.dedup(bytesToHex(publicKey));
    // biome-ignore lint/suspicious/noExplicitAny: fix later
    const nonce = (dedup.data as any).nonce as number;
    const unsignedTx = {
      runtime_msg: runtimeCall,
      nonce,
      details: txDetails ?? this._config.defaultTxDetails,
    };

    return this.signAndSubmitTransaction(
      unsignedTx as T["UnsignedTransaction"],
      {
        signer,
      },
    );
  }

  /**
   * Simulates a runtime call transaction.
   *
   * This method can be useful to estimate the gas cost of a runtime call transaction.
   *
   * @param runtimeMessage - The runtime message to call.
   */
  async simulate(
    runtimeMessage: T["RuntimeCall"],
    { signer, txDetails }: SimulateParams,
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
}
