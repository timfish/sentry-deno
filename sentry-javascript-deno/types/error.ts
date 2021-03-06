// deno-lint-ignore-file
/**
 * Just an Error object with arbitrary attributes attached to it.
 */
export interface ExtendedError extends Error {
  [key: string]: any;
}
