import { describe, it, expect, beforeAll } from "vitest";
import { createStandardRollup, StandardRollup } from "@sovereign-sdk/web3";
import { getSigner } from "./signer";
import { Signer } from "@sovereign-sdk/signers";

let signer: Signer;
let rollup: StandardRollup<any>;

describe("rollup", async () => {
  describe.sequential("transaction submission", () => {
    it("should successfully sign and submit a transaction", async () => {
      rollup = await createStandardRollup({
        context: {
          defaultTxDetails: {
            max_priority_fee_bips: 0,
            max_fee: "100000000",
            gas_limit: null,
            chain_id: 4321,
          },
        },
      });
      signer = getSigner(rollup.chainHash);
      const runtimeCall = {
        value_setter: {
          set_value: {
            value: 5,
            gas: null,
          },
        },
      };
      const { response } = await rollup.call(runtimeCall, {
        signer,
      });
      expect(response.data!.status).toEqual("submitted");
    });
    it("should submit a batch with manually incrementing nonces successfully", async () => {
      rollup = await createStandardRollup({
        context: {
          defaultTxDetails: {
            max_priority_fee_bips: 0,
            max_fee: "100000000",
            gas_limit: null,
            chain_id: 4321,
          },
        },
      });
      signer = getSigner(rollup.chainHash);
      const publicKey = await signer.publicKey();
      let { nonce } = await rollup.dedup(publicKey);
      const startingNonce = nonce;
      const batch = [];
      const callMessages = [
        { value_setter: { set_value: { value: 8, gas: null } } },
        { value_setter: { set_value: { value: 10, gas: null } } },
        { value_setter: { set_value: { value: 12, gas: null } } },
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
    });
  });
});
