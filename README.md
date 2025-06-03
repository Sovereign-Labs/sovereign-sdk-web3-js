# Sovereign SDK Web3.js

[![CI](https://github.com/Sovereign-Labs/sovereign-sdk-web3-js/actions/workflows/ci.yaml/badge.svg)](https://github.com/Sovereign-Labs/sovereign-sdk-web3-js/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/Sovereign-Labs/sovereign-sdk-web3-js/branch/master/graph/badge.svg?token=s8yNoGfFGE)](https://codecov.io/gh/Sovereign-Labs/sovereign-sdk-web3-js)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg)](https://pnpm.io/)

JavaScript/TypeScript SDK for interacting with Sovereign SDK rollups. This monorepo contains packages that provide type-safe transaction submission, signing capabilities, and rollup type serialization/deserialization.

| Package                                                                | Version                                                                                                                                                     | Description                                                                                   |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [@sovereign-sdk/web3](packages/web3)                                   | [![npm version](https://img.shields.io/npm/v/@sovereign-sdk/web3.svg)](https://www.npmjs.com/package/@sovereign-sdk/web3)                                   | Primary client library for interacting with Sovereign SDK rollups                             |
| [@sovereign-sdk/signers](packages/signers)                             | [![npm version](https://img.shields.io/npm/v/@sovereign-sdk/signers.svg)](https://www.npmjs.com/package/@sovereign-sdk/signers)                             | Signer interface and implementations (e.g. MetaMask Snap)                                     |
| [@sovereign-sdk/universal-wallet-wasm](packages/universal-wallet-wasm) | [![npm version](https://img.shields.io/npm/v/@sovereign-sdk/universal-wallet-wasm.svg)](https://www.npmjs.com/package/@sovereign-sdk/universal-wallet-wasm) | WebAssembly bindings for human readable byte representation and serialization/deserialization |
| [@sovereign-sdk/test](packages/test)                                   | [![npm version](https://img.shields.io/npm/v/@sovereign-sdk/test.svg)](https://www.npmjs.com/package/@sovereign-sdk/test)                                   | Testing utilities for Sovereign SDK rollups, including soak testing and transaction generation |
| [@sovereign-sdk/utils](packages/utils)                                 | [![npm version](https://img.shields.io/npm/v/@sovereign-sdk/utils.svg)](https://www.npmjs.com/package/@sovereign-sdk/utils)                                 | Common utilities and helper functions for Sovereign SDK development                            |

## Features

- 🔄 Type-safe transaction submission and signing
- 🔍 Runtime call simulation for gas estimation
- 📦 Borsh serialization & human readable byte representation
- 🎯 Strongly typed rollup interactions
- 🌐 Full access to ledger, sequencer, and rollup APIs

## Quick Start

A quick example of submitting a transaction to a Sovereign SDK rollup using Sovereign's [universal MetaMask Snap](https://github.com/Sovereign-Labs/sovereign-universal-snap) as the wallet/signer.

```bash
# Install the main web3 package
npm install @sovereign-sdk/web3

# For MetaMask Snap support
npm install @sovereign-sdk/signers
```

Usage:

```typescript
import { StandardRollup } from "@sovereign-sdk/web3";
import { newMetaMaskSnapSigner } from "@sovereign-sdk/signers";

// Initialize the rollup client
const rollup = new StandardRollup({
  url: "https://your-rollup-node.com",
  defaultTxDetails: {
    max_priority_fee_bips: 0,
    max_fee: 1000000,
    gas_limit: null,
    chain_id: 4321,
  },
});
const signer = newMetaMaskSnapSigner({
  curve: "ed25519",
  schema: yourSchema,
});

// Submit a transaction
// Sends a `ValueSetter` call message of `SetValue` type.
// This particular call message has `value` and `gas` fields.
const result = await rollup.call(
  {
    value_setter: {
      set_value: {
        value: 100,
        gas: null,
      },
    },
  },
  { signer }
);
```

## Development

This project uses [pnpm](https://pnpm.io/) for package management and [Changesets](https://github.com/changesets/changesets) for versioning.

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Format and lint
pnpm run fix
```

For detailed development instructions, see [DEVELOPMENT.md](./DEVELOPMENT.md).

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Security

For security concerns, please open an issue or contact us directly. We take security issues seriously and will respond promptly.
