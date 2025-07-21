---
"@sovereign-sdk/signers": minor
"@sovereign-sdk/web3": minor
---

Remove `chainHash` parameter from signers, the chain hash is now automatically included by the rollup client. To upgrade to this version simply remove the parameter when creating your signer
