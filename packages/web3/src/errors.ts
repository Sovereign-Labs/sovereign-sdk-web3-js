/**
 * Base error class for Sovereign SDK Web3.
 */
export class SovereignError extends Error {
  constructor(message: string) {
    super(message);

    this.name = this.constructor.name;
    this.stack = new Error().stack;
  }
}
