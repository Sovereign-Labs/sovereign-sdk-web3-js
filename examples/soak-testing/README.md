# Soak Testing Example

This example demonstrates how to use the `@sovereign-sdk/test` package to perform soak testing on a Sovereign rollup. Soak testing helps verify the stability and performance of your rollup under sustained load by continuously submitting transactions.

We generate keypairs to use a users on the rollup, add those users to the rollups genesis config and use them to transfer funds to eachother.

## Concepts

### Transaction Generators

A transaction generator is responsible for creating individual test transactions. It implements the `TransactionGenerator` interface and should be designed to:

1. Create valid transactions for your rollup
2. Handle transaction signing
3. Verify transaction results
4. Optionally implement failure scenarios

Here's a basic example of a transaction generator:

```typescript
import { TransactionGenerator, Outcome } from "@sovereign-sdk/test/soak";

class CustomGenerator implements TransactionGenerator<YourTypeSpec> {
  async generate(outcome: Outcome): Promise<GeneratedInput<YourTypeSpec>> {
    // Create your transaction
    const unsignedTransaction = {
      // Your transaction details
    };

    // Get a signer for the transaction
    const signer = await this.getSigner();

    return {
      unsignedTransaction,
      signer,
      // Optional callback to verify transaction results
      onSubmitted: async (result) => {
        // Verify the transaction was successful
        // Check emitted events
        // Validate state changes
      },
    };
  }
}
```

### Generator Strategies

A generator strategy determines how multiple transactions are generated and executed. The `BasicGeneratorStrategy` provided by the package:

1. Takes a single transaction generator
2. Creates multiple transactions in parallel
3. Always generates successful transactions

You might want to use a custom strategy to do a weighted select of many `TransactionGenerator`s to submit more of a particular type of call message for example.
The strategy could also be configured to generate occasional failure transactions to execerise more code paths in your application.

You can create custom strategies by implementing the `GeneratorStrategy` interface:

```typescript
import { GeneratorStrategy } from "@sovereign-sdk/test/soak";

class CustomStrategy implements GeneratorStrategy<YourTypeSpec> {
  private readonly generators: TransactionGenerator<YourTypeSpec>[];

  constructor(generators: TransactionGenerator<YourTypeSpec>[]) {
    this.generators = generators;
  }

  async generate(amount: number): Promise<GeneratedInput<YourTypeSpec>[]> {
    const transactions = [];

    for (let i = 0; i < amount; i++) {
      // Choose a generator based on your strategy
      const generator = this.selectGenerator();
      const transaction = await generator.generate(Outcome.Success);
      transactions.push(transaction);
    }

    return transactions;
  }

  private selectGenerator(): TransactionGenerator<YourTypeSpec> {
    // Implement your selection logic
    // Could be random, round-robin, or based on some other criteria
    return this.generators[Math.floor(Math.random() * this.generators.length)];
  }
}
```

## Implementation Guide

### 1. Create a Transaction Generator

Start by implementing a transaction generator for your specific use case:

```typescript
function myTransactionGenerator(): TransactionGenerator<S> {
  return {
    async generate(outcome: Outcome) {
      // 1. Prepare transaction data
      const transactionData = {
        // Your transaction details
      };

      // 2. Get a signer
      const signer = await getSigner();

      // 3. Create the transaction
      const unsignedTransaction = {
        runtime_call: transactionData,
        details: defaultTxDetails,
        generation: Date.now(),
      };

      // 4. Return the transaction with optional verification
      return {
        unsignedTransaction,
        signer,
        onSubmitted: async (result) => {
          // Verify transaction results
          // Check events
          // Validate state changes
        },
      };
    },
  };
}
```

### 2. Choose or Create a Generator Strategy

Use the `BasicGeneratorStrategy` for simple cases:

```typescript
const generator = new BasicGeneratorStrategy(myTransactionGenerator());
```

Or create a custom strategy for more complex scenarios:

```typescript
class ComplexStrategy implements GeneratorStrategy<S> {
  private readonly generators: TransactionGenerator<S>[];

  constructor() {
    this.generators = [
      transferGenerator(),
      stakeGenerator(),
      unstakeGenerator(),
      // Add more generators as needed
    ];
  }

  async generate(amount: number): Promise<GeneratedInput<S>[]> {
    // Implement your strategy for generating multiple transactions
  }
}
```

### 3. Configure and Run the Test

Set up the test runner with your strategy:

```typescript
const rollup = await createStandardRollup<YourTypeSpec>({
  context: { defaultTxDetails },
});

const strategy = new YourStrategy();
const runner = new TestRunner<S>({
  rollup,
  generator: strategy,
  concurrency: 30, // Adjust based on your needs
});

// Start the test
await runner.run();

// Stop when needed
await runner.stop();
```

## Example Implementation

The included example demonstrates a bank transfer soak test that:

- Transfers random amounts between accounts
- Verifies transfer events
- Uses the `BasicGeneratorStrategy` for simplicity

You can use this as a starting point for your own implementations.
