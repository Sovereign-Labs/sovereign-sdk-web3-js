import SovereignClient from "@sovereign-sdk/client";
import type { Signer } from "@sovereign-sdk/signers";
import { Base64 } from "js-base64";
import {
  type RollupSchema,
  type RollupSerializer,
  createSerializer,
} from "./serialization";
import { bytesToHex } from "./utils";

export type TransactionResult<Tx> = {
  response: SovereignClient.Sequencer.TxCreateResponse;
  transaction: Tx;
};

export type RollupConfig = {
  url?: string;
  schema: RollupSchema;
  defaultTxDetails: TxDetails;
};

type TxDetails = {
  max_priority_fee_bips: number;
  max_fee: number;
  gas_limit?: number[];
  chain_id: number;
};

type SignerParams = {
  signer: Signer;
};

type CallParams = {
  txDetails?: TxDetails;
} & SignerParams;

type SimulateParams = {
  txDetails: TxDetails;
} & SignerParams;

// biome-ignore lint/suspicious/noExplicitAny: fix later
export class StandardRollup<Tx = any, UnsignedTx = any> {
  private readonly _config: RollupConfig;
  private readonly _client: SovereignClient;
  private readonly _serializer: RollupSerializer;

  constructor(config: RollupConfig) {
    this._client = new SovereignClient({ baseURL: config.url });
    this._serializer = createSerializer(config.schema);
    this._config = config;
  }

  async submitTransaction(
    transaction: Tx,
  ): Promise<SovereignClient.Sequencer.TxCreateResponse> {
    const serializedTx = this.serializer.serializeTx(transaction);

    return this.client.sequencer.txs.create({
      body: Base64.fromUint8Array(serializedTx),
    });
  }

  async signAndSubmitTransaction(
    unsignedTx: UnsignedTx,
    { signer }: SignerParams,
  ): Promise<TransactionResult<Tx>> {
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
    } as Tx;
    const result = await this.submitTransaction(tx);

    return { transaction: tx, response: result };
  }

  async call(
    runtimeMessage: unknown,
    { signer, txDetails }: CallParams,
  ): Promise<TransactionResult<Tx>> {
    const runtimeCall = this.serializer.serializeRuntimeCall(runtimeMessage);
    const publicKey = await signer.publicKey();
    const dedup = await this.client.rollup.addresses.dedup(
      bytesToHex(publicKey),
    );
    // biome-ignore lint/suspicious/noExplicitAny: fix later
    const nonce = (dedup.data as any).nonce as number;
    const unsignedTx = {
      runtime_msg: runtimeCall,
      nonce,
      details: txDetails ?? this._config.defaultTxDetails,
    };

    return this.signAndSubmitTransaction(unsignedTx as UnsignedTx, {
      signer,
    });
  }

  async simulate(
    runtimeMessage: unknown,
    { signer, txDetails }: SimulateParams,
  ): Promise<SovereignClient.Rollup.SimulateExecutionResponse> {
    const runtimeCall = this.serializer.serializeRuntimeCall(runtimeMessage);
    const publicKey = await signer.publicKey();
    const dedup = await this.client.rollup.addresses.dedup(
      bytesToHex(publicKey),
    );
    // biome-ignore lint/suspicious/noExplicitAny: fix later
    const nonce = (dedup.data as any).nonce as number;
    const response = await this.client.rollup.simulate({
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

  get client(): SovereignClient {
    return this._client;
  }

  get serializer(): RollupSerializer {
    return this._serializer;
  }
}
