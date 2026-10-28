import { useCallback, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IEarnTokenItem } from '@onekeyhq/shared/types/staking';

import { normalizeStakeTokenAddress } from '../utils/utils';

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
  const scopeKey = [accountId, networkId, provider, symbol, vault ?? ''].join(
    '|',
  );
  const [selection, setSelection] = useState<{
    scopeKey: string;
    asset: IEarnTokenItem;
  }>();
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      if (!enabled || !accountId || !networkId || !provider || !symbol) {
        return undefined;
      }
      try {
        const response =
          await backgroundApiProxy.serviceStaking.getEarnAssetsList({
            accountId,
            networkId,
            provider,
            symbol,
            vault,
            action: 'unstake',
          });
        return {
          scopeKey,
          status: 'success' as const,
          assets: response.assets,
        };
      } catch {
        return { scopeKey, status: 'error' as const };
      }
    },
    [enabled, accountId, networkId, provider, symbol, vault, scopeKey],
    {
      watchLoading: true,
      undefinedResultIfReRun: true,
      revalidateOnReconnect: true,
    },
  );
  const assets = useMemo(
    () =>
      enabled && result?.scopeKey === scopeKey && result.status === 'success'
        ? result.assets
        : [],
    [enabled, result, scopeKey],
  );
  let status: 'error' | 'empty' | 'ready' | undefined;
  if (enabled && result?.scopeKey === scopeKey) {
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
