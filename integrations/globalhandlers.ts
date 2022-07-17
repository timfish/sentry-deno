/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { getCurrentHub } from "https://esm.sh/@sentry/core@7.7.0";
import {
  Event,
  EventHint,
  Hub,
  Integration,
  StackParser,
} from "https://esm.sh/@sentry/types@7.7.0";
import {
  addExceptionMechanism,
  getLocationHref,
  isErrorEvent,
  isString,
} from "https://esm.sh/@sentry/utils@7.7.0";

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
    data.preventDefault();

    const [hub, stackParser] = getHubAndOptions();
    if (!hub.getIntegration(GlobalHandlers)) {
      return;
    }

    const { message, filename, lineno, colno, error } = data;

    const event =
      error === undefined && isString(message)
        ? _eventFromIncompleteOnError(message, filename, lineno, colno)
        : _enhanceEventWithInitialFrame(
            eventFromUnknownInput(stackParser, error || message, undefined),
            filename,
            lineno,
            colno
          );

    event.level = "error";

    addMechanismAndCapture(hub, error, event, "error");

    flush().then(() => {
      console.error(data.error);
      Deno.exit(-1);
    });
  });
}

/**
 * This function creates a stack from an old, error-less onerror handler.
 */
function _eventFromIncompleteOnError(
  // deno-lint-ignore no-explicit-any
  msg: any,
  // deno-lint-ignore no-explicit-any
  url: any,
  // deno-lint-ignore no-explicit-any
  line: any,
  // deno-lint-ignore no-explicit-any
  column: any
): Event {
  const ERROR_TYPES_RE =
    /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/i;

  // If 'message' is ErrorEvent, get real message from inside
  let message = isErrorEvent(msg) ? msg.message : msg;
  let name = "Error";

  const groups = message.match(ERROR_TYPES_RE);
  if (groups) {
    name = groups[1];
    message = groups[2];
  }

  const event = {
    exception: {
      values: [
        {
          type: name,
          value: message,
        },
      ],
    },
  };

  return _enhanceEventWithInitialFrame(event, url, line, column);
}

function _enhanceEventWithInitialFrame(
  event: Event,
  // deno-lint-ignore no-explicit-any
  url: any,
  // deno-lint-ignore no-explicit-any
  line: any,
  // deno-lint-ignore no-explicit-any
  column: any
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
  type: string
): void {
  addExceptionMechanism(event, {
    handled: false,
    type,
  });
  hub.captureEvent(event, {
    originalException: error,
  });
}

function getHubAndOptions(): [Hub, StackParser, boolean | undefined] {
  const hub = getCurrentHub();
  const client = hub.getClient<DenoClient>();
  const options = (client && client.getOptions()) || {
    stackParser: () => [],
    attachStacktrace: false,
  };
  return [hub, options.stackParser, options.attachStacktrace];
}
