import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { privacyChainAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ILocalWalletPoolDescriptor,
  ILocalWalletSendPool,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { POLLING_INTERVAL_FOR_TOKEN } from '@onekeyhq/shared/src/consts/walletConsts';

// Disabled options remain visible but can never become a transaction source.
export function getDefaultLocalWalletSendPool({
  pools,
  preferredPool,
}: {
  pools: ILocalWalletSendPool[];
  preferredPool?: string;
}): ILocalWalletSendPool | undefined {
  const selectable = pools.filter(
    (pool) => pool.eligible !== false && !pool.disabledReason,
  );
  if (preferredPool !== undefined) {
    return selectable.find((pool) => pool.key === preferredPool);
  }
  return selectable.find((pool) => pool.isDefault) ?? selectable[0];
}

// The page the send starts from limits the source: a public pool's page pays
// only from it; a private pool's page offers that pool and, if the user picks
// it, the public one. Without an entry pool every eligible pool is offered
// except old ones, which are reached only from their own entry.
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
  if (!entry) {
    const oldPools = new Set(
      descriptors
        .filter((pool) => pool.receivesFunds === false)
        .map((pool) => pool.key),
    );
    return pools.filter((pool) => !oldPools.has(pool.key));
  }
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
  const networkPausedAtom = useMemo(
    () =>
      selectAtom(privacyChainAtom.atom(), (value) =>
        value.pausedNetworkIds.includes(networkId),
      ),
    [networkId],
  );
  const isNetworkPaused = useAtomValue(networkPausedAtom);
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
      // A failed poll keeps the last pools; the scope check below still hides
      // another account's or recipient's result.
      pollingInterval: POLLING_INTERVAL_FOR_TOKEN,
      revalidateOnFocus: true,
    },
  );
  // A prior account/destination response must not supply the balance or allow submit while the new request is pending.
  const currentResult = enabled && result?.scope === scope ? result : undefined;
  // Network pause is independent of the selected source's readiness; Public
  // sends have no private-sync gate but must still show Private as paused.
  const sourcePools = useMemo(
    () =>
      currentResult?.pools?.map((pool) =>
        isNetworkPaused &&
        poolDescriptors?.some(
          (descriptor) =>
            descriptor.key === pool.key && descriptor.source === 'localScan',
        )
          ? { ...pool, disabledReason: 'paused' as const }
          : pool,
      ),
    [currentResult?.pools, isNetworkPaused, poolDescriptors],
  );
  const poolOptions = useMemo(
    () =>
      sourcePools
        ? getEntryLocalWalletSendPools({
            pools: sourcePools.filter((pool) => pool.eligible !== false),
            entryPool: initialPool,
            descriptors: poolDescriptors ?? [],
          })
        : undefined,
    [sourcePools, initialPool, poolDescriptors],
  );
  const pools = useMemo(
    () => poolOptions?.filter((pool) => !pool.disabledReason),
    [poolOptions],
  );
  let preferredPool = pools?.some((pool) => pool.key === initialPool)
    ? initialPool
    : undefined;
  if (selection?.scope === scope) preferredPool = selection.key;
  // An unavailable private entry leaves the source to the user; one listed
  // but ineligible for the recipient (TEX) falls back to the default.
  const isEntryPoolMissing =
    !!poolDescriptors?.some((pool) => pool.key === initialPool) &&
    !!sourcePools &&
    !sourcePools.some(
      (pool) =>
        pool.key === initialPool &&
        (!pool.disabledReason || pool.eligible === false),
    );
  const selectedPool =
    pools && (selection?.scope === scope || !isEntryPoolMissing)
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
    poolOptions,
    selectedPool,
    selectPool,
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
