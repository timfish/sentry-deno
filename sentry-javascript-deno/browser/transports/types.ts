// deno-lint-ignore-file
import { BaseTransportOptions } from '../../types/mod.ts';

export interface BrowserTransportOptions extends BaseTransportOptions {
  /** Fetch API init parameters. Used by the FetchTransport */
  fetchOptions?: RequestInit;
  /** Custom headers for the transport. Used by the XHRTransport and FetchTransport */
  headers?: { [key: string]: string };
}
