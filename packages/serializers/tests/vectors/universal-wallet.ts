import * as path from "node:path";
import * as fs from "node:fs";

interface TestVector {
  name: string;
  input: Record<string, unknown>;
  output: string;
  schema: string;
}

const vectorDir = path.join(import.meta.dirname, "universal-wallet-outputs");

export function loadUniversalWalletVectors(): TestVector[] {
  const result = [];
  const files = fs.readdirSync(vectorDir);

  for (const file of files) {
    if (file === ".gitkeep") continue;

    const content = fs.readFileSync(path.join(vectorDir, file), "utf8");
    const test = JSON.parse(content);

    result.push({
      name: file,
      input: JSON.parse(test.input),
      output: test.output,
      schema: test.schema,
    });
  }

  return result;
}
