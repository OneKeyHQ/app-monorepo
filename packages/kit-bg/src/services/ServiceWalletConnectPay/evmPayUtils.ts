import {
  EWcPayErrorCode,
  WcPayError,
} from '@onekeyhq/shared/src/walletConnect/payErrors';

/**
 * EVM message-param extractors shared by the up-front action-list validator
 * (ServiceWalletConnectPay) and the action executor (useWcPayActionExecutor).
 * Both sides MUST accept exactly the same inputs: the validator runs before
 * any signing, and a shape the validator passes but the executor rejects (or
 * resolves differently) would fail mid-sequence — after an earlier action may
 * already have broadcast a transaction.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Minimal structural requirements of an EIP-712 v4 payload on the signing
 * path: hashing needs `types` carrying both the `EIP712Domain` and
 * `primaryType` field lists, plus plain-object `domain` and `message`.
 * Anything missing here would only fail later — at display, hash, or sign
 * time — after a preceding action may already have broadcast a transaction.
 */
function isMinimalEip712TypedData(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }
  const { types, domain, message, primaryType } = value;
  return (
    isPlainObject(types) &&
    isPlainObject(domain) &&
    isPlainObject(message) &&
    typeof primaryType === 'string' &&
    primaryType.length > 0 &&
    Array.isArray(types.EIP712Domain) &&
    Array.isArray(types[primaryType])
  );
}

/**
 * Extract the typed-data payload from `eth_signTypedData_v4` params.
 * Params are usually `[address, typedData]`; the typed data is the first
 * element that actually parses to (or already is) an object with the minimal
 * EIP-712 structure. String candidates are really parsed — a "{"-prefixed
 * string that is not valid JSON must be rejected here, not midway through
 * the signing sequence.
 */
export function extractWcPayTypedDataMessage(parsed: unknown): string {
  const candidates = Array.isArray(parsed) ? parsed : [parsed];
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim().startsWith('{')) {
      let candidate: unknown;
      try {
        candidate = JSON.parse(item);
      } catch {
        candidate = undefined;
      }
      if (isMinimalEip712TypedData(candidate)) {
        return item;
      }
    } else if (isMinimalEip712TypedData(item)) {
      return JSON.stringify(item);
    }
  }
  throw new WcPayError({
    code: EWcPayErrorCode.InvalidActionParams,
    message: 'Invalid eth_signTypedData_v4 params',
  });
}

/**
 * Extract the message from `personal_sign` params. Convention is
 * `[message, address]`, but some senders flip the order; the account address
 * only disambiguates which element is the message, so the set of accepted
 * shapes is identical whether or not it is provided (validation time has no
 * resolved account yet).
 */
export function extractWcPayPersonalSignMessage({
  parsed,
  accountAddress,
}: {
  parsed: unknown;
  accountAddress?: string;
}): string {
  if (Array.isArray(parsed)) {
    const [first, second] = parsed as unknown[];
    if (
      typeof first === 'string' &&
      accountAddress &&
      first.toLowerCase() === accountAddress.toLowerCase() &&
      typeof second === 'string'
    ) {
      return second;
    }
    if (typeof first === 'string') {
      return first;
    }
  }
  if (typeof parsed === 'string') {
    return parsed;
  }
  throw new WcPayError({
    code: EWcPayErrorCode.InvalidActionParams,
    message: 'Invalid personal_sign params',
  });
}
