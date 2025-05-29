import type SovereignSDK from "@sovereign-sdk/client";
import type { Signer } from "@sovereign-sdk/signers";
import type { BaseTypeSpec, Rollup } from "@sovereign-sdk/web3";

// Add RNG utils - no need, `random` npm package is good
//
// Add on slots callback so they can check state or use event emitter
// - probably no need for this either, add these events to rollup client

export type TxResult = SovereignSDK.Sequencer.TxCreateResponse.Data;

export enum Outcome {
  Success = 0,
  Failure = 1,
}

export type GeneratedInput<S extends BaseTypeSpec> = {
  unsignedTransaction: S["UnsignedTransaction"];
  signer: Signer;
  onSubmitted?: (result: TxResult) => Promise<void>;
  onConfirmed?: () => Promise<void>;
};

export interface TransactionGenerator<S extends BaseTypeSpec> {
  generate(outcome: Outcome): Promise<GeneratedInput<S>>;
}

export interface TestOptions<S extends BaseTypeSpec> {
  generators: TransactionGenerator<S>[];
  rollup: Rollup<S, any>;
}

export class TestRunner<S extends BaseTypeSpec> {
  readonly rollup: Rollup<S, any>;
  readonly generators: TransactionGenerator<S>[];

  constructor({ rollup, generators }: TestOptions<S>) {
    this.rollup = rollup;
    this.generators = generators;
  }

  async run(): Promise<void> {
    this.doExecution();
  }

  async doExecution(): Promise<void> {
    // use p-limit to submit all with concurrency limit

    const inputs = await this.produceInputs();
    const execution = inputs.map(
      async ({ signer, unsignedTransaction, onSubmitted }) => {
        const { response } = await this.rollup.signAndSubmitTransaction(
          unsignedTransaction,
          {
            signer,
          },
        );
        // TODO: we wanted a successful outcome, lets ensure that's the case
        if (onSubmitted) {
          await onSubmitted(response.data);
        }
      },
    );
    console.time("execution");
    await Promise.allSettled(execution);
    console.timeEnd("execution");

    setTimeout(() => this.doExecution(), 100);
  }

  async produceInputs(amount = 100): Promise<GeneratedInput<S>[]> {
    const promises = [];

    for (let i = 0; i <= amount; i += 1) {
      const input = this.generators[0].generate(Outcome.Success);
      promises.push(input);
    }

    const inputs = await Promise.all(promises);
    return inputs;
  }

  async stop(): Promise<void> {}
}

export async function configureTestRunner<S extends BaseTypeSpec>(): Promise<
  TestRunner<S>
> {
  // setup genesis (do this first because we write sequencer to rollup config)
  // setup config
  // write files
  // Get port, start node using previous config/genesis/port
  return new TestRunner({} as any);
}
