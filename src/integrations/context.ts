import {
  Event,
  EventProcessor,
  Integration,
} from '../../sentry-javascript-deno/types/mod.ts';

function getOSName(): string {
  switch (Deno.build.os) {
    case 'darwin':
      return 'macOS';
    case 'linux':
      return 'Linux';
    case 'windows':
      return 'Windows';
    default:
      return 'Unknown';
  }
}

/** Adds Electron context to events. */
export class DenoContext implements Integration {
  /** @inheritDoc */
  public static id = 'DenoContext';

  /** @inheritDoc */
  public name: string = DenoContext.id;

  /** @inheritDoc */
  public setupOnce(
    addGlobalEventProcessor: (callback: EventProcessor) => void,
  ): void {
    addGlobalEventProcessor((event: Event) => {
      event.contexts = {
        app: {
          app_start_time: new Date(
            Date.now() - performance.now(),
          ).toISOString(),
        },
        device: {
          arch: Deno.build.arch,
          processor_count: navigator.hardwareConcurrency,
        },
        os: {
          name: getOSName(),
        },
        deno: {
          name: 'Deno',
          type: 'runtime',
          version: Deno.version.deno,
          target: Deno.build.target,
        },
        v8: {
          name: 'v8',
          version: Deno.version.v8,
        },
        typescript: {
          name: 'TypeScript',
          version: Deno.version.typescript,
        },
      };

      event.user = { ip_address: '{{auto}}', ...event.user };

      return event;
    });
  }
}
