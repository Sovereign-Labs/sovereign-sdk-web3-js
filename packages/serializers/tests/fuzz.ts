import { exec } from "node:child_process";
import * as path from "node:path";
import { promisify } from "node:util";
import fs from "fs/promises";
import { JsSerializer, type Serializer } from "../src/index.js";
import { WasmSerializer } from "../src/wasm.js";

const execAsync = promisify(exec);

const FUZZ_INPUT_BINARY_PATH = path.join(
  __dirname,
  "..",
  "..",
  "universal-wallet-wasm",
  "fuzz_input",
  "target",
  "release",
  "fuzz_input"
);

interface Failure {
  iteration: number;
  timestamp: string;
  input?: object;
  error?: string;
  stack?: string;
}

interface Stats {
  iterations: number;
  failures: Failure[];
  startTime: number;
  lastReportTime: number;
}

interface Options {
  maxIterations: number;
  maxDuration: number;
  reportInterval: number;
  saveFailures: boolean;
  exitOnFirstFailure: boolean;
}

const DEFAULT_OPTIONS: Options = {
  maxIterations: Number.POSITIVE_INFINITY,
  maxDuration: Number.POSITIVE_INFINITY,
  reportInterval: 10000,
  saveFailures: true,
  exitOnFirstFailure: false,
};

class FuzzTester {
  private schema?: object;
  private js?: Serializer;
  private wasm?: Serializer;
  private options: Options;
  stats: Stats;

  constructor(options: Partial<Options> = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
    this.stats = {
      iterations: 0,
      failures: [],
      startTime: Date.now(),
      lastReportTime: Date.now(),
    };
  }

  async initialize() {
    console.log("Loading schema...");
    const { stdout } = await execAsync(`${FUZZ_INPUT_BINARY_PATH} schema`);
    this.schema = JSON.parse(stdout);
    this.js = new JsSerializer(this.schema!);
    this.wasm = new WasmSerializer(this.schema!);
    console.log("Schema loaded successfully");
  }

  async generateInput() {
    const { stdout } = await execAsync(`${FUZZ_INPUT_BINARY_PATH}`);
    return JSON.parse(stdout);
  }

  async runSingleTest() {
    try {
      const input = await this.generateInput();
      const jsResult = this.js!.serialize(input, 0);
      const wasmResult = this.wasm!.serialize(input, 0);

      if (JSON.stringify(jsResult) !== JSON.stringify(wasmResult)) {
        const failure = {
          iteration: this.stats.iterations,
          timestamp: new Date().toISOString(),
          input,
        };

        this.stats.failures.push(failure);

        if (this.options.saveFailures) {
          await this.saveFailure(failure);
        }

        if (this.options.exitOnFirstFailure) {
          throw new Error(`Failure at iteration ${this.stats.iterations}`);
        }
      }

      return true;
    } catch (error) {
      const failure = {
        iteration: this.stats.iterations,
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
        stack: (error as Error).stack,
      };

      this.stats.failures.push(failure);

      if (this.options.saveFailures) {
        await this.saveFailure(failure);
      }

      return false;
    }
  }

  async saveFailure(failure: Failure) {
    const failureDir = "fuzz-failures";
    await fs.mkdir(failureDir, { recursive: true });

    const filename = `failure-${failure.iteration}-${Date.now()}.json`;
    const filepath = path.join(failureDir, filename);

    await fs.writeFile(filepath, JSON.stringify(failure, null, 2));
    console.log(`Failure saved to: ${filepath}`);
  }

  shouldContinue() {
    const now = Date.now();
    const elapsed = now - this.stats.startTime;

    return (
      this.stats.iterations < this.options.maxIterations &&
      elapsed < this.options.maxDuration
    );
  }

  reportProgress() {
    const now = Date.now();
    if (now - this.stats.lastReportTime >= this.options.reportInterval) {
      const elapsed = now - this.stats.startTime;
      const rate = ((this.stats.iterations / elapsed) * 1000).toFixed(2);

      console.log(
        `Progress: ${this.stats.iterations} iterations, ${rate} iter/sec, ${this.stats.failures.length} failures`
      );
      this.stats.lastReportTime = now;
    }
  }

  async run() {
    await this.initialize();
    const { maxIterations, maxDuration } = this.options;

    console.log(`Starting fuzz test...`);
    console.log(
      `Max iterations: ${
        maxIterations === Number.POSITIVE_INFINITY ? "unlimited" : maxIterations
      }`
    );
    console.log(
      `Max duration: ${
        maxDuration === Number.POSITIVE_INFINITY
          ? "unlimited"
          : `${maxDuration / 1000}s`
      }`
    );

    while (this.shouldContinue()) {
      await this.runSingleTest();
      this.stats.iterations++;
      this.reportProgress();
    }

    await this.generateReport();
  }

  async generateReport() {
    const totalTime = Date.now() - this.stats.startTime;
    const rate = ((this.stats.iterations / totalTime) * 1000).toFixed(2);

    const report = {
      summary: {
        totalIterations: this.stats.iterations,
        totalTime: `${totalTime}ms`,
        rate: `${rate} iterations/sec`,
        failures: this.stats.failures.length,
        successRate: `${(
          ((this.stats.iterations - this.stats.failures.length) /
            this.stats.iterations) *
          100
        ).toFixed(2)}%`,
      },
      failures: this.stats.failures,
    };

    console.log("\n=== FUZZ TEST REPORT ===");
    console.table(report.summary);
    // console.log(`Total iterations: ${report.summary.totalIterations}`);
    // console.log(`Total time: ${report.summary.totalTime}`);
    // console.log(`Rate: ${report.summary.rate}`);
    // console.log(`Failures: ${report.summary.failures}`);
    // console.log(`Success rate: ${report.summary.successRate}`);

    if (this.options.saveFailures && report.summary.failures > 0) {
      await fs.writeFile("fuzz-report.json", JSON.stringify(report, null, 2));
      console.log("Report saved to: fuzz-report.json");
    }

    return report;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options: Partial<Options> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--max-iterations":
        options.maxIterations = Number.parseInt(args[++i]);
        break;
      case "--max-duration":
        options.maxDuration = Number.parseInt(args[++i]) * 1000; // Convert seconds to ms
        break;
      case "--exit-on-failure":
        options.exitOnFirstFailure = true;
        break;
      case "--no-save":
        options.saveFailures = false;
        break;
    }
  }

  const fuzzer = new FuzzTester(options);

  process.on("SIGINT", async () => {
    console.log("\nReceived SIGINT, generating report...");
    await fuzzer.generateReport();
    process.exit(0);
  });

  try {
    await fuzzer.run();
    process.exit(fuzzer.stats.failures.length > 0 ? 1 : 0);
  } catch (error) {
    console.error("Fuzz test failed:", error);
    process.exit(1);
  }
}

main();
