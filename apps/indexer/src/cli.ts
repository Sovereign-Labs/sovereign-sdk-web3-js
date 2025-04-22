import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import packageJson from "../package.json";
import { Indexer } from "./indexer";
import logger from "./logger";
import { createStandardRollup } from "@sovereign-sdk/web3";
import { getDefaultDatabase } from "./db";

let _indexer: Indexer | undefined = undefined;

function scriptName() {
  return "sov-indexer";
}

interface CliArgs {
  rollupUrl: string;
}

const argv = yargs(hideBin(process.argv))
  .scriptName(scriptName())
  .option("rollup-url", {
    describe: "URL for the rollup",
    type: "string",
    demandOption: true,
  })
  .help()
  .version(`${scriptName()} version: ${packageJson.version}`)
  .parse() as CliArgs;

async function onExit() {
  logger.info("Exit signal received, shutting down indexer");

  await _indexer?.stop();
}

process.on("SIGINT", onExit);
process.on("SIGTERM", onExit);
process.on("SIGHUP", onExit);

logger.info("Indexer starting..");

const rollup = await createStandardRollup({
  url: argv.rollupUrl,
  context: {
    defaultTxDetails: {
      max_priority_fee_bips: 0,
      max_fee: "100000000",
      gas_limit: null,
      chain_id: 4321,
    },
  },
});
_indexer = new Indexer({
  rollup,
  database: getDefaultDatabase(),
});
