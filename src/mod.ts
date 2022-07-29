import { Options } from '../sentry-javascript-deno/types/mod.ts';
import {
  getCurrentHub,
  initAndBind,
} from '../sentry-javascript-deno/core/mod.ts';
import {
  Breadcrumbs,
  ContextLines,
  Dedupe,
  DenoContext,
  GlobalHandlers,
  NormalizePaths,
  TraceFetch,
} from './integrations/mod.ts';
import { getIntegrationsToSetup } from '../sentry-javascript-deno/core/mod.ts';
import {
  createStackParser,
  nodeStackLineParser,
} from '../sentry-javascript-deno/utils/mod.ts';
import { DenoClient } from './client.ts';
import { DenoTransportOptions, makeFetchTransport } from './transport.ts';

export * from './exports.ts';
export * from './integrations/mod.ts';
export { DenoClient } from './client.ts';

export const defaultIntegrations = [
  // These are straight form the browser SDK
  new Breadcrumbs({ xhr: false, history: false, dom: false }),
  new Dedupe(),
  // These are custom Deno integrations
  new GlobalHandlers(),
  new ContextLines(),
  new TraceFetch(),
  new DenoContext(),
  new NormalizePaths(),
];

// deno-lint-ignore no-empty-interface
export interface DenoOptions extends Options<DenoTransportOptions> {}

/** inits the SDK */
export function init(options: DenoOptions = {}) {
  if (!options.dsn) {
    return;
  }

  globalThis.addEventListener('beforeunload', (_) => {
    flush();
  });

  if (options.defaultIntegrations == undefined) {
    options.defaultIntegrations = defaultIntegrations;
  }

  const clientOptions = {
    ...options,
    integrations: getIntegrationsToSetup(options),
    transport: options.transport || makeFetchTransport,
    stackParser: createStackParser(nodeStackLineParser()),
  };

  initAndBind(DenoClient, clientOptions);
}

/**
 * This is the getter for lastEventId.
 *
 * @returns The last event id of a captured event.
 */
export function lastEventId(): string | undefined {
  return getCurrentHub().lastEventId();
}

/**
 * Call `flush()` on the current client, if there is one. See {@link Client.flush}.
 *
 * @param timeout Maximum time in ms the client should wait to flush its event queue. Omitting this parameter will cause
 * the client to wait until all events are sent before resolving the promise.
 * @returns A promise which resolves to `true` if the queue successfully drains before the timeout, or `false` if it
 * doesn't (or if there's no client defined).
 */
export async function flush(timeout?: number): Promise<boolean> {
  const client = getCurrentHub().getClient<DenoClient>();
  if (client) {
    return await client.flush(timeout);
  }

  return Promise.resolve(false);
}

/**
 * Call `close()` on the current client, if there is one. See {@link Client.close}.
 *
 * @param timeout Maximum time in ms the client should wait to flush its event queue before shutting down. Omitting this
 * parameter will cause the client to wait until all events are sent before disabling itself.
 * @returns A promise which resolves to `true` if the queue successfully drains before the timeout, or `false` if it
 * doesn't (or if there's no client defined).
 */
export async function close(timeout?: number): Promise<boolean> {
  const client = getCurrentHub().getClient<DenoClient>();
  if (client) {
    return await client.close(timeout);
  }

  return Promise.resolve(false);
}
