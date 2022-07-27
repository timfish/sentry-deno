// deno-lint-ignore-file
import { EventProcessor } from './eventprocessor.ts';
import { Hub } from './hub.ts';

/** Integration Class Interface */
export interface IntegrationClass<T> {
  /**
   * Property that holds the integration name
   */
  id: string;

  new (...args: any): T;
}

/** Integration interface */
export interface Integration {
  /**
   * Returns {@link IntegrationClass.id}
   */
  name: string;

  /**
   * Sets the integration up only once.
   * This takes no options on purpose, options should be passed in the constructor
   */
  setupOnce(
    addGlobalEventProcessor: (callback: EventProcessor) => void,
    getCurrentHub: () => Hub,
  ): void;
}
