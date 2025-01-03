---
"@sovereign-sdk/universal-wallet-wasm": patch
---

Fix hardcoded cjs export in nodejs runtimes. This was causing the cjs entry point to be loaded even if the nodejs env was using a bundler/esm like in the case of nextjs
