import { Buffer } from 'buffer';

import { HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX } from '../consts/hardwareCloudSyncConsts';
import { OneKeyLocalError } from '../errors/errors/localError';

const RESERVED_REQUEST_ERROR =
  'OneKey Cloud key operations are unavailable to external signing requests';
const HARDENED = 2_147_483_648;
const IDENTITY_LENGTH = 16;
const MESSAGE_LENGTH =
  HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX.length + IDENTITY_LENGTH;

type IMessageEncoding = 'utf8' | 'hex';

/** Identifies the Cloud derivation path; ordinary accounts may share this path. */
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
  return /(?:^|[^0-9])(?:m\/)?0*44['h]\/0+['h]\/0*100['h](?:\/|$)/i.test(
    value.replace(/\s/g, ''),
  );
}

function isReservedText(message: string): boolean {
  return (
    message.length === MESSAGE_LENGTH &&
    message.startsWith(HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX) &&
    /^[0-9a-f]{16}$/.test(message.slice(-IDENTITY_LENGTH))
  );
}

function isReservedBytes(message: ArrayLike<unknown>): boolean {
  if (message.length !== MESSAGE_LENGTH) return false;
  for (let index = 0; index < MESSAGE_LENGTH; index += 1) {
    const byte = message[index];
    if (typeof byte !== 'number') return false;
    if (index < HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX.length) {
      if (byte !== HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX.charCodeAt(index))
        return false;
    } else if (!((byte >= 48 && byte <= 57) || (byte >= 97 && byte <= 102))) {
      return false;
    }
  }
  return true;
}

/**
 * Compare the actual protocol message, not arbitrary RPC metadata. Callers must
 * select the encoding the signer uses; JSON/hex/base64 literals are not decoded
 * recursively. Exact length checks bound decoding to the 113-byte contract.
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
