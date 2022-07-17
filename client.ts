import { BaseClient } from "https://esm.sh/@sentry/core@7.7.0";
import {
  Event,
  EventHint,
  Severity,
  SeverityLevel,
  ClientOptions,
} from "https://esm.sh/@sentry/types@7.7.0";

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

  eventFromMessage(
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
