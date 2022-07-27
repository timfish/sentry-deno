// deno-lint-ignore-file
export type {
  Breadcrumb,
  BreadcrumbHint,
  Event,
  EventHint,
  Exception,
  Request,
  SdkInfo,
  Session,
  // eslint-disable-next-line deprecation/deprecation
  Severity,
  SeverityLevel,
  StackFrame,
  Stacktrace,
  Thread,
  User,
} from '../types/mod.ts';

export type { BrowserOptions } from './client.ts';
export type { ReportDialogOptions } from './helpers.ts';

export {
  addBreadcrumb,
  addGlobalEventProcessor,
  captureEvent,
  captureException,
  captureMessage,
  configureScope,
  createTransport,
  FunctionToString,
  getCurrentHub,
  getHubFromCarrier,
  Hub,
  InboundFilters,
  makeMain,
  Scope,
  SDK_VERSION,
  setContext,
  setExtra,
  setExtras,
  setTag,
  setTags,
  setUser,
  startTransaction,
  withScope,
} from '../core/mod.ts';

export { BrowserClient } from './client.ts';
export { makeFetchTransport, makeXHRTransport } from './transports/mod.ts';
export {
  chromeStackLineParser,
  defaultStackLineParsers,
  defaultStackParser,
  geckoStackLineParser,
  opera10StackLineParser,
  opera11StackLineParser,
  winjsStackLineParser,
} from './stack-parsers.ts';
export {
  close,
  defaultIntegrations,
  flush,
  forceLoad,
  init,
  lastEventId,
  onLoad,
  showReportDialog,
  wrap,
} from './sdk.ts';
export {
  Breadcrumbs,
  Dedupe,
  GlobalHandlers,
  HttpContext,
  LinkedErrors,
  TryCatch,
} from './integrations/mod.ts';
