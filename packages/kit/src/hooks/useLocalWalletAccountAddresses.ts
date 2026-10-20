import { useEffect, useState } from 'react';

import type { IPrivacyChainAccountAddresses } from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

// The account's addresses from the same source as the Receive and token
// details pages, so history shows this account's side identically. Disabled,
// it neither requests nor re-renders.
export function useLocalWalletAccountAddresses({
  accountId,
  networkId,
  enabled,
}: {
  accountId?: string;
  networkId?: string;
  enabled: boolean;
}): IPrivacyChainAccountAddresses | null | undefined {
  const [state, setState] = useState<{
    key: string;
    addresses: IPrivacyChainAccountAddresses | null;
  }>();
  const key = `${networkId ?? ''}:${accountId ?? ''}`;
  useEffect(() => {
    if (!enabled || !accountId || !networkId) return;
    let alive = true;
    void backgroundApiProxy.servicePrivacyChain
      .getLocalWalletAccountAddresses({ networkId, accountId })
      .catch(() => undefined)
      .then((addresses) => {
        if (alive) setState({ key, addresses: addresses ?? null });
      });
    return () => {
      alive = false;
    };
  }, [enabled, accountId, networkId, key]);
  return enabled && state?.key === key ? state.addresses : undefined;
}
