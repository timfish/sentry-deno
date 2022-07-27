// deno-lint-ignore-file
export * from './exports.ts';

import { Integrations as CoreIntegrations } from '../core/mod.ts';
import { getGlobalObject } from '../utils/mod.ts';

import * as BrowserIntegrations from './integrations/mod.ts';

let windowIntegrations = {};

// This block is needed to add compatibility with the integrations packages when used with a CDN
const _window = getGlobalObject<Window>();
if (_window.Sentry && _window.Sentry.Integrations) {
  windowIntegrations = _window.Sentry.Integrations;
}

const INTEGRATIONS = {
  ...windowIntegrations,
  ...CoreIntegrations,
  ...BrowserIntegrations,
};

export { INTEGRATIONS as Integrations };
