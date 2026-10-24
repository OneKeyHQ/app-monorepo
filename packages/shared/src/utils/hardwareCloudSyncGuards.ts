import { Buffer } from 'buffer';

import { OneKeyLocalError } from '../errors/errors/localError';

const RESERVED_REQUEST_ERROR =
  'OneKey Cloud key operations are unavailable to external signing requests';
const HARDENED = 2_147_483_648;
const MAX_DECODE_LENGTH = 16_384;
const MAX_VISITED_VALUES = 50_000;

function validationLimitError(): OneKeyLocalError {
  return new OneKeyLocalError(
    'Signing request exceeds Cloud key validation limits',
  );
}

function assertByteDecodeSize(size: number): void {
  if (size > MAX_DECODE_LENGTH) {
    throw validationLimitError();
  }
}

export function isHardwareCloudSyncPath(value: unknown): boolean {
  if (Array.isArray(value)) {
    return (
      value.length >= 3 &&
      value[0] === HARDENED + 44 &&
      value[1] === HARDENED &&
      value[2] === HARDENED + 100
    );
  }
  if (typeof value !== 'string') {
    return false;
  }
  // Account IDs contain the path too. Reserve the entire BIP44 BTC account,
  // including alternate change/address indices and h/H hardened notation.
  return /(?:^|[^0-9])(?:m\/)?0*44['h]\/0+['h]\/0*100['h](?:\/|$)/i.test(
    value.replace(/\s/g, ''),
  );
}

function isReservedText(value: string): boolean {
  return /onekey[\s_-]+cloud[\s_-]+key(?:[\s_-]+v\d+)?/i.test(value);
}

/** Reject equivalent Cloud root requests before provider dispatch or logging. */
export function assertNoHardwareCloudSyncSigningRequest(value: unknown): void {
  const pending: Array<{ value: unknown; decodeDepth: number }> = [
    { value, decodeDepth: 0 },
  ];
  const seen = new WeakSet<object>();
  let visited = 0;
  const assertCanEnqueue = () => {
    if (visited + pending.length >= MAX_VISITED_VALUES) {
      throw validationLimitError();
    }
  };
  const enqueue = (nextValue: unknown, decodeDepth: number) => {
    assertCanEnqueue();
    pending.push({ value: nextValue, decodeDepth });
  };
  const inspect = (current: unknown, decodeDepth: number) => {
    if (isHardwareCloudSyncPath(current)) {
      throw new OneKeyLocalError(RESERVED_REQUEST_ERROR);
    }
    if (typeof current === 'string') {
      if (isReservedText(current)) {
        throw new OneKeyLocalError(RESERVED_REQUEST_ERROR);
      }
      if (decodeDepth >= 4) {
        return;
      }
      const nextDepth = decodeDepth + 1;
      const compact = current.replace(/\s/g, '');
      if (compact.length <= MAX_DECODE_LENGTH) {
        const hex = compact.replace(/^0x/i, '');
        if (hex.length > 0 && /^(?:[0-9a-f]{2})+$/i.test(hex)) {
          enqueue(Buffer.from(hex, 'hex').toString('utf8'), nextDepth);
        }
        if (
          compact.length > 0 &&
          compact.length % 4 !== 1 &&
          /^[a-z0-9+/_-]+={0,2}$/i.test(compact)
        ) {
          enqueue(Buffer.from(compact, 'base64').toString('utf8'), nextDepth);
        }
      }
      if (/^\s*[[{]/.test(current)) {
        // A structured string can contain a nested target. Do not silently
        // accept it when it exceeds the bounded JSON/decode work budget.
        assertByteDecodeSize(current.length);
        let parsed: unknown;
        try {
          parsed = JSON.parse(current) as unknown;
        } catch {
          return;
        }
        enqueue(parsed, nextDepth);
      }
    } else if (current && typeof current === 'object') {
      if (seen.has(current)) {
        return;
      }
      seen.add(current);
      if (current instanceof ArrayBuffer) {
        assertByteDecodeSize(current.byteLength);
        enqueue(
          Buffer.from(new Uint8Array(current)).toString('utf8'),
          decodeDepth,
        );
      } else if (ArrayBuffer.isView(current)) {
        assertByteDecodeSize(current.byteLength);
        enqueue(
          Buffer.from(
            new Uint8Array(
              current.buffer,
              current.byteOffset,
              current.byteLength,
            ),
          ).toString('utf8'),
          decodeDepth,
        );
      } else if (Array.isArray(current)) {
        // Check before every()/copying, including sparse or structured arrays.
        assertByteDecodeSize(current.length);
        if (
          current.length > 0 &&
          current.every(
            (item) =>
              typeof item === 'number' &&
              Number.isInteger(item) &&
              item >= 0 &&
              item <= 255,
          )
        ) {
          enqueue(
            Buffer.from(current as number[]).toString('utf8'),
            decodeDepth,
          );
        } else {
          if (current.length > MAX_VISITED_VALUES - visited - pending.length) {
            throw validationLimitError();
          }
          for (const child of current) {
            enqueue(child, decodeDepth);
          }
        }
      } else {
        // Stream own properties instead of allocating Object.values() for an
        // untrusted wide object. Check before reading/enqueueing the next value.
        const record = current as Record<string, unknown>;
        for (const key in record) {
          if (Object.prototype.hasOwnProperty.call(record, key)) {
            assertCanEnqueue();
            enqueue(record[key], decodeDepth);
          }
        }
      }
    }
  };

  while (pending.length) {
    const entry = pending.pop();
    if (!entry) {
      break;
    }
    visited += 1;
    if (visited > MAX_VISITED_VALUES) {
      throw validationLimitError();
    }
    inspect(entry.value, entry.decodeDepth);
  }
}
