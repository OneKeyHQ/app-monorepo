import { IMPL_ZCASH } from '../engine/engineConsts';

import networkUtils from './networkUtils';

import type { IDecodedTxActionAssetTransfer } from '../../types/tx';

// Local-wallet chains put pool labels or private addresses into history
// address fields. Only public addresses may be shown in a transaction's
// public flow. One pattern per chain impl, registered here; the renderers
// never inspect the chain themselves.
const PRIVACY_CHAIN_PUBLIC_ADDRESS_PATTERNS: Record<string, RegExp> = {
  [IMPL_ZCASH]: /^t[13][1-9A-HJ-NP-Za-km-z]{33}$/,
};

export function getPrivacyChainPublicDisplayAddress({
  networkId,
  address,
}: {
  networkId: string;
  address?: string;
}): string {
  const pattern =
    PRIVACY_CHAIN_PUBLIC_ADDRESS_PATTERNS[
      networkUtils.getNetworkImpl({ networkId })
    ];
  if (!pattern) {
    return address ?? '';
  }
  return address && pattern.test(address) ? address : '';
}

export function getPrivacyChainPublicDisplayFlow({
  networkId,
  transfer,
}: {
  networkId: string;
  transfer?: IDecodedTxActionAssetTransfer;
}): { from: string[]; to: string[] } {
  // Use transfer endpoints only. The decoded signer/owner can identify the
  // account by its public address without spending any public funds.
  const entries = [...(transfer?.sends ?? []), ...(transfer?.receives ?? [])];
  const publicAddress = (address?: string) =>
    getPrivacyChainPublicDisplayAddress({ networkId, address });
  const addresses = (direction: 'from' | 'to'): string[] => {
    const endpoint = transfer?.[direction];
    // Pool projections may use a public account identifier in entries.
    // An explicit private endpoint must take precedence over those entries.
    if (endpoint && !publicAddress(endpoint)) return [];
    return [
      ...new Set([
        transfer?.[direction],
        ...entries.map((entry) => entry[direction]),
      ]),
    ]
      .map(publicAddress)
      .filter(Boolean);
  };
  return { from: addresses('from'), to: addresses('to') };
}

// Error codes a local-wallet vault raises when a broadcast's outcome is still
// unknown, so account-level operations must wait. One list, chain entries
// registered here.
const PRIVACY_CHAIN_UNRESOLVED_BROADCAST_CODES = new Set<string>([
  'UNRESOLVED_ZCASH_BROADCAST',
  'BROADCAST_OUTCOME_UNKNOWN',
]);

export function isUnresolvedPrivacyChainBroadcastError(
  error: unknown,
): boolean {
  if (!error || typeof error !== 'object') return false;
  const errorLike = error as {
    code?: unknown;
    data?: { code?: unknown; data?: { code?: unknown } };
  };
  return [
    errorLike.code,
    errorLike.data?.code,
    errorLike.data?.data?.code,
  ].some(
    (code) =>
      typeof code === 'string' &&
      PRIVACY_CHAIN_UNRESOLVED_BROADCAST_CODES.has(code),
  );
}
