// deno-lint-ignore-file
import {
  BaseClient,
  getCurrentHub,
  getEnvelopeEndpointWithUrlEncodedAuth,
  Scope,
  SDK_VERSION,
} from '../core/mod.ts';
import {
  ClientOptions,
  Event,
  EventHint,
  Options,
  Severity,
  SeverityLevel,
} from '../types/mod.ts';
import {
  createClientReportEnvelope,
  dsnToString,
  getEventDescription,
  getGlobalObject,
  logger,
  serializeEnvelope,
} from '../utils/mod.ts';

import { eventFromException, eventFromMessage } from './eventbuilder.ts';
import { Breadcrumbs } from './integrations/mod.ts';
import { BREADCRUMB_INTEGRATION_ID } from './integrations/breadcrumbs.ts';
import { BrowserTransportOptions } from './transports/types.ts';
import { sendReport } from './transports/utils.ts';

const globalObject = getGlobalObject<Window>();

export interface BaseBrowserOptions {
  /**
   * A pattern for error URLs which should exclusively be sent to Sentry.
   * This is the opposite of {@link Options.denyUrls}.
   * By default, all errors will be sent.
   */
  allowUrls?: Array<string | RegExp>;

  /**
   * A pattern for error URLs which should not be sent to Sentry.
   * To allow certain errors instead, use {@link Options.allowUrls}.
   * By default, all errors will be sent.
   */
  denyUrls?: Array<string | RegExp>;
}

/**
 * Configuration options for the Sentry Browser SDK.
 * @see @sentry/types Options for more information.
 */
export interface BrowserOptions
  extends Options<BrowserTransportOptions>, BaseBrowserOptions {}

/**
 * Configuration options for the Sentry Browser SDK Client class
 * @see BrowserClient for more information.
 */
export interface BrowserClientOptions
  extends ClientOptions<BrowserTransportOptions>, BaseBrowserOptions {}

/**
 * The Sentry Browser SDK Client.
 *
 * @see BrowserOptions for documentation on configuration options.
 * @see SentryClient for usage documentation.
 */
export class BrowserClient extends BaseClient<BrowserClientOptions> {
  /**
   * Creates a new Browser SDK instance.
   *
   * @param options Configuration options for this SDK.
   */
  public constructor(options: BrowserClientOptions) {
    options._metadata = options._metadata || {};
    options._metadata.sdk = options._metadata.sdk || {
      name: 'sentry.javascript.browser',
      packages: [
        {
          name: 'npm:@sentry/browser',
          version: SDK_VERSION,
        },
      ],
      version: SDK_VERSION,
    };

    super(options);

    if (options.sendClientReports && globalObject.document) {
      globalObject.document.addEventListener('visibilitychange', () => {
        if (globalObject.document.visibilityState === 'hidden') {
          this._flushOutcomes();
        }
      });
    }
  }

  /**
   * @inheritDoc
   */
  public eventFromException(
    exception: unknown,
    hint?: EventHint,
  ): PromiseLike<Event> {
    return eventFromException(
      this._options.stackParser,
      exception,
      hint,
      this._options.attachStacktrace,
    );
  }

  /**
   * @inheritDoc
   */
  public eventFromMessage(
    message: string,
    // eslint-disable-next-line deprecation/deprecation
    level: Severity | SeverityLevel = 'info',
    hint?: EventHint,
  ): PromiseLike<Event> {
    return eventFromMessage(
      this._options.stackParser,
      message,
      level,
      hint,
      this._options.attachStacktrace,
    );
  }

  /**
   * @inheritDoc
   */
  public sendEvent(event: Event, hint?: EventHint): void {
    // We only want to add the sentry event breadcrumb when the user has the breadcrumb integration installed and
    // activated its `sentry` option.
    // We also do not want to use the `Breadcrumbs` class here directly, because we do not want it to be included in
    // bundles, if it is not used by the SDK.
    // This all sadly is a bit ugly, but we currently don't have a "pre-send" hook on the integrations so we do it this
    // way for now.
    const breadcrumbIntegration = this.getIntegrationById(
      BREADCRUMB_INTEGRATION_ID,
    ) as Breadcrumbs | null;
    if (
      breadcrumbIntegration &&
      // We check for definedness of `options`, even though it is not strictly necessary, because that access to
      // `.sentry` below does not throw, in case users provided their own integration with id "Breadcrumbs" that does
      // not have an`options` field
      breadcrumbIntegration.options &&
      breadcrumbIntegration.options.sentry
    ) {
      getCurrentHub().addBreadcrumb(
        {
          category: `sentry.${
            event.type === 'transaction' ? 'transaction' : 'event'
          }`,
          event_id: event.event_id,
          level: event.level,
          message: getEventDescription(event),
        },
        {
          event,
        },
      );
    }

    super.sendEvent(event, hint);
  }

  /**
   * @inheritDoc
   */
  protected _prepareEvent(
    event: Event,
    hint: EventHint,
    scope?: Scope,
  ): PromiseLike<Event | null> {
    event.platform = event.platform || 'javascript';
    return super._prepareEvent(event, hint, scope);
  }

  /**
   * Sends client reports as an envelope.
   */
  private _flushOutcomes(): void {
    const outcomes = this._clearOutcomes();

    if (outcomes.length === 0) {
      true && logger.log('No outcomes to send');
      return;
    }

    if (!this._dsn) {
      true && logger.log('No dsn provided, will not send outcomes');
      return;
    }

    true && logger.log('Sending outcomes:', outcomes);

    const url = getEnvelopeEndpointWithUrlEncodedAuth(this._dsn, this._options);
    const envelope = createClientReportEnvelope(
      outcomes,
      this._options.tunnel && dsnToString(this._dsn),
    );

    try {
      sendReport(url, serializeEnvelope(envelope));
    } catch (e) {
      true && logger.error(e);
    }
  }
}
