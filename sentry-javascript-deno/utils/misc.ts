// deno-lint-ignore-file
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Event, Exception, Mechanism, StackFrame } from '../types/mod.ts';

import { getGlobalObject } from './global.ts';
import { addNonEnumerableProperty } from './object.ts';
import { snipLine } from './string.ts';

/**
 * Extended Window interface that allows for Crypto API usage in IE browsers
 */
interface MsCryptoWindow extends Window {
  msCrypto?: Crypto;
}

/** Many browser now support native uuid v4 generation */
interface CryptoWithRandomUUID extends Crypto {
}

/**
 * UUID4 generator
 *
 * @returns string Generated UUID4.
 */
export function uuid4(): string {
  const global = getGlobalObject() as MsCryptoWindow;
  const crypto =
    ((global as any).crypto || global.msCrypto) as CryptoWithRandomUUID;

  if (crypto && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }

  const getRandomByte = crypto && crypto.getRandomValues
    ? () => crypto.getRandomValues(new Uint8Array(1))[0]
    : () => Math.random() * 16;

  // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/2117523#2117523
  // Concatenating the following numbers as strings results in '10000000100040008000100000000000'
  return (([1e7] as unknown as string) + 1e3 + 4e3 + 8e3 + 1e11).replace(
    /[018]/g,
    (c) =>
      // eslint-disable-next-line no-bitwise
      ((c as unknown as number) ^
        ((getRandomByte() & 15) >> ((c as unknown as number) / 4))).toString(
          16,
        ),
  );
}

/**
 * Parses string form of URL into an object
 * // borrowed from https://tools.ietf.org/html/rfc3986#appendix-B
 * // intentionally using regex and not <a/> href parsing trick because React Native and other
 * // environments where DOM might not be available
 * @returns parsed URL object
 */
export function parseUrl(url: string): {
  host?: string;
  path?: string;
  protocol?: string;
  relative?: string;
} {
  if (!url) {
    return {};
  }

  const match = url.match(
    /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/,
  );

  if (!match) {
    return {};
  }

  // coerce to undefined values to empty string so we don't get 'undefined'
  const query = match[6] || '';
  const fragment = match[8] || '';
  return {
    host: match[4],
    path: match[5],
    protocol: match[2],
    relative: match[5] + query + fragment, // everything minus origin
  };
}

function getFirstException(event: Event): Exception | undefined {
  return event.exception && event.exception.values
    ? event.exception.values[0]
    : undefined;
}

/**
 * Extracts either message or type+value from an event that can be used for user-facing logs
 * @returns event's description
 */
export function getEventDescription(event: Event): string {
  const { message, event_id: eventId } = event;
  if (message) {
    return message;
  }

  const firstException = getFirstException(event);
  if (firstException) {
    if (firstException.type && firstException.value) {
      return `${firstException.type}: ${firstException.value}`;
    }
    return firstException.type || firstException.value || eventId ||
      '<unknown>';
  }
  return eventId || '<unknown>';
}

/**
 * Adds exception values, type and value to an synthetic Exception.
 * @param event The event to modify.
 * @param value Value of the exception.
 * @param type Type of the exception.
 * @hidden
 */
export function addExceptionTypeValue(
  event: Event,
  value?: string,
  type?: string,
): void {
  const exception = (event.exception = event.exception || {});
  const values = (exception.values = exception.values || []);
  const firstException = (values[0] = values[0] || {});
  if (!firstException.value) {
    firstException.value = value || '';
  }
  if (!firstException.type) {
    firstException.type = type || 'Error';
  }
}

/**
 * Adds exception mechanism data to a given event. Uses defaults if the second parameter is not passed.
 *
 * @param event The event to modify.
 * @param newMechanism Mechanism data to add to the event.
 * @hidden
 */
export function addExceptionMechanism(
  event: Event,
  newMechanism?: Partial<Mechanism>,
): void {
  const firstException = getFirstException(event);
  if (!firstException) {
    return;
  }

  const defaultMechanism = { type: 'generic', handled: true };
  const currentMechanism = firstException.mechanism;
  firstException.mechanism = {
    ...defaultMechanism,
    ...currentMechanism,
    ...newMechanism,
  };

  if (newMechanism && 'data' in newMechanism) {
    const mergedData = {
      ...(currentMechanism && currentMechanism.data),
      ...newMechanism.data,
    };
    firstException.mechanism.data = mergedData;
  }
}

