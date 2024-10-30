# @sovereign-sdk/web3

[![npm version](https://img.shields.io/npm/v/@sovereign-sdk/web3.svg)](https://www.npmjs.com/package/@sovereign-sdk/web3)
[![CI](https://github.com/Sovereign-Labs/sovereign-sdk-web3-js/actions/workflows/ci.yaml/badge.svg)](https://github.com/Sovereign-Labs/sovereign-sdk-web3-js/actions/workflows/ci.yaml)

A TypeScript client library for interacting with Sovereign SDK rollups.

## Installation

```bash
npm install @sovereign-sdk/web3
```

## Features

- 🔄 Type-safe transaction submission and signing
- 🔍 Runtime call simulation for gas estimation
- 📦 Borsh serialization with schema validation
- 🎯 Strongly typed rollup interactions with customizable type specifications
- 🌐 Full access to ledger, sequencer, and rollup APIs

## Usage

### Basic Setup

```typescript
import { StandardRollup } from '@sovereign-sdk/web3';
import { newMetaMaskSnapSigner } from '@sovereign-sdk/signers';

// Initialize the rollup client
const rollup = new StandardRollup({
  url: 'https://your-rollup-node.com',
  schema: yourSchema,
  defaultTxDetails: {
    max_priority_fee_bips: 1000,
    max_fee: 1000000,
    chain_id: 1,
  },
});

// Initialize a signer
const signer = newMetaMaskSnapSigner({
  curve: 'ed25519',
  schema: yourSchema,
  snapId: 'npm:@sovereign-sdk/metamask-snap',
});
```

### Submitting Transactions

```typescript
// Submit a runtime call
const result = await rollup.call(
  {
    value_setter: {
      set_value: 100,
    },
  },
  { signer }
);
```

### Type Safety

```typescript
type MyRollupTypes = RollupTypeSpec<{
  RuntimeCall: {
    value_setter: {
      set_value: number;
    };
  };
  // Add other type specifications as needed
}>;

const typedRollup = new StandardRollup<MyRollupTypes>({
  // ... config
});

// Now your calls will be type-checked!
const result = await typedRollup.call(
  {
    value_setter: {
      set_value: 100, // Type checked and automatically serialized to Borsh bytes
    },
  },
  { signer }
);
```

### Simulation

```typescript
// Simulate a call to estimate gas
const simulation = await rollup.simulate(
  {
    value_setter: {
      set_value: 100,
    },
  },
  {
    signer,
    txDetails: {
      max_priority_fee_bips: 1000,
      max_fee: 1000000,
      chain_id: 1,
    },
  }
);
```

## API Reference

The package exports the following main components:

- `StandardRollup`: The main client class for interacting with rollups
- `RollupTypeSpec`: Type utility for creating type-safe rollup interactions
- `createSerializer`: Function to create a Borsh serializer for your rollup schema

For detailed API documentation, please refer to the inline TypeScript documentation in the source code.