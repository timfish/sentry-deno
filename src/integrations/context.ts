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

function denoRuntime(event: Event): Event {
  event.contexts = {
    ...{
      app: {
        app_start_time: new Date(Date.now() - performance.now()).toISOString(),
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
    },
    ...event.contexts,
  };

  event.user = { ip_address: '{{auto}}', ...event.user };

  return event;
}

interface DeployEnv {
  DENO_DEPLOYMENT_ID: string;
  DENO_REGION: string;
}

async function deployEnv(): Promise<DeployEnv | undefined> {
  const permission = await Deno.permissions.query({
    name: 'env',
    variable: 'DENO_DEPLOYMENT_ID',
  });

  if (permission.state !== 'granted') {
    return;
  }

  const DENO_DEPLOYMENT_ID = await Deno.env.get('DENO_DEPLOYMENT_ID');
  const DENO_REGION = await Deno.env.get('DENO_REGION');

  if (DENO_DEPLOYMENT_ID && DENO_REGION) {
    return { DENO_DEPLOYMENT_ID, DENO_REGION };
  }
}

async function denoDeployRuntime(event: Event): Promise<Event | undefined> {
  const env = await deployEnv();

  if (env === undefined) {
    return undefined;
  }

  event.release = event.release || env.DENO_DEPLOYMENT_ID;

  event.contexts = {
    app: {
      app_start_time: new Date(Date.now() - performance.now()).toISOString(),
    },
    ...event.contexts,
  };

  event.tags = {
    deploy_region: env.DENO_REGION,
    ...event.tags,
  };
  return event;
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
    addGlobalEventProcessor(
      async (event: Event) =>
        (await denoDeployRuntime(event)) || denoRuntime(event),
    );
  }
}
