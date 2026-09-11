import { useCallback, useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { ILocalWalletSendPool } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { POLLING_INTERVAL_FOR_TOKEN } from '@onekeyhq/shared/src/consts/walletConsts';

// The chain vault returns only the pools that can pay the recipient and marks
// the recommended one; this hook only remembers the user's choice.
export function getDefaultLocalWalletSendPool({
  pools,
  preferredPool,
}: {
  pools: ILocalWalletSendPool[];
  preferredPool?: string;
}): ILocalWalletSendPool | undefined {
  if (preferredPool !== undefined) {
    return pools.find((pool) => pool.key === preferredPool);
  }
  return pools.find((pool) => pool.isDefault) ?? pools[0];
}

export function useLocalWalletSendPool({
  enabled,
  accountId,
  networkId,
  recipientAddress,
  initialPool,
}: {
  enabled: boolean;
  accountId: string;
  networkId: string;
  recipientAddress: string;
  initialPool?: string;
}) {
  const scope = useMemo(
    () => JSON.stringify([accountId, networkId, recipientAddress]),
    [accountId, networkId, recipientAddress],
  );
  const [selection, setSelection] = useState<{
    scope: typeof scope;
    key: string;
  }>();
  const { result } = usePromiseResult(
    async () => {
      if (!enabled) return undefined;
      const pools =
        await backgroundApiProxy.servicePrivacyChain.getLocalWalletSendPools({
          accountId,
          networkId,
          toAddress: recipientAddress,
        });
      return { scope, pools };
    },
    [enabled, accountId, networkId, recipientAddress, scope],
    {
      undefinedResultIfError: true,
      pollingInterval: POLLING_INTERVAL_FOR_TOKEN,
      revalidateOnFocus: true,
    },
  );
  // A prior account/destination response must never supply the new balance
  // or permit submission while the replacement request is still pending.
  const currentResult = enabled && result?.scope === scope ? result : undefined;
  const pools = useMemo(
    () => currentResult?.pools?.filter((pool) => pool.eligible !== false),
    [currentResult?.pools],
  );
  const preferredPool =
    selection?.scope === scope ? selection.key : initialPool;
  const selectedPool = pools
    ? getDefaultLocalWalletSendPool({
        pools,
        preferredPool,
      })
    : undefined;
  useEffect(() => {
    // Freeze even the initial default: a balance refresh is not permission to
    // spend from another pool after the user has started entering an amount.
    if (selectedPool && selection?.scope !== scope) {
      setSelection({ scope, key: selectedPool.key });
    }
  }, [scope, selectedPool, selection?.scope]);
  const selectPool = useCallback(
    (value: string | number) => {
      const pool = pools?.find((item) => item.key === value);
      if (pool) setSelection({ scope, key: pool.key });
    },
    [pools, scope],
  );

  return {
    pools,
    selectedPool,
    selectPool,
    isReady:
      !enabled ||
      (!!currentResult &&
        ((pools === undefined && preferredPool === undefined) ||
          selectedPool !== undefined)),
  };
}
