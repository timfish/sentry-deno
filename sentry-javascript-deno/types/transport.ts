// deno-lint-ignore-file
import { EventDropReason } from './clientreport.ts';
import { DataCategory } from './datacategory.ts';
import { Envelope } from './envelope.ts';
import { TextEncoderInternal } from './textencoder.ts';

export type TransportRequest = {
  body: string | Uint8Array;
};

export type TransportMakeRequestResponse = {
  statusCode?: number;
  headers?: {
    [key: string]: string | null;
    'x-sentry-rate-limits': string | null;
    'retry-after': string | null;
  };
};

export interface InternalBaseTransportOptions {
  bufferSize?: number;
  recordDroppedEvent: (
    reason: EventDropReason,
    dataCategory: DataCategory,
  ) => void;
  textEncoder?: TextEncoderInternal;
}

export interface BaseTransportOptions extends InternalBaseTransportOptions {
  // url to send the event
  // transport does not care about dsn specific - client should take care of
  // parsing and figuring that out
  url: string;
}

export interface Transport {
  send(request: Envelope): PromiseLike<void>;
  flush(timeout?: number): PromiseLike<boolean>;
}

export type TransportRequestExecutor = (
  request: TransportRequest,
) => PromiseLike<TransportMakeRequestResponse>;
