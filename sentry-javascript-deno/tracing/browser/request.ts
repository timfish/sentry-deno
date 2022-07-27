// deno-lint-ignore-file
/* eslint-disable max-lines */
import type { Baggage, Span } from '../../types/mod.ts';
import {
  addInstrumentationHandler,
  BAGGAGE_HEADER_NAME,
  isInstanceOf,
  isMatchingPattern,
  mergeAndSerializeBaggage,
} from '../../utils/mod.ts';

import { getActiveTransaction, hasTracingEnabled } from '../utils.ts';

export const DEFAULT_TRACING_ORIGINS = ['localhost', /^\//];

/** Options for Request Instrumentation */
export interface RequestInstrumentationOptions {
  /**
   * List of strings / regex where the integration should create Spans out of. Additionally this will be used
   * to define which outgoing requests the `sentry-trace` header will be attached to.
   *
   * Default: ['localhost', /^\//] {@see DEFAULT_TRACING_ORIGINS}
   */
  tracingOrigins: Array<string | RegExp>;

  /**
   * Flag to disable patching all together for fetch requests.
   *
   * Default: true
   */
  traceFetch: boolean;

  /**
   * Flag to disable patching all together for xhr requests.
   *
   * Default: true
   */
  traceXHR: boolean;

  /**
   * This function will be called before creating a span for a request with the given url.
   * Return false if you don't want a span for the given url.
   *
   * By default it uses the `tracingOrigins` options as a url match.
   */
  shouldCreateSpanForRequest?(url: string): boolean;
}

/** Data returned from fetch callback */
export interface FetchData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any; // the arguments passed to the fetch call itself
  fetchData?: {
    method: string;
    url: string;
    // span_id
    __span?: string;
  };

  // TODO Should this be unknown instead? If we vendor types, make it a Response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response?: any;
  error?: unknown;

  startTimestamp: number;
  endTimestamp?: number;
}

/** Data returned from XHR request */
export interface XHRData {
  xhr?: {
    __sentry_xhr__?: {
      method: string;
      url: string;
      status_code: number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: Record<string, any>;
    };
    __sentry_xhr_span_id__?: string;
    setRequestHeader?: (key: string, val: string) => void;
    getRequestHeader?: (key: string) => string;
    __sentry_own_request__?: boolean;
  };
  startTimestamp: number;
  endTimestamp?: number;
}

type PolymorphicRequestHeaders =
  | Record<string, string>
  | Array<[string, string]>
  // the below is not preicsely the Header type used in Request, but it'll pass duck-typing
  | {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
    append: (key: string, value: string) => void;
    get: (key: string) => string;
  };

export const defaultRequestInstrumentationOptions:
  RequestInstrumentationOptions = {
    traceFetch: true,
    traceXHR: true,
    tracingOrigins: DEFAULT_TRACING_ORIGINS,
  };

/** Registers span creators for xhr and fetch requests  */
export function instrumentOutgoingRequests(
  _options?: Partial<RequestInstrumentationOptions>,
): void {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { traceFetch, traceXHR, tracingOrigins, shouldCreateSpanForRequest } = {
    ...defaultRequestInstrumentationOptions,
    ..._options,
  };

  // We should cache url -> decision so that we don't have to compute
  // regexp everytime we create a request.
  const urlMap: Record<string, boolean> = {};

  const defaultShouldCreateSpan = (url: string): boolean => {
    if (urlMap[url]) {
      return urlMap[url];
    }
    const origins = tracingOrigins;
    urlMap[url] =
      origins.some((origin: string | RegExp) =>
        isMatchingPattern(url, origin)
      ) &&
      !isMatchingPattern(url, 'sentry_key');
    return urlMap[url];
  };

  // We want that our users don't have to re-implement shouldCreateSpanForRequest themselves
  // That's why we filter out already unwanted Spans from tracingOrigins
  let shouldCreateSpan = defaultShouldCreateSpan;
  if (typeof shouldCreateSpanForRequest === 'function') {
    shouldCreateSpan = (url: string) => {
      return defaultShouldCreateSpan(url) && shouldCreateSpanForRequest(url);
    };
  }

  const spans: Record<string, Span> = {};

  if (traceFetch) {
    addInstrumentationHandler('fetch', (handlerData: FetchData) => {
      fetchCallback(handlerData, shouldCreateSpan, spans);
    });
  }

  if (traceXHR) {
    addInstrumentationHandler('xhr', (handlerData: XHRData) => {
      xhrCallback(handlerData, shouldCreateSpan, spans);
    });
  }
}

/**
 * Create and track fetch request spans
 */
