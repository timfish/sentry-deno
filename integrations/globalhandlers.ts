import {
  addExceptionMechanism,
  Event,
  EventHint,
  getCurrentHub,
  getLocationHref,
  Hub,
  Integration,
  isString,
  StackParser,
} from "../deps.ts";

import { DenoClient } from "../client.ts";
import { eventFromUnknownInput } from "../eventbuilder.ts";
import { flush } from "../index.ts";

type GlobalHandlersIntegrationsOptionKeys = "error"; // | "onunhandledrejection";

/** JSDoc */
type GlobalHandlersIntegrations = Record<
  GlobalHandlersIntegrationsOptionKeys,
  boolean
>;

/** Global handlers */
export class GlobalHandlers implements Integration {
  /**
   * @inheritDoc
   */
  public static id = "GlobalHandlers";

  /**
   * @inheritDoc
   */
  public name: string = GlobalHandlers.id;

  /** JSDoc */
  private readonly _options: GlobalHandlersIntegrations;

  /**
   * Stores references functions to installing handlers. Will set to undefined
   * after they have been run so that they are not used twice.
   */
  private _installFunc: Record<
    GlobalHandlersIntegrationsOptionKeys,
    (() => void) | undefined
  > = {
    error: _installGlobalErrorHandler,
    // onunhandledrejection: _installGlobalOnUnhandledRejectionHandler,
  };

  /** JSDoc */
  public constructor(options?: GlobalHandlersIntegrations) {
    this._options = {
      error: true,
      //   onunhandledrejection: true,
      ...options,
    };
  }
  /**
   * @inheritDoc
   */
  public setupOnce(): void {
    const options = this._options;

    // We can disable guard-for-in as we construct the options object above + do checks against
    // `this._installFunc` for the property.
    // eslint-disable-next-line guard-for-in
    for (const key in options) {
      const installFunc =
        this._installFunc[key as GlobalHandlersIntegrationsOptionKeys];
      if (installFunc && options[key as GlobalHandlersIntegrationsOptionKeys]) {
        installFunc();
        this._installFunc[key as GlobalHandlersIntegrationsOptionKeys] =
          undefined;
      }
    }
  }
}

function _installGlobalErrorHandler(): void {
  addEventListener("error", (data) => {
    const [hub, stackParser] = getHubAndOptions();
    const { message, filename, lineno, colno, error } = data;

    const event = _enhanceEventWithInitialFrame(
      eventFromUnknownInput(stackParser, error || message),
      filename,
      lineno,
      colno,
    );

    event.level = "error";

    addMechanismAndCapture(hub, error, event, "error");

    // Stop the app from exiting for now
    data.preventDefault();

    flush().then(() => {
      console.error(data.error);
      Deno.exit(-1);
    });
  });
}

function _enhanceEventWithInitialFrame(
  event: Event,
  // deno-lint-ignore no-explicit-any
  url: any,
  // deno-lint-ignore no-explicit-any
  line: any,
  // deno-lint-ignore no-explicit-any
  column: any,
): Event {
  // event.exception
  const e = (event.exception = event.exception || {});
  // event.exception.values
  const ev = (e.values = e.values || []);
  // event.exception.values[0]
  const ev0 = (ev[0] = ev[0] || {});
  // event.exception.values[0].stacktrace
  const ev0s = (ev0.stacktrace = ev0.stacktrace || {});
  // event.exception.values[0].stacktrace.frames
  const ev0sf = (ev0s.frames = ev0s.frames || []);

  const colno = isNaN(parseInt(column, 10)) ? undefined : column;
  const lineno = isNaN(parseInt(line, 10)) ? undefined : line;
  const filename = isString(url) && url.length > 0 ? url : getLocationHref();

  // event.exception.values[0].stacktrace.frames
  if (ev0sf.length === 0) {
    ev0sf.push({
      colno,
      filename,
      function: "?",
      in_app: true,
      lineno,
    });
  }

  return event;
}

function addMechanismAndCapture(
  hub: Hub,
  error: EventHint["originalException"],
  event: Event,
  type: string,
): void {
  addExceptionMechanism(event, {
    handled: false,
    type,
  });
  hub.captureEvent(event, {
    originalException: error,
  });
}

function getHubAndOptions(): [Hub, StackParser] {
  const hub = getCurrentHub();
  const client = hub.getClient<DenoClient>();
  const options = (client && client.getOptions()) || {
    stackParser: () => [],
    attachStacktrace: false,
  };
  return [hub, options.stackParser];
}
