import { Buffer } from 'buffer';

import {
  HARDWARE_CLOUD_SYNC_KEK_SALT_LINE,
  HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX,
} from '../consts/hardwareCloudSyncConsts';
import { OneKeyLocalError } from '../errors/errors/localError';

const RESERVED_REQUEST_ERROR =
  'OneKey Cloud key operations are unavailable to external signing requests';
const IDENTITY_LENGTH = 16;
const SALT_LENGTH = 32;
// prefix | identity hex | "\nKey: " | salt hex
const IDENTITY_START = HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX.length;
const SALT_LINE_START = IDENTITY_START + IDENTITY_LENGTH;
const SALT_START = SALT_LINE_START + HARDWARE_CLOUD_SYNC_KEK_SALT_LINE.length;
const MESSAGE_LENGTH = SALT_START + SALT_LENGTH;

type IMessageEncoding = 'utf8' | 'hex';

function expectedCharAt(index: number): string | undefined {
  if (index < IDENTITY_START) {
    return HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX[index];
  }
  if (index >= SALT_LINE_START && index < SALT_START) {
    return HARDWARE_CLOUD_SYNC_KEK_SALT_LINE[index - SALT_LINE_START];
  }
  // Identity and salt positions: lowercase hex.
  return undefined;
}

function isReservedBytes(message: ArrayLike<unknown>): boolean {
  if (message.length !== MESSAGE_LENGTH) return false;
  for (let index = 0; index < MESSAGE_LENGTH; index += 1) {
    const byte = message[index];
    if (typeof byte !== 'number') return false;
    const expected = expectedCharAt(index);
    if (expected !== undefined) {
      if (byte !== expected.charCodeAt(0)) return false;
    } else if (!((byte >= 48 && byte <= 57) || (byte >= 97 && byte <= 102))) {
      return false;
    }
  }
  return true;
}

function isReservedText(message: string): boolean {
  if (message.length !== MESSAGE_LENGTH) return false;
  return isReservedBytes(Array.from(message, (char) => char.charCodeAt(0)));
}

/**
 * Compare the actual protocol message, not arbitrary RPC metadata. Callers must
 * select the encoding the signer uses; JSON/hex/base64 literals are not decoded
 * recursively. Exact length checks bound decoding to the 185-byte contract.
 */
export function assertNoHardwareCloudSyncSigningRequest(
  message: unknown,
  encoding: IMessageEncoding = 'utf8',
): void {
  let reserved = false;
  if (typeof message === 'string') {
    if (encoding === 'utf8') {
      reserved = isReservedText(message);
    } else if (encoding === 'hex') {
      const prefixLength = message.startsWith('0x') ? 2 : 0;
      if (message.length === MESSAGE_LENGTH * 2 + prefixLength) {
        const hex = message.slice(prefixLength);
        if (/^[0-9a-f]+$/i.test(hex))
          reserved = isReservedBytes(Buffer.from(hex, 'hex'));
      }
    }
  } else if (message instanceof ArrayBuffer) {
    if (message.byteLength === MESSAGE_LENGTH)
      reserved = isReservedBytes(new Uint8Array(message));
  } else if (ArrayBuffer.isView(message)) {
    if (message.byteLength === MESSAGE_LENGTH)
      reserved = isReservedBytes(
        new Uint8Array(message.buffer, message.byteOffset, message.byteLength),
      );
  } else if (Array.isArray(message)) {
    reserved = isReservedBytes(message);
  }
  if (reserved) throw new OneKeyLocalError(RESERVED_REQUEST_ERROR);
}
