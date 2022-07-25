// deno-lint-ignore-file 
/** An error emitted by Sentry SDKs and related utilities. */
export class SentryError extends Error {
  /** Display name of this error instance. */
  public name: string;

  public constructor(public message: string) {
    super(message);

    this.name = new.target.prototype.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
