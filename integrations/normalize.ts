import { Event, EventProcessor, Integration } from "../deps.ts";
import { dirname } from "https://deno.land/std@0.148.0/path/mod.ts";

function guessAppRoot(): string {
  // assume the mainModule is in the app root
  return dirname(Deno.mainModule).replace("file://", "");
}

async function getCwd(): Promise<string | undefined> {
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
    addGlobalEventProcessor(async (event: Event): Promise<Event | null> => {
      const appRoot = (await getCwd()) || guessAppRoot();

      for (const exception of event.exception?.values || []) {
        for (const frame of exception.stacktrace?.frames || []) {
          if (frame.filename && frame.in_app) {
            frame.filename = frame.filename.replace(appRoot, "app://");
          }
        }
      }

      return event;
    });
  }
}
