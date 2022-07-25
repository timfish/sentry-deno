// deno-lint-ignore-file 
import { Stacktrace } from './stacktrace.ts';

/** JSDoc */
export interface Thread {
  id?: number;
  name?: string;
  stacktrace?: Stacktrace;
  crashed?: boolean;
  current?: boolean;
}
