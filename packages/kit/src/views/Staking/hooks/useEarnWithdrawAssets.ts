import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IEarnTokenItem } from '@onekeyhq/shared/types/staking';

import { normalizeStakeTokenAddress } from '../utils/utils';

import { useCommittedEarnScopeGuard } from './useCommittedEarnScopeGuard';

export function useEarnWithdrawAssets({
  enabled,
  accountId,
  networkId,
  provider,
  symbol,
  vault,
}: {
  enabled: boolean;
  accountId: string;
  networkId: string;
  provider: string;
  symbol: string;
  vault?: string;
}) {
  const scopeKey = JSON.stringify([
    enabled,
    accountId,
    networkId,
    provider,
    symbol,
    vault ?? '',
  ]);
  const scopeGuard = useCommittedEarnScopeGuard(scopeKey);
  const requestScope = useMemo(
    () => ({
      enabled,
      accountId,
      networkId,
      provider,
      symbol,
      vault,
      scopeKey,
      scopeGuard,
    }),
    [
      enabled,
      accountId,
      networkId,
      provider,
      symbol,
      vault,
      scopeKey,
      scopeGuard,
    ],
  );
  const committedScopeRef = useRef(requestScope);
  useLayoutEffect(() => {
    committedScopeRef.current = requestScope;
  }, [requestScope]);
  const [selection, setSelection] = useState<{
    scopeKey: string;
    asset: IEarnTokenItem;
  }>();
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      const currentScope =
        requestScope === committedScopeRef.current
          ? requestScope
          : committedScopeRef.current;
      if (
        !currentScope.enabled ||
        !currentScope.accountId ||
        !currentScope.networkId ||
        !currentScope.provider ||
        !currentScope.symbol
      ) {
        return undefined;
      }
      const isCurrentScope = currentScope.scopeGuard.capture();
      if (!isCurrentScope()) return undefined;
      try {
        const response =
          await backgroundApiProxy.serviceStaking.getEarnAssetsList({
            accountId: currentScope.accountId,
            networkId: currentScope.networkId,
            provider: currentScope.provider,
            symbol: currentScope.symbol,
            vault: currentScope.vault,
            action: 'unstake',
          });
        return {
          scopeKey: currentScope.scopeKey,
          isCurrentScope,
          status: 'success' as const,
          assets: response.assets,
        };
      } catch {
        return {
          scopeKey: currentScope.scopeKey,
          isCurrentScope,
          status: 'error' as const,
        };
      }
    },
    [requestScope],
    {
      watchLoading: true,
      undefinedResultIfReRun: true,
      revalidateOnReconnect: true,
      resumeOnEffectReconnect: true,
    },
  );
  const assets = useMemo(
    () =>
      enabled &&
      result?.scopeKey === scopeKey &&
      result.isCurrentScope() &&
      result.status === 'success'
        ? result.assets
        : [],
    [enabled, result, scopeKey],
  );
  let status: 'error' | 'empty' | 'ready' | undefined;
  if (enabled && result?.scopeKey === scopeKey && result.isCurrentScope()) {
    if (result.status === 'error') {
      status = 'error';
    } else {
      status = result.assets.length === 0 ? 'empty' : 'ready';
    }
  }
  const selectedAsset = useMemo(() => {
    const selected =
      selection?.scopeKey === scopeKey ? selection.asset : undefined;
    return (
      assets.find(
        (asset) =>
          selected &&
          normalizeStakeTokenAddress(asset.info) ===
            normalizeStakeTokenAddress(selected.info) &&
          asset.info.symbol.toLowerCase() ===
            selected.info.symbol.toLowerCase(),
      ) ?? assets[0]
    );
  }, [assets, scopeKey, selection]);
  const selectAsset = useCallback(
    (asset: IEarnTokenItem) => setSelection({ scopeKey, asset }),
    [scopeKey],
  );
  return { assets, selectedAsset, selectAsset, status, isLoading, retry: run };
}
