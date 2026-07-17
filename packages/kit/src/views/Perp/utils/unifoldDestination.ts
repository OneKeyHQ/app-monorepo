// cspell: words hypercore unifold Unifold
import type { DestinationToken } from '@unifold/core';

// Remote config only has VETO power: a mismatch disables the Unifold entry, it
// can never rewrite the hardcoded destination. This defends against a
// compromised or config-poisoned remote silently redirecting deposits to a
// different chain/token. Empty/undefined remote data fails closed.
export function validateHypercoreDestination(
  remoteTokens: DestinationToken[] | undefined,
  expected: { chainId: string; tokenAddress: string },
): boolean {
  if (!remoteTokens?.length) {
    return false;
  }
  return remoteTokens.some((token) =>
    (token.chains ?? []).some(
      (chain) =>
        chain.chain_id === expected.chainId &&
        (chain.token_address || '').toLowerCase() ===
          expected.tokenAddress.toLowerCase(),
    ),
  );
}
