import { getStarkPublicKey, normalizeStarkPrivateKey } from '.';

import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes } from '@noble/hashes/utils';
import { constants, ec } from 'starknet';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

/**
 * STRK20 viewing key derivation, SNIP profile `account-leaf-v1`.
 *
 * The viewing key is secret material, not a read-only token: it must never be
 * logged, exposed through a dapp RPC, or derived with a caller-supplied domain
 * separator, context, or counter.
 */

export const STRK20_VIEWING_KEY_PROFILE_ID = 'account-leaf-v1';

// Exact, case-sensitive ASCII string fixed by the profile. Deliberately not
// exported: a different separator yields a silently unrecoverable key.
const DOMAIN_SEPARATOR = 'STRK20_ACCOUNT_LEAF_V1';

export const STRK20_DERIVATION_CONTEXT_LENGTH = 116;

const CONTEXT_VERSION = 1;

const ACCOUNT_LEAF_KEY_LENGTH = 32;

const MAX_KDF_COUNTER = 2 ** 32 - 1;

const BIG_0 = BigInt(0);
const BIG_1 = BigInt(1);
const BIG_8 = BigInt(8);
const BIG_255 = BigInt(0xff);

const FELT_PRIME = BigInt(constants.PRIME);

const STARK_CURVE_ORDER = ec.starkCurve.CURVE.n;

// H = floor(n / 2). A canonical viewing key satisfies 1 <= k < H, upper bound
// exclusive.
const STARK_LOWER_HALF_BOUND = STARK_CURVE_ORDER / BigInt(2);

// Candidates at or above this bound are rejected before reducing mod n, which
// is what removes the modulo bias of an unconditional reduction.
const REJECTION_LIMIT = (() => {
  const two256 = BIG_1 << BigInt(256);
  return two256 - (two256 % STARK_CURVE_ORDER);
})();

export type IStrk20DerivationContextParams = {
  chainId: string;
  accountAddress: string;
  poolAddress: string;
  // Reserved for a future pool generation with explicit key rotation; wallets
  // must leave it at 0 while the registered public key is immutable.
  keyIndex?: number;
};

export type IStrk20ViewingKeyDerivationParams =
  IStrk20DerivationContextParams & {
    accountLeafPrivateKey: string;
  };

export type IStrk20ViewingKeyResult = {
  // 0x + 64 hex, canonical Stark scalar in [1, floor(n/2))
  viewingKey: string;
  // 0x + 64 hex x-coordinate of viewingKey * G on the Stark curve
  publicKeyX: string;
  counter: number;
};

/** RFC 8017 I2OSP; fails when the value does not fit in `length` bytes. */
function i2osp(value: bigint, length: number): Uint8Array {
  if (value < BIG_0) {
    throw new OneKeyLocalError('I2OSP: value must be non-negative');
  }
  const bytes = new Uint8Array(length);
  let rest = value;
  for (let i = length - 1; i >= 0; i -= 1) {
    bytes[i] = Number(rest & BIG_255);
    rest >>= BIG_8;
  }
  if (rest !== BIG_0) {
    throw new OneKeyLocalError(`I2OSP: value does not fit in ${length} bytes`);
  }
  return bytes;
}

/** RFC 8017 OS2IP. */
function os2ip(bytes: Uint8Array): bigint {
  let value = BIG_0;
  for (const byte of bytes) {
    value = (value << BIG_8) | BigInt(byte);
  }
  return value;
}

// The 0x prefix is mandatory. starknet.js emits decimal felts in places, and a
// bare decimal string is also valid hex, so accepting both would silently
// derive a different, unrecoverable viewing key.
function parseUnsignedHex(name: string, value: string): bigint {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(value)) {
    throw new OneKeyLocalError(
      `Invalid ${name}: expected a 0x-prefixed hex felt of at most 32 bytes`,
    );
  }
  return BigInt(value);
}

function parseFelt252(name: string, value: string): bigint {
  const parsed = parseUnsignedHex(name, value);
  if (parsed >= FELT_PRIME) {
    throw new OneKeyLocalError(`Invalid ${name}: not a felt252`);
  }
  return parsed;
}

/**
 * 0x + 64 lowercase hex. Same shape as validateAndParseAddress produces, but
 * with no address range check, so it is safe for a curve x-coordinate.
 */
export function toPaddedFeltHex(value: bigint): string {
  return `0x${value.toString(16).padStart(64, '0')}`;
}

/**
 * Fixed-width context: I2OSP(version,4) || I2OSP(chain_id,32) ||
 * I2OSP(account_address,32) || I2OSP(pool_address,32) || I2OSP(key_index,16).
 */
