import type {
  Transaction,
  TransactionV0,
  UnsignedTransaction,
} from "@sovereign-sdk/types";
import type { HexString } from "@sovereign-sdk/utils";

/**
 * Base error class for multisig-related errors.
 */
export class MultisigError extends Error {}

/**
 * Error thrown when a transaction has an unsupported version for multisig operations.
 */
export class InvalidTransactionVersionError extends MultisigError {}

/**
 * Error thrown when a provided transaction doesn't match the expected unsigned transaction.
 */
export class TransactionMismatchError extends Error {
  constructor() {
    super(
      "Provided transaction does not match the expected unsigned transaction"
    );
  }
}

/**
 * Error thrown when multisig is constructed or used with invalid parameters.
 */
export class InvalidMultisigParameterError extends MultisigError {
  constructor(desc: string) {
    super(`Multisig was constructed with invalid parameter: ${desc}`);
  }
}

/**
 * Parameters for constructing a MultisigTransaction.
 */
export type MultisigParams = {
  /** The unsigned transaction to be signed by multiple parties */
  unsignedTx: UnsignedTransaction<unknown>;
  /** Array of signatures already collected */
  signatures: HexString[];
  /** Array of public keys that haven't signed yet */
  unusedPubKeys: HexString[];
  /** Minimum number of signatures required */
  minSigners: number;
};

/**
 * Parameters for creating a MultisigTransaction from existing signed transactions.
 */
export type FromTransactionsParams = {
  /** Array of signed transactions to extract signatures from */
  txns: Transaction<unknown>[];
  /** Minimum number of signatures required */
  minSigners: number;
  /** All public keys that are members of the multisig */
  allPubKeys: HexString[];
};

/**
 * Represents a multisig transaction that collects signatures from multiple parties.
 * Only supports nonce-based transactions and V0 transaction variants for signature collection.
 */
export class MultisigTransaction {
  private unsignedTx: UnsignedTransaction<unknown>;
  private signatures = new Set<HexString>();
  private minSigners: number;
  private unusedPubKeys = new Set<HexString>();

  /**
   * Creates a new MultisigTransaction instance.
   * @param params - The multisig parameters including unsigned transaction, signatures, and public keys
   */
  constructor({
    unsignedTx,
    signatures,
    unusedPubKeys,
    minSigners,
  }: MultisigParams) {
    this.unsignedTx = unsignedTx;
    this.signatures = new Set(signatures);
    this.unusedPubKeys = new Set(unusedPubKeys);
    this.minSigners = minSigners;
  }

  /**
   * Creates a MultisigTransaction from an array of already-signed transactions.
   * Extracts signatures and validates that all transactions are identical except for signatures.
   * @param params - Parameters including the signed transactions, minimum signers, and all public keys
   * @returns A new MultisigTransaction instance
   * @throws {InvalidTransactionVersionError} If any transaction is not V0 variant
   * @throws {TransactionMismatchError} If transactions don't match each other
   * @throws {InvalidMultisigParameterError} If public keys are invalid or transaction is not nonce-based
   */
  static fromTransactions({
    txns,
    minSigners,
    ...params
  }: FromTransactionsParams): MultisigTransaction {
    const signatures = new Set<HexString>();
    const unsignedTx = asUnsignedTransaction(txns[0]);
    const unusedPubKeys = new Set<HexString>(params.allPubKeys);

    assertIsNonceBasedTx(unsignedTx);

    for (const tx of txns) {
      assertTxVariant(tx);
      assertTxMatchesUnsignedTx(tx, unsignedTx);

      if (!unusedPubKeys.delete(tx.V0.pub_key)) {
        throw new InvalidMultisigParameterError(
          `Public key is not a member of the multisig or has already signed: ${tx.V0.pub_key}`
        );
      }

      signatures.add(tx.V0.signature);
    }

    return new MultisigTransaction({
      unsignedTx,
      signatures: Array.from(signatures),
      unusedPubKeys: Array.from(unusedPubKeys),
      minSigners,
    });
  }

  /**
   * Adds a signature to the multisig transaction.
   * @param signature - The signature to add
   * @param pubKey - The public key corresponding to the signature
   * @throws {InvalidMultisigParameterError} If the public key is not a member or has already signed
   */
  addSignature(signature: HexString, pubKey: HexString): void {
    if (!this.unusedPubKeys.delete(pubKey)) {
      throw new InvalidMultisigParameterError(
        `Public key is not a member of the multisig or has already signed: ${pubKey}`
      );
    }

    this.signatures.add(signature);
  }

  /**
   * Checks if the multisig has collected enough signatures to be complete.
   * @returns True if the number of signatures meets or exceeds the minimum required
   */
  get isComplete(): boolean {
    return this.signatures.size >= this.minSigners;
  }

  /**
   * Gets the unsigned transaction.
   * @returns A readonly view of the unsigned transaction
   */
  get unsignedTransaction(): Readonly<UnsignedTransaction<unknown>> {
    return this.unsignedTx;
  }

  /**
   * Converts the multisig to a V1 transaction that can be submitted to the network.
   * @returns A V1 transaction containing all collected signatures and unused public keys
   */
  asTransaction(): Transaction<unknown> {
    return {
      V1: {
        runtime_call: this.unsignedTx.runtime_call,
        uniqueness: this.unsignedTx.uniqueness,
        details: this.unsignedTx.details,
        unused_pub_keys: Array.from(this.unusedPubKeys),
        signatures: Array.from(this.signatures),
        min_signers: this.minSigners,
      },
    };
  }
}

function assertTxVariant(
  tx: Transaction<unknown>
): asserts tx is TransactionV0<unknown> {
  if ("V1" in tx) {
    throw new InvalidTransactionVersionError(
      "Input transaction was an unsupported variant (V1)"
    );
  }
}

function asUnsignedTransaction(
  tx: Transaction<unknown>
): UnsignedTransaction<unknown> {
  if ("V0" in tx) {
    return {
      runtime_call: tx.V0.runtime_call,
      uniqueness: tx.V0.uniqueness,
      details: tx.V0.details,
    };
  }

  if ("V1" in tx) {
    return {
      runtime_call: tx.V1.runtime_call,
      uniqueness: tx.V1.uniqueness,
      details: tx.V1.details,
    };
  }

  throw new InvalidTransactionVersionError(
    "Transaction variant is neither V0 nor V1"
  );
}

function assertTxMatchesUnsignedTx(
  tx: Transaction<unknown>,
  unsignedTx: UnsignedTransaction<unknown>
): void {
  const txAsUnsigned = asUnsignedTransaction(tx);

  if (JSON.stringify(txAsUnsigned) !== JSON.stringify(unsignedTx)) {
    throw new TransactionMismatchError();
  }
}

function assertIsNonceBasedTx(unsignedTx: UnsignedTransaction<unknown>): void {
  if (!("nonce" in unsignedTx.uniqueness)) {
    throw new InvalidMultisigParameterError(
      "Only nonce-based transactions are supported for multisig"
    );
  }
}
