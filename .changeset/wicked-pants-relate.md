---
"@sovereign-sdk/integration-tests": patch
"@sovereign-sdk/web3": patch
---

Remove submitBatch method on main rollup class, this endpoint is not intended for normal use (mainly tests and debugging)
