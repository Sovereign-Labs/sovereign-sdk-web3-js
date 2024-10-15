import SovereignClient from "@sovereign-sdk/client";
import { Base64 } from "js-base64";
import {
  type RollupSchema,
  type RollupSerializer,
  createSerializer,
} from "./serialization";
import type { Signer } from "./signer";

export type RollupCallResult = {
  response: SovereignClient.Sequencer.TxCreateResponse;
  unsignedTx: unknown;
};

export type RollupConfig = {
  url?: string;
  schema: RollupSchema;
  defaultTxDetails: TxDetails;
};

type TxDetails = {
  max_priority_fee_bips: number;
  max_fee: bigint;
  gas_limit?: bigint;
  chain_id: bigint;
};

type UnsignedTransaction = {
  runtime_msg: Uint8Array;
  nonce: bigint;
  details: TxDetails;
};

type SignedTransaction = UnsignedTransaction & {
  signature: { msg_sig: Uint8Array };
  pub_key: Uint8Array;
};

type CallParams = {
  signer: Signer;
  // The address to use to get the dedup information
  // TODO: we could move this from client code to sdk code by outputting the hasher used by the rollup
  // and use a default "builder" function to create the dedup address which will create the dedup address
  // according to the needs of the sovereign nonces module which is a credential id (hash of the pub key)
  deDupAddress: string;
  txDetails?: TxDetails;
};

export class StandardRollup {
  private readonly _config: RollupConfig;
  private readonly _client: SovereignClient;
  private readonly _serializer: RollupSerializer;

  constructor(config: RollupConfig) {
    this._client = new SovereignClient({ baseURL: config.url });
    this._serializer = createSerializer(config.schema);
    this._config = config;
  }

  async call(
    message: unknown,
    { signer, txDetails, deDupAddress }: CallParams
  ): Promise<RollupCallResult> {
    const serializedCall = this.serializer.serializeCallMessage(message);
    const dedup = await this.client.rollup.addresses.dedup.retrieve(
      deDupAddress
    );
    const nonce = BigInt((dedup.data as any).nonce as number);
    const unsignedTx: UnsignedTransaction = {
      runtime_msg: serializedCall,
      nonce,
      details: txDetails ?? this._config.defaultTxDetails,
    };
    const response = await this.signAndSubmitTransaction(unsignedTx, signer);

    return {
      response,
      unsignedTx,
    };
  }

  async submitTransaction(
    transaction: unknown
  ): Promise<SovereignClient.Sequencer.TxCreateResponse> {
    const serializedTx = this.serializer.serializeTx(transaction);

    return this.client.sequencer.txs.create({
      body: Base64.fromUint8Array(serializedTx),
    });
  }

  async signAndSubmitTransaction(
    unsignedTx: UnsignedTransaction,
    signer: Signer
  ): Promise<SovereignClient.Sequencer.TxCreateResponse> {
    const serializedUnsignedTx =
      this.serializer.serializeUnsignedTx(unsignedTx);
    const signature = await signer.sign(serializedUnsignedTx);
    const publicKey = await signer.publicKey();
    const tx: SignedTransaction = {
      pub_key: publicKey,
      signature: {
        msg_sig: signature,
      },
      ...unsignedTx,
    };

    return this.submitTransaction(tx);
  }

  get client(): SovereignClient {
    return this._client;
  }

  get serializer(): RollupSerializer {
    return this._serializer;
  }
}
