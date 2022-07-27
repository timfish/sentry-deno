import { createTransport } from '../sentry-javascript-deno/core/mod.ts';
import {
  BaseTransportOptions,
  Envelope,
  Transport,
  TransportMakeRequestResponse,
  TransportRequest,
} from '../sentry-javascript-deno/types/mod.ts';
import { parseEnvelope } from './envelope.ts';

export interface TestTransportOptions extends BaseTransportOptions {
  callback: (envelope: Envelope) => void;
}

/**
 * Creates a Transport that uses the Fetch API to send events to Sentry.
 */
export function makeTestTransport(callback: (envelope: Envelope) => void) {
  return (options: BaseTransportOptions): Transport => {
    function doCallback(
      request: TransportRequest,
    ): PromiseLike<TransportMakeRequestResponse> {
      callback(parseEnvelope(request.body));

      return Promise.resolve({
        statusCode: 200,
      });
    }

    return createTransport(options, doCallback);
  };
}
