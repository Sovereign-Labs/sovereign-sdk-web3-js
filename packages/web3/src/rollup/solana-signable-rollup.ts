import type SovereignClient from "@sovereign-sdk/client";
import type { Signer } from "@sovereign-sdk/signers";
import { bytesToHex, hexToBytes } from "@sovereign-sdk/utils";
import { Base64 } from "js-base64";
import type { DeepPartial } from "../utils";
import type { RollupConfig, TypeBuilder } from "./rollup";
import {
  StandardRollup,
  type StandardRollupContext,
  type StandardRollupSpec,
  type UnsignedTransaction,
  createStandardRollup,
} from "./standard-rollup";

export type SolanaSignableRollupContext = StandardRollupContext & {
  solanaEndpoint: string;
};

export type SolanaSignableRollupSpec<RuntimeCall> =
  StandardRollupSpec<RuntimeCall>;

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

export class SolanaSignableRollup<RuntimeCall> extends StandardRollup<
  RuntimeCall,
  SolanaSignableRollupContext
> {
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
    const serializer = await this.serializer();
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
    const chainHash = await this.chainHash();
    const solanaMessage: SolanaOffchainSimpleMessage = {
      signed_message: jsonBytes,
      chain_hash: chainHash,
      pubkey: pubkey,
      signature: signature,
    };

    // Serialize the message using borsh
    const serializedMessage = this.serializeSolanaMessage(solanaMessage);

    // Submit the transaction using custom endpoint
    const response = await this.http.post<
      string,
      SovereignClient.Sequencer.TxCreateResponse
    >(this.context.solanaEndpoint, {
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
    const context = {
      runtimeCall,
      rollup: this,
      overrides:
        overrides ?? ({} as DeepPartial<UnsignedTransaction<RuntimeCall>>),
    };

    // Access the protected _typeBuilder directly
    const unsignedTx = await this._typeBuilder.unsignedTransaction(context);

    return this.signWithSolanaAndSubmitTransaction(unsignedTx, signer);
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

export async function createSolanaSignableRollup<
  RuntimeCall,
  C extends SolanaSignableRollupContext = SolanaSignableRollupContext,
>(
  rollupConfig?: Partial<RollupConfig<DeepPartial<C>>>,
  typeBuilderOverrides?: Partial<
    TypeBuilder<SolanaSignableRollupSpec<RuntimeCall>, C>
  >,
) {
  // Build the config with default Solana endpoint
  const config = rollupConfig ?? {};
  const contextWithDefaults = {
    solanaEndpoint: "/sequencer/accept-solana-offchain-tx",
    ...config.context,
  } as DeepPartial<C>;

  const configWithDefaults = {
    ...config,
    context: contextWithDefaults,
  };

  // Create StandardRollup with the Solana context
  const standardRollup = await createStandardRollup<RuntimeCall, C>(
    configWithDefaults,
    typeBuilderOverrides,
  );

  // Transform the StandardRollup into a SolanaSignableRollup by changing its prototype
  Object.setPrototypeOf(standardRollup, SolanaSignableRollup.prototype);

  return standardRollup as unknown as SolanaSignableRollup<RuntimeCall>;
}
