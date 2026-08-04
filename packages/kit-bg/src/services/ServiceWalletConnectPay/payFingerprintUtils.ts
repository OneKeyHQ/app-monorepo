import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IWcPayAction } from '@onekeyhq/shared/src/walletConnect/payTypes';

/**
 * Canonical identity of an action used to match stored progress entries to a
 * freshly fetched action list across app restarts.
 *
 * `walletRpc.params` is itself a JSON string whose key order / whitespace the
 * server may legally vary between fetches. Fingerprinting the raw string
 * would treat such semantically identical actions as different, dropping
 * stored progress and re-broadcasting transactions that were already sent —
 * so the fingerprint is built over the parsed, key-order-normalized
 * structure instead. Unparseable params yield `null`; callers must treat
 * that as "matches nothing" (comparison) or reject the action (persistence).
 */
export function getWcPayActionFingerprint(action: IWcPayAction): string | null {
  const { chainId, method, params } = action.walletRpc;
  let parsedParams: unknown;
  try {
    parsedParams = JSON.parse(params);
  } catch {
    return null;
  }
  return stringUtils.stableStringify({
    chainId,
    method,
    params: parsedParams,
  });
}
