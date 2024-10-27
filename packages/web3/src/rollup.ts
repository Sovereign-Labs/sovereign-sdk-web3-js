import SovereignClient from "@sovereign-sdk/client";
import { Base64 } from "js-base64";
import {
  type RollupSchema,
  type RollupSerializer,
  createSerializer,
} from "./serialization";
import type { Signer } from "./signer";
import { bytesToHex } from "./utils";

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

export class StandardRollup<Tx = unknown, UnsignedTx = unknown> {
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
  ): Promise<SovereignClient.Sequencer.TxCreateResponse> {
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
    };

    return this.submitTransaction(tx as Tx);
  }

  async call(
    runtimeMessage: unknown,
    { signer, txDetails }: CallParams,
  ): Promise<RollupCallResult> {
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
    const response = await this.signAndSubmitTransaction(
      unsignedTx as UnsignedTx,
      {
        signer,
      },
    );

    return {
      response,
      unsignedTx,
    };
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
