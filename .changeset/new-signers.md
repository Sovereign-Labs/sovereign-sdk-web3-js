---
"@sovereign-sdk/signers": minor
---

feat: add Ed25519, Secp256k1, and Privy signers

- Added Ed25519Signer with ed25519 curve support for signing operations
- Added Secp256k1Signer with secp256k1 curve support and Ethereum address generation
- Added PrivySigner for integration with Privy wallets via EIP-1193 provider interface
- All signers implement the common Signer interface with chain hash domain separation
- Includes comprehensive test coverage for all new signers
EOF < /dev/null