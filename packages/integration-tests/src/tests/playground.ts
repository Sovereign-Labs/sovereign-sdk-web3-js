// just a file to run and test stuff
// run with `pnpm run playground`
import {
  createStandardRollup,
  addressFromPublicKey,
  StandardRollup,
} from "@sovereign-sdk/web3";
import { getSigner } from "./signer.js";
import pRetry from "p-retry";

let successes = 0;

async function getState(
  rollup: StandardRollup<{}>,
  height: number
): Promise<any> {
  return pRetry(
    async () => {
      const result = await rollup.http.get(
        "/modules/attester-incentives/state/rollup-finality-period",
        {
          query: {
            slot_number: height,
          },
        }
      );
      successes += 1;

      return result;
    },
    {
      retries: 5,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 10000,
    }
  );
}

async function slotNumberRepro(rollup: StandardRollup<{}>) {
  const response = await rollup.ledger.slots.finalized();
  const slotNumber = response.data!.number;

  try {
    const result = getState(rollup, slotNumber);
    // const result = await rollup.http.get(
    //   "/modules/attester-incentives/state/rollup-finality-period",
    //   {
    //     query: {
    //       slot_number: slotNumber,
    //     },
    //     maxRetries: 200,
    //   }
    // );
    successes += 1;
    console.log("success with height", slotNumber);
    setTimeout(() => slotNumberRepro(rollup), 0);
  } catch (e) {
    console.log("got a error", e);
    console.log("succeed times", successes);
  }
}

let subscription;
const run = async () => {
  const rollup = await createStandardRollup({
    url: "https://rollup.staging.bullet.xyz",
    context: {
      defaultTxDetails: {
        max_priority_fee_bips: 0,
        max_fee: "100000000",
        gas_limit: null,
        chain_id: 4321,
      },
    },
  });

  slotNumberRepro(rollup as any);

  // const signer = getSigner(rollup.chainHash);
  // const publicKey = await signer.publicKey();
  // console.log(addressFromPublicKey(publicKey, "sov"));

  // console.log("subscribing to rollup events");
  // subscription = rollup.subscribe("events", async (event) => {
  //   console.log(event);
  // });
};

await run();
