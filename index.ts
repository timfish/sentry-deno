import {
  getCurrentHub,
  getIntegrationsToSetup,
  initAndBind,
} from "https://esm.sh/@sentry/core@7.7.0";
import {
  nodeStackLineParser,
  createStackParser,
  logger,
} from "https://esm.sh/@sentry/utils@7.7.0";
import { Options } from "https://esm.sh/@sentry/types@7.7.0";
import { Breadcrumbs, Dedupe } from "https://esm.sh/@sentry/browser@7.7.0";

import { DenoClient } from "./client.ts";
import {} from "./eventbuilder.ts";
import { DenoTransportOptions, makeFetchTransport } from "./transport.ts";
import { DenoContext } from "./integrations/context.ts";
import { GlobalHandlers } from "./integrations/globalhandlers.ts";
export * from "./exports.ts";

// deno-lint-ignore no-empty-interface
export interface DenoOptions extends Options<DenoTransportOptions> {}

export function init(options: DenoOptions = {}) {
  if (options.defaultIntegrations == undefined) {
    options.defaultIntegrations = [
      new Breadcrumbs({ xhr: false, history: false, dom: false }),
      new Dedupe(),
      new DenoContext(),
      new GlobalHandlers(),
    ];
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
  __DEBUG_BUILD__ && logger.warn("Cannot flush events. No client defined.");
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
  __DEBUG_BUILD__ &&
    logger.warn("Cannot flush events and disable SDK. No client defined.");
  return Promise.resolve(false);
}
