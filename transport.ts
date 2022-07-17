import {
  createTransport,
  BaseTransportOptions,
  Transport,
  TransportRequest,
  TransportMakeRequestResponse,
} from "./deps.ts";

export interface DenoTransportOptions extends BaseTransportOptions {
  headers?: Record<string, string>;
  fetchOptions?: RequestInit;
}

/**
 * Creates a Transport that uses the Fetch API to send events to Sentry.
 */
export function makeFetchTransport(options: DenoTransportOptions): Transport {
  function makeRequest(
    request: TransportRequest
  ): PromiseLike<TransportMakeRequestResponse> {
    const requestOptions: RequestInit = {
      body: request.body,
      method: "POST",
      referrerPolicy: "origin",
      headers: options.headers,
      ...options.fetchOptions,
    };

    return fetch(options.url, requestOptions).then((response) => ({
      statusCode: response.status,
      headers: {
        "x-sentry-rate-limits": response.headers.get("X-Sentry-Rate-Limits"),
        "retry-after": response.headers.get("Retry-After"),
      },
    }));
  }

  return createTransport(options, makeRequest);
}
