import type SovereignClient from "@sovereign-sdk/client";
import type { Signer } from "@sovereign-sdk/signers";
import { Base64 } from "js-base64";
import type { Subscription, SubscriptionToCallbackMap } from "../subscriptions";
import type { DeepPartial } from "../utils";
import type { RollupConfig, TransactionResult } from "./rollup";
import {
  type StandardRollup,
  type StandardRollupContext,
  type StandardRollupSpec,
  type Transaction,
  type UnsignedTransaction,
  createStandardRollup,
  standardTypeBuilder,
} from "./standard-rollup";

export type SolanaOffchainUnsignedTransaction<RuntimeCall> = {
  runtime_call: RuntimeCall;
  uniqueness: { nonce: number } | { generation: number };
  details: {
    max_priority_fee_bips: number;
    max_fee: string;
    gas_limit: number[] | null;
    chain_id: number;
  };
  chain_name: string;
};

export type SolanaOffchainSimpleMessage = {
  signed_message: Uint8Array;
  chain_hash: Uint8Array;
  pubkey: Uint8Array;
  signature: Uint8Array;
};

export type Authenticator = "standard" | "solanaSimple";

export class SolanaSignableRollup<RuntimeCall> {
  private inner: StandardRollup<RuntimeCall>;
  private solanaEndpoint: string;

  constructor(
    inner: StandardRollup<RuntimeCall>,
    solanaEndpoint = "/sequencer/accept-solana-offchain-tx",
  ) {
    this.inner = inner;
    this.solanaEndpoint = solanaEndpoint;
  }

  /**
   * Submits a Solana offchain message to the rollup.
   */
  private async submitSolanaMessage(
    solanaMessage: SolanaOffchainSimpleMessage,
  ): Promise<SovereignClient.Sequencer.TxCreateResponse> {
    const serializedMessage = this.serializeSolanaMessage(solanaMessage);

    return await this.inner.http.post<
      string,
      SovereignClient.Sequencer.TxCreateResponse
    >(this.solanaEndpoint, {
      body: Base64.fromUint8Array(serializedMessage),
    });
  }

  /**
   * Signs an unsigned transaction using Solana offchain simple signing and submits it.
   * Returns the transaction result in the same format as standard rollup.
   */
  private async signWithSolanaSimpleAndSubmit(
    unsignedTx: UnsignedTransaction<RuntimeCall>,
    signer: Signer,
  ): Promise<TransactionResult<Transaction<RuntimeCall>>> {
    const serializer = await this.inner.serializer();
    const schema = serializer.schema;
    const chainName = schema.chain_name || "";

    const solanaUnsignedTx: SolanaOffchainUnsignedTransaction<RuntimeCall> = {
      runtime_call: unsignedTx.runtime_call,
      uniqueness: unsignedTx.uniqueness,
      details: unsignedTx.details,
      chain_name: chainName,
    };

    // JSON serialize the Solana unsigned transaction
    const jsonBytes = new TextEncoder().encode(
      JSON.stringify(solanaUnsignedTx),
    );

    // Sign the JSON bytes
    const signature = await signer.sign(jsonBytes);
    const pubkey = await signer.publicKey();

    // Create SolanaOffchainSimpleMessage
    const chainHash = await this.inner.chainHash();
    const solanaMessage: SolanaOffchainSimpleMessage = {
      signed_message: jsonBytes,
      chain_hash: chainHash,
      pubkey: pubkey,
      signature: signature,
    };

    // Use the shared submission method
    const response = await this.submitSolanaMessage(solanaMessage);

    // Construct a standard transaction object for consistency
    const typeBuilder = standardTypeBuilder<StandardRollupSpec<RuntimeCall>>();
    const transaction = await typeBuilder.transaction({
      unsignedTx,
      sender: pubkey,
      signature: signature,
      rollup: this.inner,
    });

    return { response, transaction };
  }

