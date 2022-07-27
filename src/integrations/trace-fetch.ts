import { Integration } from '../../sentry-javascript-deno/types/mod.ts';
import {
  instrumentOutgoingRequests,
  RequestInstrumentationOptions,
} from '../../sentry-javascript-deno/tracing/browser/request.ts';

type TraceFetchOptions = Partial<
  Omit<RequestInstrumentationOptions, 'traceXHR'>
>;

/** Adds fetch spans to transactions. */
export class TraceFetch implements Integration {
  /** @inheritDoc */
  public static id = 'TraceFetch';

  /** @inheritDoc */
  public name: string = TraceFetch.id;

  constructor(readonly _options: TraceFetchOptions = {}) {}

  /** @inheritDoc */
  public setupOnce(): void {
    instrumentOutgoingRequests({
      traceFetch: true,
      ...this._options,
      traceXHR: false,
    });
  }
}
