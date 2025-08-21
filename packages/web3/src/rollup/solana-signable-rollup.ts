import type SovereignClient from "@sovereign-sdk/client";
import type { Signer } from "@sovereign-sdk/signers";
import { bytesToHex, hexToBytes } from "@sovereign-sdk/utils";
import { Base64 } from "js-base64";
import type { Subscription, SubscriptionToCallbackMap } from "../subscriptions";
import type { DeepPartial } from "../utils";
import type { RollupConfig } from "./rollup";
import {
  type StandardRollup,
  type StandardRollupContext,
  type StandardRollupSpec,
  type UnsignedTransaction,
  createStandardRollup,
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
   * Signs an unsigned transaction using Solana offchain signing and submits it to the rollup.
   * Utilizes the provided signer to sign the transaction.
   * Only compatible with ED25519 signers - signers using other signature types will create an invalid TX!
   *
   * @param unsignedTx - The unsigned transaction to sign and submit
   * @param signer - The signer to sign the transaction with
   * @returns The transaction hash
   */
  async signWithSolanaAndSubmitTransaction(
    unsignedTx: UnsignedTransaction<RuntimeCall>,
    signer: Signer,
  ): Promise<string> {
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

    // Serialize the message using borsh
    const serializedMessage = this.serializeSolanaMessage(solanaMessage);

    // Submit the transaction using custom endpoint
    const response = await this.inner.http.post<
      string,
      SovereignClient.Sequencer.TxCreateResponse
    >(this.solanaEndpoint, {
      body: Base64.fromUint8Array(serializedMessage),
    });

    return response.id;
  }

  /**
   * Performs a runtime call transaction using Solana offchain signing.
   * Utilizes the provided signer to sign the transaction.
   * Only compatible with ED25519 signers - signers using other signature types will create an invalid TX!
   *
   * @param runtimeCall - The runtime call to execute
   * @param signer - The signer to sign the transaction with
   * @param overrides - Optional overrides for transaction details
   * @returns The transaction hash
   */
  async callWithSolana(
    runtimeCall: RuntimeCall,
    signer: Signer,
    overrides: DeepPartial<UnsignedTransaction<RuntimeCall>> = {},
  ): Promise<string> {
    // Build unsigned transaction directly without typeBuilder to avoid type issues
    const uniqueness = overrides.uniqueness
      ? (overrides.uniqueness as { nonce: number } | { generation: number })
      : { generation: Date.now() };
    const details = {
      ...this.inner.context.defaultTxDetails,
      ...overrides.details,
    };

    const unsignedTx: UnsignedTransaction<RuntimeCall> = {
      runtime_call: runtimeCall,
      uniqueness,
      details,
    };

    return this.signWithSolanaAndSubmitTransaction(unsignedTx, signer);
  }

  // Delegate standard methods to inner rollup
  async call(
    runtimeCall: RuntimeCall,
    params: {
      signer: Signer;
      overrides?: DeepPartial<UnsignedTransaction<RuntimeCall>>;
    },
    options?: SovereignClient.RequestOptions,
  ) {
    return this.inner.call(runtimeCall, params, options);
  }

  async signAndSubmitTransaction(
    unsignedTx: UnsignedTransaction<RuntimeCall>,
    params: { signer: Signer },
    options?: SovereignClient.RequestOptions,
  ) {
    return this.inner.signAndSubmitTransaction(unsignedTx, params, options);
  }

  async submitTransaction(
    transaction: StandardRollupSpec<RuntimeCall>["Transaction"],
    options?: SovereignClient.RequestOptions,
  ) {
    return this.inner.submitTransaction(transaction, options);
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
   * Serializes a SolanaOffchainSimpleMessage using borsh encoding.
   */
  private serializeSolanaMessage(
    message: SolanaOffchainSimpleMessage,
  ): Uint8Array {
    // Calculate total size
    const totalSize =
      4 +
      message.signed_message.length + // Vec<u8> length prefix + data
      32 + // chain_hash [u8; 32]
      32 + // pubkey (assuming 32 bytes)
      64; // signature (assuming 64 bytes)

    const buffer = new Uint8Array(totalSize);
    let offset = 0;

    const view = new DataView(buffer.buffer);
    view.setUint32(offset, message.signed_message.length, true); // little-endian
    offset += 4;
    buffer.set(message.signed_message, offset);
    offset += message.signed_message.length;

    buffer.set(message.chain_hash, offset);
    offset += 32;

    buffer.set(message.pubkey, offset);
    offset += message.pubkey.length;

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
