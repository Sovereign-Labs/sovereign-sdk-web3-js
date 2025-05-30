import type SovereignSDK from "@sovereign-sdk/client";
import type { Signer } from "@sovereign-sdk/signers";
import type { BaseTypeSpec } from "@sovereign-sdk/web3";

/** Response data type from a transaction submission */
export type TxResult = SovereignSDK.Sequencer.TxCreateResponse.Data;

/**
 * Possible outcomes for a generated transaction.
 * Used to control whether the transaction should succeed or fail.
 */
export enum Outcome {
  /** Transaction should be generated to succeed */
  Success = 0,
  /** Transaction should be generated to fail */
  Failure = 1,
}

/**
 * Represents a generated transaction input with its associated metadata.
 * @template S - The type specification for the rollup being tested
 */
export type GeneratedInput<S extends BaseTypeSpec> = {
  /** The unsigned transaction to be submitted */
  unsignedTransaction: S["UnsignedTransaction"];
  /** The signer to use for signing the transaction */
  signer: Signer;
  /** Optional callback to be executed after the transaction is submitted */
  onSubmitted?: (result: TxResult) => Promise<void>;
};

/**
 * Interface for generating individual test transactions.
 * Implementations should create transactions that can either succeed or fail
 * based on the provided outcome.
 *
 * @template S - The type specification for the rollup being tested
 *
 * @example
 * ```typescript
 * class CustomGenerator implements TransactionGenerator<YourTypeSpec> {
 *   async generate(outcome: Outcome): Promise<GeneratedInput<YourTypeSpec>> {
 *     // Generate transaction based on outcome
 *     return {
 *       unsignedTransaction: {},
 *       signer: {},
 *       onSubmitted: async (result) => {
 *         // Handle submission result
 *       }
 *     };
 *   }
 * }
 * ```
 */
export interface TransactionGenerator<S extends BaseTypeSpec> {
  /**
   * Generates a single test transaction.
   * @param outcome - Whether the transaction should be generated to succeed or fail
   * @returns A promise that resolves to the generated transaction input
   */
  generate(outcome: Outcome): Promise<GeneratedInput<S>>;
}

/**
 * Interface for generating batches of test transactions.
 * Implementations should create multiple transactions according to the specified amount.
 *
 * @template S - The type specification for the rollup being tested
 */
export interface GeneratorStrategy<S extends BaseTypeSpec> {
  /**
   * Generates a batch of test transactions.
   * @param amount - The number of transactions to generate
   * @returns A promise that resolves to an array of generated transaction inputs
   */
  generate(amount: number): Promise<GeneratedInput<S>[]>;
}

/**
 * A basic implementation of GeneratorStrategy that generates a fixed number of
 * transactions that always succeed using a singular TransactionGenerator.
 *
 * @template S - The type specification for the rollup being tested
 *
 * @example
 * ```typescript
 * const generator = new YourTransactionGenerator();
 * const strategy = new BasicGeneratorStrategy(generator);
 * const transactions = await strategy.generate(100);
 * ```
 */
export class BasicGeneratorStrategy<S extends BaseTypeSpec>
  implements GeneratorStrategy<S>
{
  private readonly generator: TransactionGenerator<S>;

  /**
   * Creates a new BasicGeneratorStrategy instance.
   * @param generator - The transaction generator to use for creating individual transactions
   */
  constructor(generator: TransactionGenerator<S>) {
    this.generator = generator;
  }

  /**
   * Generates a batch of test transactions using the configured generator.
   * All transactions are generated with Outcome.Success.
   *
   * @param amount - The number of transactions to generate
   * @returns A promise that resolves to an array of generated transaction inputs
   */
  async generate(amount: number): Promise<GeneratedInput<S>[]> {
    const promises = [];

    for (let i = 0; i <= amount; i += 1) {
      const input = this.generator.generate(Outcome.Success);
      promises.push(input);
    }

    const inputs = await Promise.all(promises);
    return inputs;
  }
}
