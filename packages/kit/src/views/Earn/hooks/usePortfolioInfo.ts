import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

import { useAllNetworkId } from './useAllNetworkId';

export const usePortfolioInfo = () => {
  const [EarnData] = useEarnAtom();
  const actions = useEarnActions();
  const accountInfo = useActiveAccount({ num: 0 });
  const allNetworkId = useAllNetworkId();
  const evmNetworkId = useMemo(() => getNetworkIdsMap().eth, []);

  const totalFiatMapKey = useMemo(() => {
    return actions.current.buildEarnAccountsKey({
      accountId: accountInfo.activeAccount?.account?.id,
      indexAccountId: accountInfo.activeAccount?.indexedAccount?.id,
      networkId: allNetworkId,
    });
  }, [
    actions,
    accountInfo.activeAccount?.account?.id,
    accountInfo.activeAccount?.indexedAccount?.id,
    allNetworkId,
  ]);

  const { result, isLoading: isPortfolioLoading } = usePromiseResult(
    async () => {
      const earnAccount =
        EarnData.earnAccount?.[totalFiatMapKey]?.accounts || [];
      if (earnAccount.length > 0) {
        const response =
          await backgroundApiProxy.serviceStaking.fetchInvestmentDetail(
            earnAccount.map(({ networkId, accountAddress, publicKey }) => ({
              networkId,
              accountAddress,
              publicKey,
            })),
          );
        const evmAccount = earnAccount.find(
          (item) => item.networkId === evmNetworkId,
        );
        // XXX
        if (evmAccount) {
          const earnSummary =
            await backgroundApiProxy.serviceStaking.getEarnSummary(evmAccount);
          return {
            evmAccount,
            earnSummary,
            earnInvestmentItems: response,
          };
        }
        return {
          earnSummary: undefined,
          evmAccount: undefined,
          earnInvestmentItems: response,
        };
      }

      return {
        earnSummary: undefined,
        evmAccount: undefined,
        earnInvestmentItems: [],
      };
    },
    [evmNetworkId, EarnData.earnAccount, totalFiatMapKey],
    {
      watchLoading: true,
    },
  );

  return { portfolioInfo: result, isPortfolioLoading };
};
