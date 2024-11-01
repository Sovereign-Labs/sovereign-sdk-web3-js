import { describe, it, expect } from "vitest";
import { createStandardRollup } from "@sovereign-sdk/web3";
import demoSchema from "../../../__fixtures__/demo-rollup-schema.json";
import { getSigner } from "./signer";
import { sleep } from "./utils";

const signer = getSigner();
const rollup = createStandardRollup({
  schema: demoSchema,
  context: {
    defaultTxDetails: {
      max_priority_fee_bips: 0,
      max_fee: 100000000,
      // currently need to do `None` for None Option variant
      gas_limit: "None" as any,
      chain_id: 4321,
    },
  },
});

describe("rollup", () => {
  describe.sequential("transaction submission", () => {
    it.todo("should successfully sign and submit a transaction", async () => {
      const runtimeCall = {
        value_setter: {
          set_value: 5,
        },
      };
      const { transaction, response } = await rollup.call(runtimeCall, {
        signer,
      });
      expect(response.data!.status).toEqual("submitted");

      const batch = [transaction];
      const batchResult = await rollup.submitBatch(batch);

      expect(batchResult.data!.num_txs).toEqual(1);
    });
    it.todo(
      "should submit a batch with incrementing nonces successfully",
      async () => {
        const publicKey = await signer.publicKey();
        let { nonce } = await rollup.dedup(publicKey);
        const startingNonce = nonce;
        const batch = [];
        const callMessages = [
          { value_setter: { set_value: 8 } },
          { value_setter: { set_value: 10 } },
          { value_setter: { set_value: 5 } },
        ];

        for (const callMessage of callMessages) {
          const { transaction } = await rollup.call(callMessage, {
            signer,
            overrides: { nonce },
          });

          batch.push(transaction);
          nonce += 1;
        }

        expect(batch.length).toEqual(3);
        expect(nonce).toEqual(startingNonce + 3);

        await sleep(500);

        const batchResult = await rollup.submitBatch(batch);
        expect(batchResult.data!.num_txs).toEqual(3);
      }
    );
    it.todo(
      "should successfully create a new token using the bank module",
      () => {
        // bank: {
        //   create_token: {
        //     token_name: "sov-test-token-from-web3",
        //     initial_balance: 10000,
        //     mint_to_address:
        //       "sov1x3jtvq0zwhj2ucsc4hqugskvralrulxvf53vwtkred93s2x9gmzs04jvyr",
        //     authorized_minters: [
        //       "sov1l6n2cku82yfqld30lanm2nfw43n2auc8clw7r5u5m6s7p8jrm4zqrr8r94",
        //       "sov1x3jtvq0zwhj2ucsc4hqugskvralrulxvf53vwtkred93s2x9gmzs04jvyr",
        //       "sov15vspj48hpttzyvxu8kzq5klhvaczcpyxn6z6k0hwpwtzs4a6wkvqwr57gc",
        //     ],
        //   },
        // },
      }
    );
  });
});