export function serializeDerivationContext(
  params: IStrk20DerivationContextParams,
): Uint8Array {
  const { chainId, accountAddress, poolAddress, keyIndex = 0 } = params;
  if (!Number.isSafeInteger(keyIndex) || keyIndex < 0) {
    throw new OneKeyLocalError(
      'Invalid STRK20 key_index: expected a non-negative integer',
    );
  }
  const parts = [
    i2osp(BigInt(CONTEXT_VERSION), 4),
    i2osp(parseFelt252('chainId', chainId), 32),
    i2osp(parseFelt252('accountAddress', accountAddress), 32),
    i2osp(parseFelt252('poolAddress', poolAddress), 32),
    i2osp(BigInt(keyIndex), 16),
  ];
  const bytes = new Uint8Array(STRK20_DERIVATION_CONTEXT_LENGTH);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

function deriveViewingKeyScalar(params: {
  accountLeafPrivateKeyBe32: Uint8Array;
  contextBytes: Uint8Array;
}): { scalar: bigint; counter: number } {
  const { accountLeafPrivateKeyBe32, contextBytes } = params;
  if (accountLeafPrivateKeyBe32.length !== ACCOUNT_LEAF_KEY_LENGTH) {
    throw new OneKeyLocalError(
      'STRK20 account leaf private key must be exactly 32 bytes',
    );
  }
  if (contextBytes.length !== STRK20_DERIVATION_CONTEXT_LENGTH) {
    throw new OneKeyLocalError(
      `STRK20 derivation context must be exactly ${STRK20_DERIVATION_CONTEXT_LENGTH} bytes`,
    );
  }
  const domain = utf8ToBytes(DOMAIN_SEPARATOR);
  const counterOffset = domain.length + contextBytes.length;
  const data = new Uint8Array(counterOffset + 4);
  data.set(domain, 0);
  data.set(contextBytes, domain.length);
  try {
    for (let counter = 0; counter <= MAX_KDF_COUNTER; counter += 1) {
      data.set(i2osp(BigInt(counter), 4), counterOffset);
      const digest = hmac(sha256, accountLeafPrivateKeyBe32, data);
      const candidate = os2ip(digest);
      digest.fill(0);
      if (candidate < REJECTION_LIMIT) {
        const x = candidate % STARK_CURVE_ORDER;
        if (x !== BIG_0) {
          const negated = STARK_CURVE_ORDER - x;
          const scalar = x < negated ? x : negated;
          if (scalar >= BIG_1 && scalar < STARK_LOWER_HALF_BOUND) {
            return { scalar, counter };
          }
        }
      }
    }
  } finally {
    data.fill(0);
  }
  throw new OneKeyLocalError(
    'STRK20 viewing key derivation exhausted the KDF counter',
  );
}

/**
 * Public viewing key registered by the pool: the padded x-coordinate of
 * `viewingKey * G`.
 */
export function getStrk20PublicViewingKey(viewingKey: string): string {
  const scalar = parseUnsignedHex('viewingKey', viewingKey);
  if (scalar < BIG_1 || scalar >= STARK_LOWER_HALF_BOUND) {
    throw new OneKeyLocalError(
      'Invalid STRK20 viewing key: outside the canonical range [1, floor(n/2))',
    );
  }
  // getStarkKey strips leading zeros; pad so recovery can compare the value
  // byte-exactly against the pool's registered public key.
  return toPaddedFeltHex(BigInt(getStarkPublicKey(toPaddedFeltHex(scalar))));
}

export function deriveStrk20ViewingKey(
  params: IStrk20ViewingKeyDerivationParams,
): IStrk20ViewingKeyResult {
  // Only Stark-curve leaves reach this code: HD child keys are ground into the
  // Stark order and imported credentials already hold a Stark private key. A
  // secp256k1 leaf would need a range check against that curve's own order.
  const normalizedLeaf = normalizeStarkPrivateKey(params.accountLeafPrivateKey);
  const accountLeafPrivateKeyBe32 = i2osp(
    BigInt(normalizedLeaf),
    ACCOUNT_LEAF_KEY_LENGTH,
  );
  const contextBytes = serializeDerivationContext(params);
  try {
    const { scalar, counter } = deriveViewingKeyScalar({
      accountLeafPrivateKeyBe32,
      contextBytes,
    });
    const viewingKey = toPaddedFeltHex(scalar);
    return {
      viewingKey,
      publicKeyX: getStrk20PublicViewingKey(viewingKey),
      counter,
    };
  } finally {
    accountLeafPrivateKeyBe32.fill(0);
  }
}

export default {
  STRK20_DERIVATION_CONTEXT_LENGTH,
  STRK20_VIEWING_KEY_PROFILE_ID,
  deriveStrk20ViewingKey,
  getStrk20PublicViewingKey,
  serializeDerivationContext,
  toPaddedFeltHex,
};
