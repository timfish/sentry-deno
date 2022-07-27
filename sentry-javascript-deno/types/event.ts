// deno-lint-ignore-file
import { Attachment } from './attachment.ts';
import { Breadcrumb } from './breadcrumb.ts';
import { Contexts } from './context.ts';
import { DebugMeta } from './debugMeta.ts';
import { Exception } from './exception.ts';
import { Extras } from './extra.ts';
import { Measurements } from './measurement.ts';
import { Primitive } from './misc.ts';
import { Request } from './request.ts';
import { CaptureContext } from './scope.ts';
import { SdkInfo } from './sdkinfo.ts';
import { Severity, SeverityLevel } from './severity.ts';
import { Span } from './span.ts';
import { TransactionSource } from './transaction.ts';
import { User } from './user.ts';

/** JSDoc */
export interface Event {
  event_id?: string;
  message?: string;
  timestamp?: number;
  start_timestamp?: number;
  // eslint-disable-next-line deprecation/deprecation
  level?: Severity | SeverityLevel;
  platform?: string;
  logger?: string;
  server_name?: string;
  release?: string;
  dist?: string;
  environment?: string;
  sdk?: SdkInfo;
  request?: Request;
  transaction?: string;
  modules?: { [key: string]: string };
  fingerprint?: string[];
  exception?: {
    values?: Exception[];
  };
  breadcrumbs?: Breadcrumb[];
  contexts?: Contexts;
  tags?: { [key: string]: Primitive };
  extra?: Extras;
  user?: User;
  type?: EventType;
  spans?: Span[];
  measurements?: Measurements;
  debug_meta?: DebugMeta;
  // A place to stash data which is needed at some point in the SDK's event processing pipeline but which shouldn't get sent to Sentry
  sdkProcessingMetadata?: { [key: string]: any };
  transaction_info?: {
    source: TransactionSource;
  };
}

/** JSDoc */
export type EventType = 'transaction';

/** JSDoc */
export interface EventHint {
  event_id?: string;
  captureContext?: CaptureContext;
  syntheticException?: Error | null;
  originalException?: Error | string | null;
  attachments?: Attachment[];
  data?: any;
}
