import { type Rollup, createStandardRollup } from "@sovereign-sdk/web3";
import { beforeAll, describe, expect, it } from "vitest";
import { Bank } from "../src";

const NON_EXISTENT_ADDRESS =
  "sov1z3lak4ph8m367vqhwu3x4dzyprhd5ex60frs5js0p2ptjmjere6";
const VALID_GAS_ADDRESS =
  "sov1lzkjgdaz08su3yevqu6ceywufl35se9f33kztu5cu2spja5hyyf";

describe("bank", async () => {
  let rollup: Rollup<any, any>;

  beforeAll(async () => {
    rollup = await createStandardRollup();
  });

  describe("balance()", async () => {
    it("should return 0 for an account with no balance", async () => {
      const bank = new Bank(rollup);
      const actual = await bank.balance(NON_EXISTENT_ADDRESS);
      expect(actual).toBe(BigInt(0));
    });

    it("should return the balance for an existing account", async () => {
      const bank = new Bank(rollup);
      const actual = await bank.balance(VALID_GAS_ADDRESS);
      // Other integration tests might modify the balance, lets just make sure it returns _something_
      expect(actual).toBeGreaterThan(BigInt(0));
    });
  });

  describe("gasTokenId()", async () => {
    it("should return the expected gas token id", async () => {
      const bank = new Bank(rollup);
      const actual = await bank.gasTokenId();
      expect(actual).toBe(
        "token_1nyl0e0yweragfsatygt24zmd8jrr2vqtvdfptzjhxkguz2xxx3vs0y07u7",
      );
    });
  });

  describe("totalSupply()", async () => {
    it("should return the expected total supply", async () => {
      const bank = new Bank(rollup);
      const actual = await bank.totalSupply();
      expect(actual).toBe(BigInt("10030000000000000"));
    });
  });
});
