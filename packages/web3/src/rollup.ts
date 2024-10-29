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

export class StandardRollup<T extends BaseTypeSpec = BaseTypeSpec> {
  private readonly _config: RollupConfig;
  private readonly _client: SovereignClient;
  private readonly _serializer: RollupSerializer;

  constructor(config: RollupConfig) {
    this._client = new SovereignClient({ baseURL: config.url });
    this._serializer = createSerializer(config.schema);
    this._config = config;
  }

  async submitTransaction(
    transaction: T["Transaction"],
  ): Promise<SovereignClient.Sequencer.TxCreateResponse> {
    const serializedTx = this.serializer.serializeTx(transaction);

    return this.sequencer.txs.create({
      body: Base64.fromUint8Array(serializedTx),
    });
  }

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

  get ledger(): SovereignClient.Ledger {
    return this._client.ledger;
  }

  get sequencer(): SovereignClient.Sequencer {
    return this._client.sequencer;
  }

  get rollup(): SovereignClient.Rollup {
    return this._client.rollup;
  }

  get http(): SovereignClient {
    return this._client;
  }

  get serializer(): RollupSerializer {
    return this._serializer;
  }
}