  /**
   * Performs a runtime call transaction with the specified authenticator.
   *
   * @param runtimeCall - The runtime call to execute
   * @param params - Parameters including signer, authenticator type, and optional overrides
   * @param options - Optional request options
   * @returns The transaction result including hash and transaction object
   */
  async call(
    runtimeCall: RuntimeCall,
    params: {
      signer: Signer;
      authenticator: Authenticator;
      overrides?: DeepPartial<UnsignedTransaction<RuntimeCall>>;
    },
    options?: SovereignClient.RequestOptions,
  ): Promise<TransactionResult<Transaction<RuntimeCall>>> {
    // Dispatch based on authenticator
    switch (params.authenticator) {
      case "standard":
        return this.inner.call(
          runtimeCall,
          {
            signer: params.signer,
            overrides: params.overrides,
          },
          options,
        );
      case "solanaSimple": {
        // Build unsigned transaction
        const uniqueness = params.overrides?.uniqueness
          ? (params.overrides.uniqueness as
              | { nonce: number }
              | { generation: number })
          : { generation: Date.now() };
        const details = {
          ...this.inner.context.defaultTxDetails,
          ...params.overrides?.details,
        };

        const unsignedTx: UnsignedTransaction<RuntimeCall> = {
          runtime_call: runtimeCall,
          uniqueness,
          details,
        };

        return this.signWithSolanaSimpleAndSubmit(unsignedTx, params.signer);
      }
      default:
        throw new Error(`Unsupported authenticator: ${params.authenticator}`);
    }
  }

  /**
   * Signs and submits a transaction with the specified authenticator.
   *
   * @param unsignedTx - The unsigned transaction to sign and submit
   * @param params - Parameters including signer and authenticator type
   * @param options - Optional request options
   * @returns The transaction result
   */
  async signAndSubmitTransaction(
    unsignedTx: UnsignedTransaction<RuntimeCall>,
    params: { signer: Signer; authenticator: Authenticator },
    options?: SovereignClient.RequestOptions,
  ): Promise<TransactionResult<Transaction<RuntimeCall>>> {
    switch (params.authenticator) {
      case "standard":
        return this.inner.signAndSubmitTransaction(
          unsignedTx,
          {
            signer: params.signer,
          },
          options,
        );
      case "solanaSimple":
        return this.signWithSolanaSimpleAndSubmit(unsignedTx, params.signer);
      default:
        throw new Error(`Unsupported authenticator: ${params.authenticator}`);
    }
  }

  /**
   * Submits a standard transaction.
   */
  async submitTransaction(
    transaction: StandardRollupSpec<RuntimeCall>["Transaction"],
    authenticator: "standard",
    options?: SovereignClient.RequestOptions,
  ): Promise<SovereignClient.Sequencer.TxCreateResponse>;

  /**
   * Submits a Solana offchain message.
   */
  async submitTransaction(
    transaction: SolanaOffchainSimpleMessage,
    authenticator: "solanaSimple",
    options?: SovereignClient.RequestOptions,
  ): Promise<SovereignClient.Sequencer.TxCreateResponse>;

  /**
   * Submits a transaction with the specified authenticator.
   *
   * @param transaction - Either a standard transaction or a Solana message
   * @param authenticator - The authenticator type to use
   * @param options - Optional request options
   * @returns The transaction response
   */
  async submitTransaction(
    transaction:
      | StandardRollupSpec<RuntimeCall>["Transaction"]
      | SolanaOffchainSimpleMessage,
    authenticator: Authenticator,
    options?: SovereignClient.RequestOptions,
  ): Promise<SovereignClient.Sequencer.TxCreateResponse> {
    switch (authenticator) {
      case "standard":
        return this.inner.submitTransaction(
          transaction as StandardRollupSpec<RuntimeCall>["Transaction"],
          options,
        );
      case "solanaSimple": {
        // For Solana, we expect a SolanaOffchainSimpleMessage
        const solanaMessage = transaction as SolanaOffchainSimpleMessage;
        return await this.submitSolanaMessage(solanaMessage);
      }
      default:
        throw new Error(`Unsupported authenticator: ${authenticator}`);
    }
  }

