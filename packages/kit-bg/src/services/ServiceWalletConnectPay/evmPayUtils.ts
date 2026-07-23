import { OneKeyError } from '@onekeyhq/shared/src/errors';

/**
 * EVM message-param extractors shared by the up-front action-list validator
 * (ServiceWalletConnectPay) and the action executor (useWcPayActionExecutor).
 * Both sides MUST accept exactly the same inputs: the validator runs before
 * any signing, and a shape the validator passes but the executor rejects (or
 * resolves differently) would fail mid-sequence — after an earlier action may
 * already have broadcast a transaction.
 */

/**
 * Extract the typed-data payload from `eth_signTypedData_v4` params.
 * Params are usually `[address, typedData]`; the typed data is the first
 * element that is a JSON-object string or a plain (non-array) object.
 */
export function extractWcPayTypedDataMessage(parsed: unknown): string {
  const candidates = Array.isArray(parsed) ? parsed : [parsed];
  const candidate = candidates.find(
    (item) =>
      (typeof item === 'string' && item.trim().startsWith('{')) ||
      (typeof item === 'object' && item !== null && !Array.isArray(item)),
  );
  if (candidate === undefined) {
    throw new OneKeyError('Invalid eth_signTypedData_v4 params');
  }
  return typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
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
  throw new OneKeyError('Invalid personal_sign params');
}
