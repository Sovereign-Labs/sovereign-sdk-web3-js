export class SignerError extends Error {
  public readonly signerId: string;

  constructor(message: string, signerId: string) {
    super(message);

    this.signerId = signerId;
    this.name = this.constructor.name;
    this.stack = new Error().stack;
  }
}
