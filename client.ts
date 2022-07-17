import {
  BaseClient,
  JS_SDK_VERSION,
  Event,
  EventHint,
  Severity,
  SeverityLevel,
  ClientOptions,
  dsnFromString,
  logger,
  RealScope,
} from "./deps.ts";

import { eventFromMessage, eventFromUnknownInput } from "./eventbuilder.ts";
import { DenoTransportOptions } from "./transport.ts";

const SDK_VERSION = "0.1.0";

// deno-lint-ignore no-empty-interface
export interface DenoClientOptions
  extends ClientOptions<DenoTransportOptions> {}

export class DenoClient extends BaseClient<DenoClientOptions> {
  constructor(options: DenoClientOptions) {
    options._metadata = options._metadata || {};
    options._metadata.sdk = options._metadata.sdk || {
      name: "sentry.javascript.deno",
      version: SDK_VERSION,
      packages: [
        {
          name: "npm:@sentry/core",
          version: JS_SDK_VERSION,
        },
      ],
    };

    super(options);
  }

  public eventFromException(
    // deno-lint-ignore no-explicit-any
    exception: any,
    hint?: EventHint | undefined
  ): Promise<Event> {
    return Promise.resolve(
      eventFromUnknownInput(this._options.stackParser, exception, hint)
    );
  }

  public eventFromMessage(
    message: string,
    level?: Severity | SeverityLevel | undefined,
    hint?: EventHint | undefined
  ): PromiseLike<Event> {
    return Promise.resolve(
      eventFromMessage(
        this._options.stackParser,
        message,
        level,
        hint,
        this._options.attachStacktrace
      )
    );
  }

  protected async _prepareEvent(
    event: Event,
    hint: EventHint,
    scope?: RealScope | undefined
  ): Promise<Event | null> {
    if (this._options.dsn) {
      // Check if we have permissions to send this event
      const dsn = dsnFromString(this._options.dsn);
      const permission = await Deno.permissions.query({
        name: "net",
        host: dsn.host,
      });

      if (permission.state !== "granted") {
        logger.warn(
          "Event was not sent due to missing permissions. Run Deno with --allow-net to allow sending of events."
        );

        return null;
      }
    }

    return await super._prepareEvent(event, hint, scope);
  }

  public flush(timeout?: number): PromiseLike<boolean> {
    const transport = this._transport;
    if (transport) {
      return this._isClientDoneProcessing(timeout).then((clientFinished) => {
        return transport
          .flush(timeout)
          .then((transportFlushed) => clientFinished && transportFlushed);
      });
    } else {
      return Promise.resolve(true);
    }
  }
}
