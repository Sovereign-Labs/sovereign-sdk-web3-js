// just a file to run and test stuff
// run with `pnpm run playground`
import { createStandardRollup } from "@sovereign-sdk/web3";
import { getSigner, addressFromPublicKey } from "./signer.js";

let subscription;
const run = async () => {
  const signer = getSigner();
  const publicKey = await signer.publicKey();
  console.log(addressFromPublicKey(publicKey));

  const rollup = await createStandardRollup({
    context: {
      defaultTxDetails: {
        max_priority_fee_bips: 0,
        max_fee: "100000000",
        gas_limit: null,
        chain_id: 4321,
      },
    },
  });

  console.log("subscribing to rollup events");
  subscription = rollup.subscribe("events", async (event) => {
    console.log(event);
  });
};

await run();
