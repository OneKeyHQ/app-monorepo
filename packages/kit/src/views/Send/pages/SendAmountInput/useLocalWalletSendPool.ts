import { useCallback, useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  ILocalWalletPoolDescriptor,
  ILocalWalletSendPool,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
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

// The page the send starts from limits the source: a public pool's page pays
// only from it; a private pool's page offers that pool and, if the user picks
// it, the public one. Without an entry pool every eligible pool is offered.
export function getEntryLocalWalletSendPools({
  pools,
  entryPool,
  descriptors,
}: {
  pools: ILocalWalletSendPool[];
  entryPool?: string;
  descriptors: ILocalWalletPoolDescriptor[];
}): ILocalWalletSendPool[] {
  const entry = descriptors.find((pool) => pool.key === entryPool);
  if (!entry) return pools;
  const allowed = new Set(
    entry.kind === 'public'
      ? [entry.key]
      : [
          entry.key,
          ...descriptors
            .filter((pool) => pool.kind === 'public')
            .map((pool) => pool.key),
        ],
  );
  return pools.filter((pool) => allowed.has(pool.key));
}

export function useLocalWalletSendPool({
  enabled,
  accountId,
  networkId,
  recipientAddress,
  initialPool,
  poolDescriptors,
}: {
  enabled: boolean;
  accountId: string;
  networkId: string;
  recipientAddress: string;
  initialPool?: string;
  poolDescriptors?: ILocalWalletPoolDescriptor[];
}) {
  const scope = useMemo(
    () => JSON.stringify([accountId, networkId, recipientAddress]),
    [accountId, networkId, recipientAddress],
  );
  const [selection, setSelection] = useState<{
    scope: typeof scope;
    key: string;
  }>();
  const { result, run } = usePromiseResult(
    async () => {
      if (!enabled) return undefined;
      const [pools, state] = await Promise.all([
        backgroundApiProxy.servicePrivacyChain.getLocalWalletSendPools({
          accountId,
          networkId,
          toAddress: recipientAddress,
        }),
        backgroundApiProxy.servicePrivacyChain
          .getLocalWalletAccountState({ accountId, networkId })
          .catch(() => undefined),
      ]);
      return { scope, pools, isPrivacyPaused: state?.paused === true };
    },
    [enabled, accountId, networkId, recipientAddress, scope],
    {
      // A failed poll keeps the last pools; the scope check below still hides
      // another account's or recipient's result.
      pollingInterval: POLLING_INTERVAL_FOR_TOKEN,
      revalidateOnFocus: true,
    },
  );
  // A prior account/destination response must never supply the new balance
  // or permit submission while the replacement request is still pending.
  const currentResult = enabled && result?.scope === scope ? result : undefined;
  const pools = useMemo(
    () =>
      currentResult?.pools
        ? getEntryLocalWalletSendPools({
            pools: currentResult.pools.filter(
              (pool) => pool.eligible !== false,
            ),
            entryPool: initialPool,
            descriptors: poolDescriptors ?? [],
          })
        : undefined,
    [currentResult?.pools, initialPool, poolDescriptors],
  );
  let preferredPool = pools?.some((pool) => pool.key === initialPool)
    ? initialPool
    : undefined;
  if (selection?.scope === scope) preferredPool = selection.key;
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
    // Paused privacy hides the private pools; the page says why they are gone.
    isPrivacyPaused: currentResult?.isPrivacyPaused === true,
    // The selected pool's balance could not be read; the page offers a retry.
    isBalanceUnavailable:
      !!selectedPool && selectedPool.spendableParsed === undefined,
    reload: run,
    isReady:
      !enabled ||
      (!!currentResult &&
        ((pools === undefined && preferredPool === undefined) ||
          selectedPool?.spendableParsed !== undefined)),
  };
}
