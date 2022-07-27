// deno-lint-ignore-file
import { addInstrumentationHandler, logger } from '../utils/mod.ts';

import { SpanStatusType } from './span.ts';
import { getActiveTransaction } from './utils.ts';

/**
 * Configures global error listeners
 */
export function registerErrorInstrumentation(): void {
  addInstrumentationHandler('error', errorCallback);
  addInstrumentationHandler('unhandledrejection', errorCallback);
}

/**
 * If an error or unhandled promise occurs, we mark the active transaction as failed
 */
function errorCallback(): void {
  const activeTransaction = getActiveTransaction();
  if (activeTransaction) {
    const status: SpanStatusType = 'internal_error';
    true &&
      logger.log(`[Tracing] Transaction: ${status} -> Global error occured`);
    activeTransaction.setStatus(status);
  }
}
