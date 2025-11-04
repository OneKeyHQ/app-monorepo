import { useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IEarnInvestmentItemV2 } from '@onekeyhq/shared/types/staking';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

import { useAllNetworkId } from './useAllNetworkId';

export const useEarnData = () => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const allNetworkId = useAllNetworkId();
  const [investments, setInvestments] = useState<IEarnInvestmentItemV2[]>([]);
  const [earnTotalFiatValue, setEarnTotalFiatValue] = useState<BigNumber>(
    new BigNumber(0),
  );
  const [earnings24h, setEarnings24h] = useState<BigNumber>(new BigNumber(0));

  usePromiseResult(
    async () => {
      if (!account && !indexedAccount) {
        return;
      }

      const assets =
        await backgroundApiProxy.serviceStaking.getAvailableAssetsV2();
      const accounts =
        await backgroundApiProxy.serviceStaking.getEarnAvailableAccountsParams({
          accountId: account?.id ?? '',
          networkId: allNetworkId,
          indexedAccountId: account?.indexedAccountId || indexedAccount?.id,
        });

      const list = accounts.flatMap((item) => {
        const accountAssets = assets.filter(
          (asset) => asset.networkId === item.networkId,
        );
        return accountAssets.map((asset) => ({
          accountAddress: item.accountAddress,
          networkId: item.networkId,
          provider: asset.provider,
          symbol: asset.symbol,
          ...(asset.vault && { vault: asset.vault }),
          ...(item.publicKey && { publicKey: item.publicKey }),
        }));
      });

      const getInvestmentKey = (item: {
        provider: string;
        symbol: string;
        vault?: string;
        networkId: string;
      }) =>
        `${item.provider}_${item.symbol}_${item.vault || ''}_${item.networkId}`;

      const uniqueList = Array.from(
        list
          .reduce((map, item) => {
            const key = getInvestmentKey(item);
            if (!map.has(key)) {
              map.set(key, item);
            }
            return map;
          }, new Map())
          .values(),
      );

      const investmentMap = new Map<string, IEarnInvestmentItemV2>();
      setInvestments([]);
      setEarnTotalFiatValue(new BigNumber(0));
      setEarnings24h(new BigNumber(0));

      const promises = uniqueList.map(async (item) => {
        try {
          const result =
            await backgroundApiProxy.serviceStaking.fetchInvestmentDetailV2(
              item,
            );

          const key = getInvestmentKey({
            provider: result.protocol.providerDetail.code,
            symbol: result.assets?.[0]?.token.info.symbol || '',
            vault: result.protocol.vaultName,
            networkId: result.network.networkId,
          });

          const fiatValue = new BigNumber(result.totalFiatValue || '0');
          if (fiatValue.gt(0)) {
            investmentMap.set(key, result);
            const sorted = Array.from(investmentMap.values()).sort((a, b) => {
              const valueA = new BigNumber(a.totalFiatValue || '0');
              const valueB = new BigNumber(b.totalFiatValue || '0');
              return valueB.comparedTo(valueA);
            });
            setInvestments(sorted);
            setEarnTotalFiatValue((prev) => prev.plus(fiatValue));
          }

          return result;
        } catch (error) {
          return null;
        }
      });

      await Promise.allSettled(promises);
    },
    [account, allNetworkId, indexedAccount],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 3 }),
      revalidateOnReconnect: true,
      alwaysSetState: true,
    },
  );

  const aggregatedInvestments = useMemo(() => {
    const protocolMap = new Map<string, IEarnInvestmentItemV2>();

    investments.forEach((investment) => {
      const symbol = investment.assets?.[0]?.token.info.symbol || '';
      const protocolKey = `${
        investment.protocol.providerDetail.code
      }_${symbol}_${investment.protocol.vaultName || ''}_${
        investment.network.networkId
      }`;

      const existing = protocolMap.get(protocolKey);
      if (existing) {
        existing.assets = [...existing.assets, ...investment.assets];
        const existingTotal = new BigNumber(existing.totalFiatValue || '0');
        const newTotal = new BigNumber(investment.totalFiatValue || '0');
        existing.totalFiatValue = existingTotal.plus(newTotal).toFixed();
      } else {
        protocolMap.set(protocolKey, { ...investment });
      }
    });

    return Array.from(protocolMap.values());
  }, [investments]);

  return {
    investments: aggregatedInvestments,
    earnings24h,
    earnTotalFiatValue,
  };
};
