import { getCurrentHub } from '../sentry-javascript-deno/core/mod.ts';
import {
  Event,
  EventHint,
  Exception,
  Mechanism,
  Scope,
  Severity,
  SeverityLevel,
  StackFrame,
  StackParser,
} from '../sentry-javascript-deno/types/mod.ts';
import {
  addExceptionMechanism,
  addExceptionTypeValue,
  extractExceptionKeysForMessage,
  isError,
  isPlainObject,
  normalizeToSize,
} from '../sentry-javascript-deno/utils/mod.ts';

/**
 * Extracts stack frames from the error.stack string
 */
export function parseStackFrames(
  stackParser: StackParser,
  error: Error,
): StackFrame[] {
  return stackParser(error.stack || '', 1);
}

/**
 * Extracts stack frames from the error and builds a Sentry Exception
 */
export function exceptionFromError(
  stackParser: StackParser,
  error: Error,
): Exception {
  const exception: Exception = {
    type: error.name || error.constructor.name,
    value: error.message,
  };

  const frames = parseStackFrames(stackParser, error);
  if (frames.length) {
    exception.stacktrace = { frames };
  }

  return exception;
}

/**
 * Builds and Event from a Exception
 * @hidden
 */
export function eventFromUnknownInput(
  stackParser: StackParser,
  exception: unknown,
  hint?: EventHint,
): Event {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ex: unknown = exception;
  const providedMechanism: Mechanism | undefined = hint && hint.data &&
    (hint.data as { mechanism: Mechanism }).mechanism;
  const mechanism: Mechanism = providedMechanism || {
    handled: true,
    type: 'generic',
  };

  if (!isError(exception)) {
    if (isPlainObject(exception)) {
      // This will allow us to group events based on top-level keys
      // which is much better than creating new group when any key/value change
      const message = `Non-Error exception captured with keys: ${
        extractExceptionKeysForMessage(
          exception,
        )
      }`;

      getCurrentHub().configureScope((scope: Scope) => {
        scope.setExtra('__serialized__', normalizeToSize(exception));
      });

      ex = (hint && hint.syntheticException) || new Error(message);
      (ex as Error).message = message;
    } else {
      // This handles when someone does: `throw "something awesome";`
      // We use synthesized Error here so we can extract a (rough) stack trace.
      ex = (hint && hint.syntheticException) || new Error(exception as string);
      (ex as Error).message = exception as string;
    }
    mechanism.synthetic = true;
  }

  const event = {
    exception: {
      values: [exceptionFromError(stackParser, ex as Error)],
    },
  };

  addExceptionTypeValue(event, undefined, undefined);
  addExceptionMechanism(event, mechanism);

  return {
    ...event,
    event_id: hint && hint.event_id,
  };
}

/**
 * Builds and Event from a Message
 * @hidden
 */
export function eventFromMessage(
  stackParser: StackParser,
  message: string,
  level: Severity | SeverityLevel = 'info',
  hint?: EventHint,
  attachStacktrace?: boolean,
): Event {
  const event: Event = {
    event_id: hint && hint.event_id,
    level,
    message,
  };

  if (attachStacktrace && hint && hint.syntheticException) {
    const frames = parseStackFrames(stackParser, hint.syntheticException);
    if (frames.length) {
      event.exception = {
        values: [
          {
            value: message,
            stacktrace: { frames },
          },
        ],
      };
    }
  }

  return event;
}
