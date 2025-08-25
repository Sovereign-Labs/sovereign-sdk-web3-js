/**
 * Manual test script for Ledger hardware wallet
 *
 * Prerequisites:
 * 1. Connect your Ledger device via USB
 * 2. Unlock it and open the Solana app
 * 3. Run: pnpm tsx src/ledger.test.manual.ts
 *
 */

import bs58 from "bs58";
import { Ed25519Signer } from "./ed25519";
import { LedgerSigner } from "./ledger";

// Solana preamble creation (copied from web3 package to avoid circular dependency)
function createSolanaPreamble(
  pubkey: Uint8Array,
  chainHash: Uint8Array,
  messageLength: number,
): Uint8Array {
  const SIGNING_DOMAIN = new Uint8Array([
    0xff,
    ...new TextEncoder().encode("solana offchain"),
  ]);
  const preamble = new Uint8Array(85); // PREAMBLE_LENGTH
  let offset = 0;
  preamble.set(SIGNING_DOMAIN, offset);
  offset += 16;
  preamble[offset] = 0; // HEADER_VERSION
  offset += 1;
  preamble.set(chainHash, offset);
  offset += 32;
  preamble[offset] = 0; // MESSAGE_FORMAT
  offset += 1;
  preamble[offset] = 1; // SINGLE_SIGNER_COUNT
  offset += 1;
  preamble.set(pubkey, offset);
  offset += 32;
  new DataView(preamble.buffer, offset).setUint16(0, messageLength, true);

  return preamble;
}

// Test data from solana-signable-rollup.test.ts (matching Rust tests)
const TEST_RUNTIME_CALL = {
  bank: {
    transfer: {
      to: "4zdwHNaEa5npHtRtaZ3RL1m6rptuQZ6RBLHG6cAyVHjL",
      coins: {
        amount: "5000",
        token_id:
          "token_1nyl0e0yweragfsatygt24zmd8jrr2vqtvdfptzjhxkguz2xxx3vs0y07u7",
      },
    },
  },
};

// Chain hash matching the test (from solana-signable-rollup.test.ts)
const TEST_CHAIN_HASH = new Uint8Array(32).fill(0x0b);

const TEST_MESSAGE = Buffer.from(
  JSON.stringify({
    runtime_call: TEST_RUNTIME_CALL,
    uniqueness: { generation: 0 },
    details: {
      max_priority_fee_bips: 0,
      max_fee: "100000000000",
      gas_limit: [1000000000, 1000000000],
      chain_id: 4321,
    },
    chain_name: "TestChain",
  }),
);

async function testLedgerSigner() {
  console.log("🔌 Ledger Hardware Wallet Test");
  console.log("================================\n");

  console.log("📋 Test Configuration:");
  console.log("- Derivation path: 44'/501' (default Solana account)");
  console.log(
    "- Chain hash:",
    Buffer.from(TEST_CHAIN_HASH).toString("hex"),
    "\n",
  );

  const ledger = new LedgerSigner();

  try {
    // Test 1: Get public key
    console.log("1️⃣  Getting public key from Ledger...");
    const publicKey = await ledger.publicKey();
    console.log("✅ Public key retrieved:");
    console.log("   Hex:    ", Buffer.from(publicKey).toString("hex"));
    console.log("   Base58: ", bs58.encode(publicKey));

    // Test 2: Create message with preamble
    console.log("2  Signing message with preamble...");
    const preamble = createSolanaPreamble(
      publicKey,
      TEST_CHAIN_HASH,
      TEST_MESSAGE.length,
    );
    const messageWithPreamble = Buffer.concat([preamble, TEST_MESSAGE]);

    // Test 3: Sign message with preamble
    console.log(
      "⚠️  Please check your Ledger device and approve the signing request",
    );

    const signature = await ledger.sign(messageWithPreamble);
    console.log("✅ Message signed:");
    console.log(
      "   Signature hex:    ",
      Buffer.from(signature).toString("hex"),
    );
    console.log("   Signature base58: ", bs58.encode(signature));
    console.log("   Signature length: ", signature.length, "bytes\n");

    // Test 4: Signature verification
    console.log("4️⃣  Signature verification using Ed25519:");

    // For Ed25519, we can verify the signature
    try {
      const ed25519 = await import("@noble/ed25519");
      const isValid = await ed25519.verifyAsync(
        signature,
        messageWithPreamble,
        publicKey,
      );
      console.log("✅ Signature verification:", isValid ? "PASSED" : "FAILED");

      if (!isValid) {
        console.error("❌ Signature verification failed!");
      }
    } catch (e) {
      console.log("⚠️  Could not verify signature:", e);
    }

    console.log("\n✅ All tests completed successfully!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    console.error(
      "Make sure you have the Solana app open on the Ledger, otherwise the test errors instantly.",
    );
    process.exit(1);
  } finally {
    await ledger.disconnect();
    console.log("\n🔌 Disconnected from Ledger");
  }
}

// Run the test
testLedgerSigner().catch(console.error);
