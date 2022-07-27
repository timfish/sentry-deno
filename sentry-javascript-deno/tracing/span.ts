// deno-lint-ignore-file
/* eslint-disable max-lines */
import {
  Primitive,
  Span as SpanInterface,
  SpanContext,
  Transaction,
} from '../types/mod.ts';
import { dropUndefinedKeys, timestampWithMs, uuid4 } from '../utils/mod.ts';

/**
 * Keeps track of finished spans for a given transaction
 * @internal
 * @hideconstructor
 * @hidden
 */
export class SpanRecorder {
  public spans: Span[] = [];

  private readonly _maxlen: number;

  public constructor(maxlen: number = 1000) {
    this._maxlen = maxlen;
  }

  /**
   * This is just so that we don't run out of memory while recording a lot
   * of spans. At some point we just stop and flush out the start of the
   * trace tree (i.e.the first n spans with the smallest
   * start_timestamp).
   */
  public add(span: Span): void {
    if (this.spans.length > this._maxlen) {
      span.spanRecorder = undefined;
    } else {
      this.spans.push(span);
    }
  }
}

/**
 * Span contains all data about a span
 */
export class Span implements SpanInterface {
  /**
   * @inheritDoc
   */
  public traceId: string = uuid4();

  /**
   * @inheritDoc
   */
  public spanId: string = uuid4().substring(16);

  /**
   * @inheritDoc
   */
  public parentSpanId?: string;

  /**
   * Internal keeper of the status
   */
  public status?: SpanStatusType | string;

  /**
   * @inheritDoc
   */
  public sampled?: boolean;

  /**
   * Timestamp in seconds when the span was created.
   */
  public startTimestamp: number = timestampWithMs();

  /**
   * Timestamp in seconds when the span ended.
   */
  public endTimestamp?: number;

  /**
   * @inheritDoc
   */
  public op?: string;

  /**
   * @inheritDoc
   */
  public description?: string;

  /**
   * @inheritDoc
   */
  public tags: { [key: string]: Primitive } = {};

  /**
   * @inheritDoc
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public data: { [key: string]: any } = {};

  /**
   * List of spans that were finalized
   */
  public spanRecorder?: SpanRecorder;

  /**
   * @inheritDoc
   */
  public transaction?: Transaction;

  /**
   * You should never call the constructor manually, always use `Sentry.startTransaction()`
   * or call `startChild()` on an existing span.
   * @internal
   * @hideconstructor
   * @hidden
   */
  public constructor(spanContext?: SpanContext) {
    if (!spanContext) {
      return this;
    }
    if (spanContext.traceId) {
      this.traceId = spanContext.traceId;
    }
    if (spanContext.spanId) {
      this.spanId = spanContext.spanId;
    }
    if (spanContext.parentSpanId) {
      this.parentSpanId = spanContext.parentSpanId;
    }
    // We want to include booleans as well here
    if ('sampled' in spanContext) {
      this.sampled = spanContext.sampled;
    }
    if (spanContext.op) {
      this.op = spanContext.op;
    }
    if (spanContext.description) {
      this.description = spanContext.description;
    }
    if (spanContext.data) {
      this.data = spanContext.data;
    }
    if (spanContext.tags) {
      this.tags = spanContext.tags;
    }
    if (spanContext.status) {
      this.status = spanContext.status;
    }
    if (spanContext.startTimestamp) {
      this.startTimestamp = spanContext.startTimestamp;
    }
    if (spanContext.endTimestamp) {
      this.endTimestamp = spanContext.endTimestamp;
    }
  }

  /**
   * @inheritDoc
   */
  public startChild(
    spanContext?: Pick<
      SpanContext,
      Exclude<
        keyof SpanContext,
        'spanId' | 'sampled' | 'traceId' | 'parentSpanId'
      >
    >,
  ): Span {
    const childSpan = new Span({
      ...spanContext,
      parentSpanId: this.spanId,
      sampled: this.sampled,
      traceId: this.traceId,
    });

    childSpan.spanRecorder = this.spanRecorder;
    if (childSpan.spanRecorder) {
      childSpan.spanRecorder.add(childSpan);
    }

    childSpan.transaction = this.transaction;

    return childSpan;
  }

  /**
   * @inheritDoc
   */
  public setTag(key: string, value: Primitive): this {
    this.tags = { ...this.tags, [key]: value };
    return this;
  }

  /**
   * @inheritDoc
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  public setData(key: string, value: any): this {
    this.data = { ...this.data, [key]: value };
    return this;
  }

  /**
   * @inheritDoc
   */
  public setStatus(value: SpanStatusType): this {
    this.status = value;
    return this;
  }

  /**
   * @inheritDoc
   */
  public setHttpStatus(httpStatus: number): this {
    this.setTag('http.status_code', String(httpStatus));
    const spanStatus = spanStatusfromHttpCode(httpStatus);
    if (spanStatus !== 'unknown_error') {
      this.setStatus(spanStatus);
    }
    return this;
  }

  /**
   * @inheritDoc
   */
  public isSuccess(): boolean {
    return this.status === 'ok';
  }

  /**
   * @inheritDoc
   */
  public finish(endTimestamp?: number): void {
    this.endTimestamp = typeof endTimestamp === 'number'
      ? endTimestamp
      : timestampWithMs();
  }

