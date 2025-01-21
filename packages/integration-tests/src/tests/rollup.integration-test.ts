import { describe, it, expect, beforeAll } from "vitest";
import { createStandardRollup, StandardRollup } from "@sovereign-sdk/web3";
import { getSigner } from "./signer";
import { Signer } from "@sovereign-sdk/signers";

let signer: Signer;
let rollup: StandardRollup<any>;

describe("rollup", async () => {
  beforeAll(async () => {
    signer = getSigner();
    rollup = await createStandardRollup({
      context: {
        defaultTxDetails: {
          max_priority_fee_bips: 0,
          max_fee: 100000000,
          gas_limit: null,
          chain_id: 4321,
        },
      },
    });
  });

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
            overrides: { generation: nonce },
          });

          batch.push(transaction);
          nonce += 1;
        }

        expect(batch.length).toEqual(3);
        expect(nonce).toEqual(startingNonce + 3);
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
