import {
  BaseEnvelopeHeaders,
  BaseEnvelopeItemHeaders,
  Envelope,
  Event,
} from '../sentry-javascript-deno/types/mod.ts';
import { forEachEnvelopeItem } from '../sentry-javascript-deno/utils/envelope.ts';
import { normalize } from './normalize.ts';

/**
 * A naive binary envelope parser
 */
export function parseEnvelope(env: string | Uint8Array): Envelope {
  let buf = typeof env === 'string' ? new TextEncoder().encode(env) : env;

  let envelopeHeaders: BaseEnvelopeHeaders | undefined;
  let lastItemHeader: BaseEnvelopeItemHeaders | undefined;
  // deno-lint-ignore no-explicit-any
  const items: [any, any][] = [];

  let binaryLength = 0;
  while (buf.length) {
    // Next length is either the binary length from the previous header
    // or the next newline character
    let i = binaryLength || buf.indexOf(0xa);

    // If no newline was found, assume this is the last block
    if (i < 0) {
      i = buf.length;
    }

    // If we read out a length in the previous header, assume binary
    if (binaryLength > 0) {
      const bin = buf.slice(0, binaryLength);
      binaryLength = 0;
      items.push([lastItemHeader, bin]);
    } else {
      const jsonStr = new TextDecoder().decode(buf.slice(0, i + 1));

      try {
        const json = JSON.parse(jsonStr);

        if (typeof json.length === 'number') {
          binaryLength = json.length;
        }

        // First json is always the envelope headers
        if (!envelopeHeaders) {
          envelopeHeaders = json;
        } else {
          // If there is a type property, assume this is an item header
          if (lastItemHeader) {
            items.push([lastItemHeader, json]);
            lastItemHeader = undefined;
          } else {
            lastItemHeader = json;
          }
        }
      } catch (_) {
        //
      }
    }

    // Replace the buffer with the previous block and newline removed
    buf = buf.slice(i + 1);
  }

  return [envelopeHeaders as BaseEnvelopeHeaders, items];
}

export function getNormalizedEvent(envelope: Envelope): Event | undefined {
  let event: Event | undefined;

  forEachEnvelopeItem(envelope, (item) => {
    const [headers, body] = item;

    if (headers.type === 'event') {
      event = body as Event;
    }
  });

  return normalize(event) as Event | undefined;
}
