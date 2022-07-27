import { createTransport } from '../sentry-javascript-deno/core/mod.ts';
import {
  BaseTransportOptions,
  Transport,
  TransportMakeRequestResponse,
  TransportRequest,
} from '../sentry-javascript-deno/types/mod.ts';

export interface DenoTransportOptions extends BaseTransportOptions {
  headers?: Record<string, string>;
  fetchOptions?: RequestInit;
}

/**
 * Creates a Transport that uses the Fetch API to send events to Sentry.
 */
export function makeFetchTransport(options: DenoTransportOptions): Transport {
  async function makeRequest(
    request: TransportRequest,
  ): Promise<TransportMakeRequestResponse> {
    // Check if we have permissions to send this event
    const url = new URL(options.url);

    const permission = await Deno.permissions.query({
      name: 'net',
      host: url.host,
    });

    if (permission.state !== 'granted') {
      console.warn(
        'Event was not sent due to missing permissions. Run Deno with --allow-net to allow sending of events.',
      );

      return {};
    }

    const requestOptions: RequestInit = {
      body: request.body,
      method: 'POST',
      referrerPolicy: 'origin',
      headers: options.headers,
      ...options.fetchOptions,
    };

    return fetch(options.url, requestOptions).then((response) => ({
      statusCode: response.status,
      headers: {
        'x-sentry-rate-limits': response.headers.get('X-Sentry-Rate-Limits'),
        'retry-after': response.headers.get('Retry-After'),
      },
    }));
  }

  return createTransport(options, makeRequest);
}