  /**
   * @inheritDoc
   */
  public toTraceparent(): string {
    let sampledString = '';
    if (this.sampled !== undefined) {
      sampledString = this.sampled ? '-1' : '-0';
    }
    return `${this.traceId}-${this.spanId}${sampledString}`;
  }

  /**
   * @inheritDoc
   */
  public toContext(): SpanContext {
    return dropUndefinedKeys({
      data: this.data,
      description: this.description,
      endTimestamp: this.endTimestamp,
      op: this.op,
      parentSpanId: this.parentSpanId,
      sampled: this.sampled,
      spanId: this.spanId,
      startTimestamp: this.startTimestamp,
      status: this.status,
      tags: this.tags,
      traceId: this.traceId,
    });
  }

  /**
   * @inheritDoc
   */
  public updateWithContext(spanContext: SpanContext): this {
    this.data = spanContext.data ?? {};
    this.description = spanContext.description;
    this.endTimestamp = spanContext.endTimestamp;
    this.op = spanContext.op;
    this.parentSpanId = spanContext.parentSpanId;
    this.sampled = spanContext.sampled;
    this.spanId = spanContext.spanId ?? this.spanId;
    this.startTimestamp = spanContext.startTimestamp ?? this.startTimestamp;
    this.status = spanContext.status;
    this.tags = spanContext.tags ?? {};
    this.traceId = spanContext.traceId ?? this.traceId;

    return this;
  }

  /**
   * @inheritDoc
   */
  public getTraceContext(): {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: { [key: string]: any };
    description?: string;
    op?: string;
    parent_span_id?: string;
    span_id: string;
    status?: string;
    tags?: { [key: string]: Primitive };
    trace_id: string;
  } {
    return dropUndefinedKeys({
      data: Object.keys(this.data).length > 0 ? this.data : undefined,
      description: this.description,
      op: this.op,
      parent_span_id: this.parentSpanId,
      span_id: this.spanId,
      status: this.status,
      tags: Object.keys(this.tags).length > 0 ? this.tags : undefined,
      trace_id: this.traceId,
    });
  }

  /**
   * @inheritDoc
   */
  public toJSON(): {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: { [key: string]: any };
    description?: string;
    op?: string;
    parent_span_id?: string;
    span_id: string;
    start_timestamp: number;
    status?: string;
    tags?: { [key: string]: Primitive };
    timestamp?: number;
    trace_id: string;
  } {
    return dropUndefinedKeys({
      data: Object.keys(this.data).length > 0 ? this.data : undefined,
      description: this.description,
      op: this.op,
      parent_span_id: this.parentSpanId,
      span_id: this.spanId,
      start_timestamp: this.startTimestamp,
      status: this.status,
      tags: Object.keys(this.tags).length > 0 ? this.tags : undefined,
      timestamp: this.endTimestamp,
      trace_id: this.traceId,
    });
  }
}

export type SpanStatusType =
  /** The operation completed successfully. */
  | 'ok'
  /** Deadline expired before operation could complete. */
  | 'deadline_exceeded'
  /** 401 Unauthorized (actually does mean unauthenticated according to RFC 7235) */
  | 'unauthenticated'
  /** 403 Forbidden */
  | 'permission_denied'
  /** 404 Not Found. Some requested entity (file or directory) was not found. */
  | 'not_found'
  /** 429 Too Many Requests */
  | 'resource_exhausted'
  /** Client specified an invalid argument. 4xx. */
  | 'invalid_argument'
  /** 501 Not Implemented */
  | 'unimplemented'
  /** 503 Service Unavailable */
  | 'unavailable'
  /** Other/generic 5xx. */
  | 'internal_error'
  /** Unknown. Any non-standard HTTP status code. */
  | 'unknown_error'
  /** The operation was cancelled (typically by the user). */
  | 'cancelled'
  /** Already exists (409) */
  | 'already_exists'
  /** Operation was rejected because the system is not in a state required for the operation's */
  | 'failed_precondition'
  /** The operation was aborted, typically due to a concurrency issue. */
  | 'aborted'
  /** Operation was attempted past the valid range. */
  | 'out_of_range'
  /** Unrecoverable data loss or corruption */
  | 'data_loss';

/**
 * Converts a HTTP status code into a {@link SpanStatusType}.
 *
 * @param httpStatus The HTTP response status code.
 * @returns The span status or unknown_error.
 */
export function spanStatusfromHttpCode(httpStatus: number): SpanStatusType {
  if (httpStatus < 400 && httpStatus >= 100) {
    return 'ok';
  }

  if (httpStatus >= 400 && httpStatus < 500) {
    switch (httpStatus) {
      case 401:
        return 'unauthenticated';
      case 403:
        return 'permission_denied';
      case 404:
        return 'not_found';
      case 409:
        return 'already_exists';
      case 413:
        return 'failed_precondition';
      case 429:
        return 'resource_exhausted';
      default:
        return 'invalid_argument';
    }
  }

  if (httpStatus >= 500 && httpStatus < 600) {
    switch (httpStatus) {
      case 501:
        return 'unimplemented';
      case 503:
        return 'unavailable';
      case 504:
        return 'deadline_exceeded';
      default:
        return 'internal_error';
    }
  }

  return 'unknown_error';
}
