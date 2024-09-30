export class SovereignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;

    // `Error.captureStackTrace` is v8 specific API,
    // add fallback for compatibility in other envs
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error().stack;
    }
  }
}

export class SovereignSerializeError extends SovereignError {
  constructor(
    readonly targetType: string,
    message?: string,
  ) {
    super(message ?? `Failed to serialize target of type "${targetType}"`);
  }
}
