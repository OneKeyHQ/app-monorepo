import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

// Chrome extension Port messages use JSON serialization, so binary values need
// an explicit wire representation between the background and offscreen pages.
const OFFSCREEN_BINARY_PAYLOAD_MARKER = '__onekey_offscreen_binary_payload__';

type IOffscreenBinaryPayload = {
  [OFFSCREEN_BINARY_PAYLOAD_MARKER]: 1;
  data: string;
  type: 'array-buffer' | 'uint8-array';
};

const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isArrayBufferValue(value: unknown): value is ArrayBuffer {
  return Boolean(
    typeof ArrayBuffer !== 'undefined' &&
    (value instanceof ArrayBuffer ||
      Object.prototype.toString.call(value) === '[object ArrayBuffer]'),
  );
}

function isBlobValue(value: unknown): value is Blob {
  return Boolean(
    typeof Blob !== 'undefined' &&
    (value instanceof Blob ||
      Object.prototype.toString.call(value) === '[object Blob]') &&
    typeof (value as Blob).arrayBuffer === 'function',
  );
}

function readBinaryPayload(
  value: unknown,
): IOffscreenBinaryPayload | undefined {
  if (!isPlainObject(value) || !(OFFSCREEN_BINARY_PAYLOAD_MARKER in value)) {
    return undefined;
  }
  const payload = value as Partial<IOffscreenBinaryPayload>;
  if (
    payload[OFFSCREEN_BINARY_PAYLOAD_MARKER] !== 1 ||
    (payload.type !== 'array-buffer' && payload.type !== 'uint8-array') ||
    typeof payload.data !== 'string'
  ) {
    throw new OneKeyLocalError('Invalid offscreen binary payload');
  }
  return payload as IOffscreenBinaryPayload;
}

function bytesToPayload(
  bytes: Uint8Array,
  type: IOffscreenBinaryPayload['type'],
): IOffscreenBinaryPayload {
  return {
    [OFFSCREEN_BINARY_PAYLOAD_MARKER]: 1,
    data: bufferUtils.bytesToBase64(bytes),
    type,
  };
}

function payloadToBytes(payload: IOffscreenBinaryPayload): Uint8Array {
  if (payload.data.length % 4 !== 0 || !BASE64_PATTERN.test(payload.data)) {
    throw new OneKeyLocalError('Invalid offscreen binary payload data');
  }
  const decoded = bufferUtils.base64ToBytes(payload.data);
  if (bufferUtils.bytesToBase64(decoded) !== payload.data) {
    throw new OneKeyLocalError('Invalid offscreen binary payload data');
  }
  return Uint8Array.from(decoded);
}

async function encodeValue(
  value: unknown,
  seen: WeakSet<object>,
): Promise<unknown> {
  if (isArrayBufferValue(value)) {
    return bytesToPayload(new Uint8Array(value), 'array-buffer');
  }
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)) {
    return bytesToPayload(
      new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
      'uint8-array',
    );
  }
  if (isBlobValue(value)) {
    return bytesToPayload(
      new Uint8Array(await value.arrayBuffer()),
      'uint8-array',
    );
  }

  const encodedPayload = readBinaryPayload(value);
  if (encodedPayload) {
    return encodedPayload;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new OneKeyLocalError('Circular offscreen API payload');
    }
    seen.add(value);
    try {
      const encoded: unknown[] = [];
      for (const item of value) {
        encoded.push(await encodeValue(item, seen));
      }
      return encoded.some((item, index) => item !== value[index])
        ? encoded
        : value;
    } finally {
      seen.delete(value);
    }
  }
  if (!isPlainObject(value)) {
    return value;
  }
  if (seen.has(value)) {
    throw new OneKeyLocalError('Circular offscreen API payload');
  }
  seen.add(value);
  try {
    const entries: [string, unknown][] = [];
    for (const [key, item] of Object.entries(value)) {
      entries.push([key, await encodeValue(item, seen)]);
    }
    return entries.some(([key, item]) => item !== value[key])
      ? Object.fromEntries(entries)
      : value;
  } finally {
    seen.delete(value);
  }
}

function decodeValue(value: unknown): unknown {
  const payload = readBinaryPayload(value);
  if (payload) {
    const bytes = payloadToBytes(payload);
    return payload.type === 'array-buffer' ? bytes.buffer : bytes;
  }
  if (Array.isArray(value)) {
    const decoded = value.map(decodeValue);
    return decoded.some((item, index) => item !== value[index])
      ? decoded
      : value;
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const entries = Object.entries(value).map(
    ([key, item]) => [key, decodeValue(item)] as const,
  );
  return entries.some(([key, item]) => item !== value[key])
    ? Object.fromEntries(entries)
    : value;
}

export async function encodeOffscreenApiPayload(
  value: unknown,
): Promise<unknown> {
  return encodeValue(value, new WeakSet());
}

export function decodeOffscreenApiPayload(value: unknown): unknown {
  return decodeValue(value);
}
