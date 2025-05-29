import {
  createStandardRollup,
  type StandardRollupSpec,
} from "@sovereign-sdk/web3";
import {
  TestRunner,
  type TransactionGenerator,
} from "@sovereign-sdk/test/soak";
import { hexToBytes } from "@sovereign-sdk/utils";
import random from "random";
import keypairs from "../data/keypairs.json" assert { type: "json" };
import type { Signer } from "@sovereign-sdk/signers";
import * as ed25519 from "@noble/ed25519";
import { type RuntimeCall } from "./types";
import assert from "node:assert";

type Keypair = (typeof keypairs)[0];
type S = StandardRollupSpec<RuntimeCall>;

let chainHash: Uint8Array | undefined;
const defaultTxDetails = {
  max_priority_fee_bips: 0,
  max_fee: "100000000",
  gas_limit: null,
  chain_id: 4321,
};
const gasTokenId =
  "token_1nyl0e0yweragfsatygt24zmd8jrr2vqtvdfptzjhxkguz2xxx3vs0y07u7";

function getSenderAndReceiver() {
  const sender = random.int(0, keypairs.length - 1);
  let receiver;

  do {
    receiver = random.int(0, keypairs.length - 1);
  } while (receiver === sender);

  return {
    sender: keypairs[sender]!,
    receiver: keypairs[receiver]!,
  };
}

function keypairAsSigner(keypair: Keypair): Signer {
  const privateKey = hexToBytes(keypair.privateKey);
  const publicKey = hexToBytes(keypair.publicKey);

  return {
    async sign(message: Uint8Array): Promise<Uint8Array> {
      return ed25519.signAsync(
        new Uint8Array([...message, ...chainHash!]),
        privateKey
      );
    },
    async publicKey(): Promise<Uint8Array> {
      return publicKey;
    },
  };
}

function bankTransferGenerator(): TransactionGenerator<S> {
  return {
    async generate() {
      const { sender, receiver } = getSenderAndReceiver();
      const unsignedTransaction = {
        runtime_call: {
          bank: {
            transfer: {
              coins: {
                amount: 100,
                token_id: gasTokenId,
              },
              to: receiver.address,
            },
          },
        },
        details: defaultTxDetails,
        generation: Date.now(),
      };

      return {
        unsignedTransaction,
        signer: keypairAsSigner(sender),
        async onSubmitted(result) {
          assert(
            result.events?.length === 1,
            "tranfer should only emit one event"
          );
          const event = result.events[0]?.value;

          assert.deepStrictEqual(
            event,
            {
              token_transferred: {
                from: {
                  user: sender.address,
                },
                to: {
                  user: receiver.address,
                },
                coins: {
                  amount: "100",
                  token_id: gasTokenId,
                },
              },
            },
            "transfer event should include the expected fields"
          );
        },
      };
    },
  };
}

async function main(): Promise<void> {
  const rollup = await createStandardRollup<RuntimeCall>({
    context: { defaultTxDetails },
  });
  chainHash = rollup.chainHash;

  const generators = [bankTransferGenerator()];
  const runner = new TestRunner<S>({ rollup, generators });

  return runner.run();
}

main()
  .then(() => console.log("Run completed successfully"))
  .catch(console.error);