export function fetchCallback(
  handlerData: FetchData,
  shouldCreateSpan: (url: string) => boolean,
  spans: Record<string, Span>,
): void {
  if (
    !hasTracingEnabled() ||
    !(handlerData.fetchData && shouldCreateSpan(handlerData.fetchData.url))
  ) {
    return;
  }

  if (handlerData.endTimestamp) {
    const spanId = handlerData.fetchData.__span;
    if (!spanId) return;

    const span = spans[spanId];
    if (span) {
      if (handlerData.response) {
        // TODO (kmclb) remove this once types PR goes through
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        span.setHttpStatus(handlerData.response.status);
      } else if (handlerData.error) {
        span.setStatus('internal_error');
      }
      span.finish();

      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete spans[spanId];
    }
    return;
  }

  const activeTransaction = getActiveTransaction();
  if (activeTransaction) {
    const span = activeTransaction.startChild({
      data: {
        ...handlerData.fetchData,
        type: 'fetch',
      },
      description:
        `${handlerData.fetchData.method} ${handlerData.fetchData.url}`,
      op: 'http.client',
    });

    handlerData.fetchData.__span = span.spanId;
    spans[span.spanId] = span;

    const request =
      (handlerData.args[0] = handlerData.args[0] as string | Request);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options =
      (handlerData.args[1] = (handlerData.args[1] as { [key: string]: any }) ||
        {});
    options.headers = addTracingHeaders(
      request,
      activeTransaction.getBaggage(),
      span,
      options,
    );
  }
}

function addTracingHeaders(
  request: string | Request,
  incomingBaggage: Baggage | undefined,
  span: Span,
  options: { [key: string]: any },
): PolymorphicRequestHeaders {
  let headers = options.headers;

  if (isInstanceOf(request, Request)) {
    headers = (request as Request).headers;
  }

  if (headers) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (typeof headers.append === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      headers.append('sentry-trace', span.toTraceparent());
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      headers.append(
        BAGGAGE_HEADER_NAME,
        mergeAndSerializeBaggage(
          incomingBaggage,
          headers.get(BAGGAGE_HEADER_NAME),
        ),
      );
    } else if (Array.isArray(headers)) {
      const [, headerBaggageString] = headers.find(([key, _]) =>
        key === BAGGAGE_HEADER_NAME
      );
      headers = [
        ...headers,
        ['sentry-trace', span.toTraceparent()],
        [
          BAGGAGE_HEADER_NAME,
          mergeAndSerializeBaggage(incomingBaggage, headerBaggageString),
        ],
      ];
    } else {
      headers = {
        ...headers,
        'sentry-trace': span.toTraceparent(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        baggage: mergeAndSerializeBaggage(incomingBaggage, headers.baggage),
      };
    }
  } else {
    headers = {
      'sentry-trace': span.toTraceparent(),
      baggage: mergeAndSerializeBaggage(incomingBaggage),
    };
  }
  return headers;
}

/**
 * Create and track xhr request spans
 */
export function xhrCallback(
  handlerData: XHRData,
  shouldCreateSpan: (url: string) => boolean,
  spans: Record<string, Span>,
): void {
  if (
    !hasTracingEnabled() ||
    (handlerData.xhr && handlerData.xhr.__sentry_own_request__) ||
    !(handlerData.xhr && handlerData.xhr.__sentry_xhr__ &&
      shouldCreateSpan(handlerData.xhr.__sentry_xhr__.url))
  ) {
    return;
  }

  const xhr = handlerData.xhr.__sentry_xhr__;

  // check first if the request has finished and is tracked by an existing span which should now end
  if (handlerData.endTimestamp) {
    const spanId = handlerData.xhr.__sentry_xhr_span_id__;
    if (!spanId) return;

    const span = spans[spanId];
    if (span) {
      span.setHttpStatus(xhr.status_code);
      span.finish();

      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete spans[spanId];
    }
    return;
  }

  // if not, create a new span to track it
  const activeTransaction = getActiveTransaction();
  if (activeTransaction) {
    const span = activeTransaction.startChild({
      data: {
        ...xhr.data,
        type: 'xhr',
        method: xhr.method,
        url: xhr.url,
      },
      description: `${xhr.method} ${xhr.url}`,
      op: 'http.client',
    });

    handlerData.xhr.__sentry_xhr_span_id__ = span.spanId;
    spans[handlerData.xhr.__sentry_xhr_span_id__] = span;

    if (handlerData.xhr.setRequestHeader) {
      try {
        handlerData.xhr.setRequestHeader('sentry-trace', span.toTraceparent());

        const headerBaggageString = handlerData.xhr.getRequestHeader &&
          handlerData.xhr.getRequestHeader(BAGGAGE_HEADER_NAME);

        handlerData.xhr.setRequestHeader(
          BAGGAGE_HEADER_NAME,
          mergeAndSerializeBaggage(
            activeTransaction.getBaggage(),
            headerBaggageString,
          ),
        );
      } catch (_) {
        // Error: InvalidStateError: Failed to execute 'setRequestHeader' on 'XMLHttpRequest': The object's state must be OPENED.
      }
    }
  }
}
