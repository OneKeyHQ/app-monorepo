import { useCallback, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IEarnTokenItem } from '@onekeyhq/shared/types/staking';

import { normalizeStakeTokenAddress } from '../utils/utils';

/**
 * 按当前账户和 Vault 加载可取回资产，并保留仍有效的选择。
 * 未加载、查询失败或切换作用域时不返回旧资产，避免用旧输出币报价。
 */
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
  const { result } = usePromiseResult(
    async () => {
      if (!enabled || !accountId || !networkId || !provider || !symbol) {
        return undefined;
      }
      const response =
        await backgroundApiProxy.serviceStaking.getEarnAssetsList({
          accountId,
          networkId,
          provider,
          symbol,
          vault,
          action: 'unstake',
        });
      return { scopeKey, assets: response.assets };
    },
    [enabled, accountId, networkId, provider, symbol, vault, scopeKey],
    { watchLoading: true, undefinedResultIfReRun: true },
  );
  const assets = useMemo(
    () => (enabled && result?.scopeKey === scopeKey ? result.assets : []),
    [enabled, result, scopeKey],
  );
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
  return { assets, selectedAsset, selectAsset };
}