// https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
const SEMVER_REGEXP =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Represents Semantic Versioning object
 */
interface SemVer {
  major?: number;
  minor?: number;
  patch?: number;
  prerelease?: string;
  buildmetadata?: string;
}

/**
 * Parses input into a SemVer interface
 * @param input string representation of a semver version
 */
export function parseSemver(input: string): SemVer {
  const match = input.match(SEMVER_REGEXP) || [];
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10);
  return {
    buildmetadata: match[5],
    major: isNaN(major) ? undefined : major,
    minor: isNaN(minor) ? undefined : minor,
    patch: isNaN(patch) ? undefined : patch,
    prerelease: match[4],
  };
}

/**
 * This function adds context (pre/post/line) lines to the provided frame
 *
 * @param lines string[] containing all lines
 * @param frame StackFrame that will be mutated
 * @param linesOfContext number of context lines we want to add pre/post
 */
export function addContextToFrame(
  lines: string[],
  frame: StackFrame,
  linesOfContext: number = 5,
): void {
  const lineno = frame.lineno || 0;
  const maxLines = lines.length;
  const sourceLine = Math.max(Math.min(maxLines, lineno - 1), 0);

  frame.pre_context = lines
    .slice(Math.max(0, sourceLine - linesOfContext), sourceLine)
    .map((line: string) => snipLine(line, 0));

  frame.context_line = snipLine(
    lines[Math.min(maxLines - 1, sourceLine)],
    frame.colno || 0,
  );

  frame.post_context = lines
    .slice(Math.min(sourceLine + 1, maxLines), sourceLine + 1 + linesOfContext)
    .map((line: string) => snipLine(line, 0));
}

/**
 * Strip the query string and fragment off of a given URL or path (if present)
 *
 * @param urlPath Full URL or path, including possible query string and/or fragment
 * @returns URL or path without query string or fragment
 */
export function stripUrlQueryAndFragment(urlPath: string): string {
  // eslint-disable-next-line no-useless-escape
  return urlPath.split(/[\?#]/, 1)[0];
}

/**
 * Checks whether or not we've already captured the given exception (note: not an identical exception - the very object
 * in question), and marks it captured if not.
 *
 * This is useful because it's possible for an error to get captured by more than one mechanism. After we intercept and
 * record an error, we rethrow it (assuming we've intercepted it before it's reached the top-level global handlers), so
 * that we don't interfere with whatever effects the error might have had were the SDK not there. At that point, because
 * the error has been rethrown, it's possible for it to bubble up to some other code we've instrumented. If it's not
 * caught after that, it will bubble all the way up to the global handlers (which of course we also instrument). This
 * function helps us ensure that even if we encounter the same error more than once, we only record it the first time we
 * see it.
 *
 * Note: It will ignore primitives (always return `false` and not mark them as seen), as properties can't be set on
 * them. {@link: Object.objectify} can be used on exceptions to convert any that are primitives into their equivalent
 * object wrapper forms so that this check will always work. However, because we need to flag the exact object which
 * will get rethrown, and because that rethrowing happens outside of the event processing pipeline, the objectification
 * must be done before the exception captured.
 *
 * @param A thrown exception to check or flag as having been seen
 * @returns `true` if the exception has already been captured, `false` if not (with the side effect of marking it seen)
 */
export function checkOrSetAlreadyCaught(exception: unknown): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (exception && (exception as any).__sentry_captured__) {
    return true;
  }

  try {
    // set it this way rather than by assignment so that it's not ennumerable and therefore isn't recorded by the
    // `ExtraErrorData` integration
    addNonEnumerableProperty(
      exception as { [key: string]: unknown },
      '__sentry_captured__',
      true,
    );
  } catch (err) {
    // `exception` is a primitive, so we can't mark it seen
  }

  return false;
}