  async simulate(
    runtimeMessage: RuntimeCall,
    params: Parameters<StandardRollup<RuntimeCall>["simulate"]>[1],
  ) {
    return this.inner.simulate(runtimeMessage, params);
  }

  async dedup(address: Uint8Array) {
    return this.inner.dedup(address);
  }

  async serializer() {
    return this.inner.serializer();
  }

  async chainHash() {
    return this.inner.chainHash();
  }

  async healthcheck(timeout?: number) {
    return this.inner.healthcheck(timeout);
  }

  subscribe<T extends keyof SubscriptionToCallbackMap>(
    type: T,
    callback: SubscriptionToCallbackMap[T],
  ): Subscription {
    return this.inner.subscribe(type, callback);
  }

  get context() {
    return this.inner.context;
  }

  get ledger() {
    return this.inner.ledger;
  }

  get sequencer() {
    return this.inner.sequencer;
  }

  get rollup() {
    return this.inner.rollup;
  }

  get http() {
    return this.inner.http;
  }

  /**
   * Helper method to serialize a SolanaOffchainSimpleMessage using borsh encoding.
   */
  private serializeSolanaMessage(
    message: SolanaOffchainSimpleMessage,
  ): Uint8Array {
    const VEC_LENGTH_PREFIX_SIZE = 4;
    const CHAIN_HASH_SIZE = 32;
    const PUBKEY_SIZE = 32;
    const SIGNATURE_SIZE = 64;

    // Validate message field lengths
    if (message.chain_hash.length !== CHAIN_HASH_SIZE) {
      throw new Error(
        `Invalid chain hash length: expected ${CHAIN_HASH_SIZE} bytes, got ${message.chain_hash.length}`,
      );
    }

    if (message.pubkey.length !== PUBKEY_SIZE) {
      throw new Error(
        `Invalid public key length: expected ${PUBKEY_SIZE} bytes, got ${message.pubkey.length}`,
      );
    }

    if (message.signature.length !== SIGNATURE_SIZE) {
      throw new Error(
        `Invalid signature length: expected ${SIGNATURE_SIZE} bytes, got ${message.signature.length}`,
      );
    }

    // Calculate total size using constants
    const totalSize =
      VEC_LENGTH_PREFIX_SIZE +
      message.signed_message.length +
      CHAIN_HASH_SIZE +
      PUBKEY_SIZE +
      SIGNATURE_SIZE;

    const buffer = new Uint8Array(totalSize);
    let offset = 0;

    // Serialize Vec<u8> with length prefix (little-endian u32)
    const view = new DataView(buffer.buffer);
    view.setUint32(offset, message.signed_message.length, true);
    offset += VEC_LENGTH_PREFIX_SIZE;
    buffer.set(message.signed_message, offset);
    offset += message.signed_message.length;

    // Serialize chain_hash [u8; 32]
    buffer.set(message.chain_hash, offset);
    offset += CHAIN_HASH_SIZE;

    // Serialize pubkey [u8; 32]
    buffer.set(message.pubkey, offset);
    offset += PUBKEY_SIZE;

    // Serialize signature [u8; 64]
    buffer.set(message.signature, offset);

    return buffer;
  }
}

export async function createSolanaSignableRollup<RuntimeCall>(
  rollupConfig?: Partial<RollupConfig<DeepPartial<StandardRollupContext>>>,
  solanaEndpoint = "/sequencer/accept-solana-offchain-tx",
) {
  // Create a standard rollup first
  const standardRollup = await createStandardRollup<RuntimeCall>(rollupConfig);

  // Wrap it with SolanaSignableRollup
  return new SolanaSignableRollup<RuntimeCall>(standardRollup, solanaEndpoint);
}
