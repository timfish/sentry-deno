import { defaultIntegrations, DenoClient } from '../mod.ts';
import { makeTestTransport } from './transport.ts';
import {
  createStackParser,
  nodeStackLineParser,
} from '../sentry-javascript-deno/utils/mod.ts';
import { Event, Integration } from '../sentry-javascript-deno/types/mod.ts';
import { Hub, Scope } from '../sentry-javascript-deno/hub/mod.ts';
import { getNormalizedEvent } from './envelope.ts';
import { assertSnapshot } from 'https://deno.land/std@0.151.0/testing/snapshot.ts';

function getTestClient(
  callback: (event?: Event) => void,
  integrations: Integration[] = [],
): [Hub, DenoClient] {
  const client = new DenoClient({
    dsn: 'https://233a45e5efe34c47a3536797ce15dafa@nothing.here/5650507',
    debug: true,
    integrations: [...defaultIntegrations, ...integrations],
    stackParser: createStackParser(nodeStackLineParser()),
    transport: makeTestTransport((envelope) => {
      callback(getNormalizedEvent(envelope));
    }),
  });

  const scope = new Scope();
  const hub = new Hub(client, scope);

  return [hub, client];
}

Deno.test('captureException', (t) => {
  const [hub] = getTestClient((event) => {
    assertSnapshot(t, event);
  });

  function something() {
    return new Error('Some unhandled error');
  }

  hub.captureException(something());
});

Deno.test('captureMessage', (t) => {
  const [hub] = getTestClient((event) => {
    assertSnapshot(t, event);
  });

  hub.captureMessage('Some error message');
});
