---
"@sovereign-sdk/web3": minor
---

Removes a signer.publicKey call when constructing an unsigned transaction. This was previously used because we needed the pubkey to get the users nonce, now we use a timestamp generation its not needed - some wallets like privy dont expose the users public key upfront so this also avoids the problem of not having access to the users public key at this point in time
