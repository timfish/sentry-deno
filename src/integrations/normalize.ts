import {
  Event,
  EventProcessor,
  Integration,
} from "../../sentry-javascript-deno/types/mod.ts";
import { dirname } from "https://deno.land/std@0.148.0/path/mod.ts";
import {
  createStackParser,
  nodeStackLineParser,
} from "../../sentry-javascript-deno/utils/mod.ts";

function guessAppRoot(): string | undefined {
  // Create an error and parse the stacktrace
  // We know at the other end of the stack from here is the entry point that called 'init'
  // We currently assume that this stacktrace will traverse the root of the app
  // 🤷‍♂️
  const frames = createStackParser(nodeStackLineParser())(
    new Error().stack || "",
  );

  // We're only interested in frames in_app with filenames
  const paths = frames
    .filter((f) => f.in_app && f.filename)
    .map((f) => f.filename) as string[];

  if (paths.length == 0) {
    return undefined;
  }

  if (paths.length == 1) {
    // Assume the single file is in the root
    return dirname(paths[0]);
  }

  // Iterate over the paths and bail out when they no longer have a common root
  let i = 0;
  while (paths[0][i] && paths.every((w) => w[i] === paths[0][i])) {
    i++;
  }

  return paths[0].substr(0, i);
}

async function getCwd(): Promise<string | undefined> {
  // We don't want to prompt for permissions so we only get the cwd if
  // permissions are already granted
  const permission = await Deno.permissions.query({ name: "read", path: "./" });

  try {
    if (permission.state == "granted") {
      return Deno.cwd();
    }
  } catch (_) {
    //
  }
}

/** Adds Electron context to events and normalises paths. */
export class NormalizePaths implements Integration {
  /** @inheritDoc */
  public static id = "NormalizePaths";

  /** @inheritDoc */
  public name: string = NormalizePaths.id;

  /** @inheritDoc */
  public setupOnce(
    addGlobalEventProcessor: (callback: EventProcessor) => void,
  ): void {
    // This cannot be async so we leave the promise to be awaited later
    const appRoot = getCwd().then((cwd) => cwd || guessAppRoot());

    addGlobalEventProcessor(async (event: Event): Promise<Event | null> => {
      const root = await appRoot;

      if (root) {
        for (const exception of event.exception?.values || []) {
          for (const frame of exception.stacktrace?.frames || []) {
            if (frame.filename && frame.in_app) {
              frame.filename = frame.filename.replace(root, "app://");
            }
          }
        }
      }

      return event;
    });
  }
}
