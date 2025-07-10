import { describe, it, expect } from "vitest";
import { createStandardRollup, StandardRollup } from "@sovereign-sdk/web3";
import { getSigner } from "./signer";
import { Signer } from "@sovereign-sdk/signers";

let signer: Signer;
let rollup: StandardRollup<any>;

const testAddress = {
  Standard: "sov1lzkjgdaz08su3yevqu6ceywufl35se9f33kztu5cu2spja5hyyf",
};

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
        bank: {
          create_token: {
            token_name: "token_1",
            initial_balance: "20000",
            token_decimals: 12,
            supply_cap: "100000000000",
            mint_to_address: testAddress,
            admins: [testAddress],
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
        {
          bank: {
            create_token: {
              token_name: "token_100",
              initial_balance: "20000",
              token_decimals: 12,
              supply_cap: "100000000000",
              mint_to_address: testAddress,
              admins: [testAddress],
            },
          },
        },
        {
          bank: {
            create_token: {
              token_name: "token_200",
              initial_balance: "20000",
              token_decimals: 12,
              supply_cap: "100000000000",
              mint_to_address: testAddress,
              admins: [testAddress],
            },
          },
        },
        {
          bank: {
            create_token: {
              token_name: "token_300",
              initial_balance: "30000",
              token_decimals: 12,
              supply_cap: "100000000000",
              mint_to_address: testAddress,
              admins: [testAddress],
            },
          },
        },
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
