import {
  BaseClient,
  SDK_VERSION as JS_SDK_VERSION,
} from '../sentry-javascript-deno/core/mod.ts';
import {
  ClientOptions,
  Event,
  EventHint,
  Severity,
  SeverityLevel,
} from '../sentry-javascript-deno/types/mod.ts';

import { eventFromMessage, eventFromUnknownInput } from './eventbuilder.ts';
import { DenoTransportOptions } from './transport.ts';

const SDK_VERSION = '0.2.0';

export interface DenoClientOptions extends ClientOptions<DenoTransportOptions> {
  /**
   * Path to the applications root directory
   *
   * If this is not supplied, we use Deno.cwd() if permissions permit and
   * fallback to inferring the root directory from an Error stack trace.
   */
  appRoot?: string;
}

export class DenoClient extends BaseClient<DenoClientOptions> {
  constructor(options: DenoClientOptions) {
    options._metadata = options._metadata || {};
    options._metadata.sdk = options._metadata.sdk || {
      name: 'sentry.javascript.deno',
      version: SDK_VERSION,
      packages: [
        {
          name: 'npm:@sentry/core',
          version: JS_SDK_VERSION,
        },
      ],
    };

    super(options);
  }

  public eventFromException(
    // deno-lint-ignore no-explicit-any
    exception: any,
    hint?: EventHint | undefined,
  ): Promise<Event> {
    return Promise.resolve(
      eventFromUnknownInput(this._options.stackParser, exception, hint),
    );
  }

  public eventFromMessage(
    message: string,
    level?: Severity | SeverityLevel | undefined,
    hint?: EventHint | undefined,
  ): PromiseLike<Event> {
    return Promise.resolve(
      eventFromMessage(
        this._options.stackParser,
        message,
        level,
        hint,
        this._options.attachStacktrace,
      ),
    );
  }

  public flush(timeout?: number): PromiseLike<boolean> {
    const transport = this._transport;
    if (transport) {
      return this._isClientDoneProcessing(timeout).then((clientFinished) => {
        return transport
          .flush(timeout)
          .then(
            (transportFlushed: boolean) => clientFinished && transportFlushed,
          );
      });
    } else {
      return Promise.resolve(true);
    }
  }
}
