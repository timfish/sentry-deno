import {
  Event,
  EventProcessor,
  Integration,
  createStackParser,
  nodeStackLineParser,
} from "../deps.ts";
import { dirname } from "https://deno.land/std@0.148.0/path/mod.ts";

function guessAppRoot(): string | undefined {
  // Create an error and parse the stacktrace
  // We know at the other end of the stack from here is the entry point that called 'init'
  // We currently assume that this stacktrace will traverse the root of the app 🤔
  const frames = createStackParser(nodeStackLineParser())(
    new Error().stack || ""
  );

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

  // Iterate over the paths and find the common root
  let i = 0;
  while (paths[0][i] && paths.every((w) => w[i] === paths[0][i])) {
    i++;
  }

  return paths[0].substr(0, i);
}

/** Adds Electron context to events and normalises paths. */
export class NormalizePaths implements Integration {
  /** @inheritDoc */
  public static id = "NormalizePaths";

  /** @inheritDoc */
  public name: string = NormalizePaths.id;

  /** @inheritDoc */
  public setupOnce(
    addGlobalEventProcessor: (callback: EventProcessor) => void
  ): void {
    const appRoot = guessAppRoot();

    if (!appRoot) {
      return;
    }

    addGlobalEventProcessor((event: Event) => {
      for (const exception of event.exception?.values || []) {
        for (const frame of exception.stacktrace?.frames || []) {
          if (frame.filename && frame.in_app) {
            frame.filename = frame.filename.replace(appRoot, "app:///");
          }
        }
      }

      return event;
    });
  }
}