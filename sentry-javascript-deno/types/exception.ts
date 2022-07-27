// deno-lint-ignore-file
import { Mechanism } from './mechanism.ts';
import { Stacktrace } from './stacktrace.ts';

/** JSDoc */
export interface Exception {
  type?: string;
  value?: string;
  mechanism?: Mechanism;
  module?: string;
  thread_id?: number;
  stacktrace?: Stacktrace;
}
