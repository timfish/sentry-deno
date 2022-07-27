import {
  Event,
  EventProcessor,
  Integration,
} from '../../sentry-javascript-deno/types/mod.ts';
import { dirname } from 'https://deno.land/std@0.148.0/path/mod.ts';
import {
  createStackParser,
  nodeStackLineParser,
} from '../../sentry-javascript-deno/utils/mod.ts';
import { getCurrentHub } from '../../sentry-javascript-deno/hub/hub.ts';
import { DenoClient } from '../client.ts';

function appRootFromErrorStack(error: Error): string | undefined {
  // We know at the other end of the stack from here is the entry point that called 'init'
  // We currently assume that this stacktrace will traverse the root of the app
  // 🤷‍♂️
  const frames = createStackParser(nodeStackLineParser())(error.stack || '');

  const paths = frames
    // We're only interested in frames that are in_app with filenames
    .filter((f) => f.in_app && f.filename)
    .map(
      (f) =>
        (f.filename as string)
          .replace(/^[A-Z]:/, '') // remove Windows-style prefix
          .replace(/\\/g, '/') // replace all `\` instances with `/`
          .split('/')
          .filter((seg) => seg !== ''), //remove empty segments
    ) as string[][];

  if (paths.length == 0) {
    return undefined;
  }

  if (paths.length == 1) {
    // Assume the single file is in the root
    return dirname(paths[0].join('/'));
  }

  // Iterate over the paths and bail out when they no longer have a common root
  let i = 0;
  while (paths[0][i] && paths.every((w) => w[i] === paths[0][i])) {
    i++;
  }

  return paths[0].slice(0, i).join('/');
}

async function getCwd(): Promise<string | undefined> {
  // We don't want to prompt for permissions so we only get the cwd if
  // permissions are already granted
  const permission = await Deno.permissions.query({ name: 'read', path: './' });

  try {
    if (permission.state == 'granted') {
      return Deno.cwd();
    }
  } catch (_) {
    //
  }
}

function appRootFromOptions(): string | undefined {
  return getCurrentHub().getClient<DenoClient>()?.getOptions().appRoot;
}

// Cached here
let appRoot: string | undefined;

async function getAppRoot(error: Error): Promise<string | undefined> {
  if (appRoot === undefined) {
    appRoot = appRootFromOptions() || (await getCwd()) ||
      appRootFromErrorStack(error);
  }

  return appRoot;
}

/** Normalises paths to the app root directory. */
export class NormalizePaths implements Integration {
  /** @inheritDoc */
  public static id = 'NormalizePaths';

  /** @inheritDoc */
  public name: string = NormalizePaths.id;

  /** @inheritDoc */
  public setupOnce(
    addGlobalEventProcessor: (callback: EventProcessor) => void,
  ): void {
    addGlobalEventProcessor(async (event: Event): Promise<Event | null> => {
      const error = new Error();
      const appRoot = await getAppRoot(error);

      if (appRoot) {
        for (const exception of event.exception?.values || []) {
          for (const frame of exception.stacktrace?.frames || []) {
            if (frame.filename && frame.in_app) {
              const startIndex = frame.filename.indexOf(appRoot);

              if (startIndex > -1) {
                const endIndex = startIndex + appRoot.length;
                frame.filename = 'app://' + frame.filename.substring(endIndex);
              }
            }
          }
        }
      }

      return event;
    });
  }
}
