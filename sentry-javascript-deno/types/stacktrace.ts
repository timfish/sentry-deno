// deno-lint-ignore-file
import { StackFrame } from './stackframe.ts';

/** JSDoc */
export interface Stacktrace {
  frames?: StackFrame[];
  frames_omitted?: [number, number];
}

export type StackParser = (stack: string, skipFirst?: number) => StackFrame[];
export type StackLineParserFn = (line: string) => StackFrame | undefined;
export type StackLineParser = [number, StackLineParserFn];
