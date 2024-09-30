import SovereignClient from "@sovereign-sdk/client";
import { Base64 } from "js-base64";
import {
  type RollupSerializer,
  createSerializer,
  type RollupSchema,
} from "./serialization";
import type { Signer } from "./signer";

export type RollupCallResult = {
  response: SovereignClient.Sequencer.TxCreateResponse;
  transaction: unknown;
};

export type RollupArgs = {
  url?: string;
  schema: RollupSchema;
};

export class StandardRollup {
  private readonly _client: SovereignClient;
  private readonly _serializer: RollupSerializer;

  constructor({ url, schema }: RollupArgs) {
    this._client = new SovereignClient({ baseURL: url });
    this._serializer = createSerializer(schema);
    // todo: have default tx details
  }

  async call(message: unknown, signer: Signer): Promise<RollupCallResult> {
    const serializedCall = this.serializer.serializeCallMessage(message);
    const nonce = 0; // TODO: call "capability" endpoint
    const unsignedTx = {
      call_message: serializedCall,
      nonce,
    };
    const response = await this.signAndSubmitTransaction(unsignedTx, signer);

    return {
      response,
      transaction: unsignedTx,
    };
  }

  async submitTransaction(
    transaction: unknown,
  ): Promise<SovereignClient.Sequencer.TxCreateResponse> {
    const serializedTx = this.serializer.serializeTx(transaction);

    return this.client.sequencer.txs.create({
      body: Base64.fromUint8Array(serializedTx),
    });
  }

  async signAndSubmitTransaction(
    unsignedTx: Record<string, unknown>,
    signer: Signer,
  ): Promise<SovereignClient.Sequencer.TxCreateResponse> {
    const serializedUnsignedTx =
      this.serializer.serializeUnsignedTx(unsignedTx);
    const signature = await signer.sign(serializedUnsignedTx);
    const tx = {
      signature,
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
