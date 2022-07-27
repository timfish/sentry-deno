// deno-lint-ignore-file
import { Severity, SeverityLevel } from './severity.ts';

/** JSDoc */
export interface Breadcrumb {
  type?: string;
  // eslint-disable-next-line deprecation/deprecation
  level?: Severity | SeverityLevel;
  event_id?: string;
  category?: string;
  message?: string;
  data?: { [key: string]: any };
  timestamp?: number;
}

/** JSDoc */
export interface BreadcrumbHint {
  [key: string]: any;
}
