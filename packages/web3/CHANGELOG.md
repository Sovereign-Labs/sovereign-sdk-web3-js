# @sovereign-sdk/web3

## 0.0.21

### Patch Changes

- Updated dependencies [aad0d22]
  - @sovereign-sdk/universal-wallet-wasm@0.1.8

## 0.0.20

### Patch Changes

- dd2e021: Bump `@sovereign-sdk/client` package version to latest
- 39ba5ee: Add support for retrieving rollup schema from remote endpoint. Handle updating the schema if it changes internally and raise `VersionMismatch` errors if the schema has changed when submitting transactions to allow client code to handle this case.

## 0.0.19

### Patch Changes

- Updated dependencies [54f3ea2]
  - @sovereign-sdk/universal-wallet-wasm@0.1.7

## 0.0.18

### Patch Changes

- 9684f2b: Remove chain hash appending, signers should do this

## 0.0.17

### Patch Changes

- 2f03f4b: Sign over chain hash as well, update standard rollup types

## 0.0.16

### Patch Changes

- 761baf0: Update to latest universal wallet version. Includes improvements to `Result<T>` types & runtime call objects in transaction types
- Updated dependencies [761baf0]
  - @sovereign-sdk/universal-wallet-wasm@0.1.6

## 0.0.15

### Patch Changes

- 684614c: Remove submitBatch method on main rollup class, this endpoint is not intended for normal use (mainly tests and debugging)

## 0.0.14

### Patch Changes

- d2f80b3: Introduce utils package, move hex utils there
- f2eb8d3: Improve dedup situation, refactor rollup to better support rollup genericness
- Updated dependencies [d2f80b3]
- Updated dependencies [14ecb93]
  - @sovereign-sdk/signers@0.0.3
  - @sovereign-sdk/utils@0.0.2
  - @sovereign-sdk/universal-wallet-wasm@0.1.5

## 0.0.13

### Patch Changes

- 2463958: Expose the schema descriptor json & re-export Schema class from web3 sdk
- Updated dependencies [2463958]
  - @sovereign-sdk/universal-wallet-wasm@0.1.4

## 0.0.12

### Patch Changes

- 0b1396a: Re-add base http client as an escape hatch so arbitrary http requests can be made

## 0.0.11

### Patch Changes

- 812aec0: Add TypeSpec concept to allow for strong types to be propogated throughout the rollup class

## 0.0.10

### Patch Changes

- Updated dependencies [6a7080b]
  - @sovereign-sdk/universal-wallet-wasm@0.1.3

## 0.0.9

### Patch Changes

- adfe936: Add @sovereign-sdk/signers package, migrate web3 package to use it
- Updated dependencies [adfe936]
  - @sovereign-sdk/signers@0.0.2

## 0.0.8

### Patch Changes

- 24af326: Return transaction that was submitted when executing a `call`

## 0.0.7

### Patch Changes

- 5bdfddf: Add `simulate` method to rollup class to allow for simulating transaction execution

## 0.0.6

### Patch Changes

- 9a0708e: bump js rest client version

## 0.0.5

### Patch Changes

- d7cfa52: bump universal-wallet rust version to fix serialization bug with `Option<T>`
- Updated dependencies [d7cfa52]
  - @sovereign-sdk/universal-wallet-wasm@0.1.2

## 0.0.4

### Patch Changes

- dad7add: various small fixes to types & serialization

## 0.0.3

### Patch Changes

- 5f31220: use workspace universal wallet dependency

## 0.0.2

### Patch Changes

- 7bc2d72: setup build process for `@sovereign-sdk/web3` package
- Updated dependencies [7bc2d72]
  - @sovereign-sdk/universal-wallet-wasm@0.1.1
