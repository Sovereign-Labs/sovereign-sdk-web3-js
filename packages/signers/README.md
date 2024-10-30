# @sovereign-sdk/signers

[![npm version](https://img.shields.io/npm/v/@sovereign-sdk/signers.svg)](https://www.npmjs.com/package/@sovereign-sdk/signers)
[![License](https://img.shields.io/npm/l/@sovereign-sdk/signers.svg)](https://github.com/Sovereign-Labs/sovereign-sdk-web3-js/blob/master/LICENSE)
[![CI](https://github.com/Sovereign-Labs/sovereign-sdk-web3-js/actions/workflows/ci.yaml/badge.svg)](https://github.com/Sovereign-Labs/sovereign-sdk-web3-js/actions/workflows/ci.yaml)

A signer interface and implementations for use with Sovereign SDK applications.

## Installation

```
npm install @sovereign-sdk/signers
```

## Features

- 🔐 Abstract `Signer` interface that can be implemented to provide custom signers for use in `@sovereign-sdk/web3`.
- 🦊 MetaMask Snap signer implementation for use with [Sovereign's Universal MetaMask Snap](https://github.com/Sovereign-Labs/sovereign-universal-snap)


## Usage

### MetaMask Snap Signer


```typescript
import { newMetaMaskSnapSigner } from '@sovereign-sdk/signers';

// Initialize the signer
const signer = newMetaMaskSnapSigner({
  curve: 'ed25519', // or 'secp256k1'
  schema: {
    // Your rollup schema
  },
  snapId: 'npm:@sovereign-sdk/metamask-snap', // Metamask snap origin, can be changed to `local:localhost:8080` for local development
});

// Get public key
const publicKey = await signer.publicKey();

// Sign a message
const message = new Uint8Array([/* your message */]);
const signature = await signer.sign(message);
```

### Customer Signer Implementation

You can implement your own signer by implementing the `Signer` interface if your wallet is not currently supported.

```typescript
import { Signer } from '@sovereign-sdk/signers';

class MySigner implements Signer {
  publicKey() {
    // retireve the public key from your wallet
    return new Uint8Array([/* your public key */]);
  }

  async sign(message: Uint8Array) {
    // sign the message
    return new Uint8Array([/* your signature */]);
  }
}
```
