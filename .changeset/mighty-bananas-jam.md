---
"@sovereign-sdk/web3": patch
---

Add support for retrieving rollup schema from remote endpoint. Handle updating the schema if it changes internally and raise `VersionMismatch` errors if the schema has changed when submitting transactions to allow client code to handle this case.
