import { describe, it, expect } from "vitest";
import {
  createStandardRollup,
  StandardRollup,
  VersionMismatchError,
} from "@sovereign-sdk/web3";
import { Ed25519Signer } from "@sovereign-sdk/signers";

const privateKey = new Uint8Array([
  117, 251, 248, 217, 135, 70, 194, 105, 46, 80, 41, 66, 185, 56, 200, 35, 121,
  253, 9, 234, 159, 91, 96, 212, 211, 158, 135, 225, 180, 36, 104, 253,
]);
let signer = new Ed25519Signer(privateKey);
let rollup: StandardRollup<any>;

const testAddress = {
  Standard: "sov1lzkjgdaz08su3yevqu6ceywufl35se9f33kztu5cu2spja5hyyf",
};

describe("rollup", async () => {
  describe.sequential("transaction submission", () => {
    it("should throw a version mismatch error if chain hash is wrong", async () => {
      rollup = await createStandardRollup();
      const chainHash = rollup.chainHash;
      Object.defineProperty(rollup.serializer.schema, "chainHash", {
        get: () => new Uint8Array([1]),
        configurable: true,
      });
      const runtimeCall = {
        bank: {
          create_token: {
            token_name: "token_2",
            initial_balance: "20000",
            token_decimals: 12,
            supply_cap: "100000000000",
            mint_to_address: testAddress,
            admins: [testAddress],
          },
        },
      };
      await expect(rollup.call(runtimeCall, { signer })).rejects.toThrow(
        VersionMismatchError
      );

      // restore correct chainhash
      Object.defineProperty(rollup.serializer.schema, "chainHash", {
        get: () => chainHash,
        configurable: true,
      });

      // if we succeed now then the chain hash was the issue
      // and we correctly threw a version mismatch error the first time
      const result = await rollup.call(runtimeCall, { signer });
      expect(result.response.status).toEqual("submitted");
    });
    it("should successfully sign and submit a transaction", async () => {
      rollup = await createStandardRollup();
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
      expect(response.status).toEqual("submitted");
    });
    it("should submit a batch with manually incrementing nonces successfully", async () => {
      rollup = await createStandardRollup();
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
