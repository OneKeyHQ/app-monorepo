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
  const earnAccount = EarnData.earnAccount;
  const accountInfo = useActiveAccount({ num: 0 });
  const allNetworkId = useAllNetworkId();
  const evmNetworkId = useMemo(() => getNetworkIdsMap().eth, []);

  const { result, isLoading } = usePromiseResult(
    async () => {
      const totalFiatMapKey = actions.current.buildEarnAccountsKey({
        accountId: accountInfo.activeAccount?.account?.id,
        indexAccountId: accountInfo.activeAccount?.indexedAccount?.id,
        networkId: allNetworkId,
      });
      let list = earnAccount?.[totalFiatMapKey]?.accounts || [];
      if (list.length === 0) {
        const earnAccountOnNetwork =
          await backgroundApiProxy.serviceStaking.fetchAllNetworkAssets({
            accountId: accountInfo.activeAccount?.account?.id ?? '',
            networkId: allNetworkId,
            indexedAccountId: accountInfo.activeAccount?.indexedAccount?.id,
          });
        list = earnAccountOnNetwork.accounts;
      }

      if (list.length > 0) {
        const response =
          await backgroundApiProxy.serviceStaking.fetchInvestmentDetail(
            list.map(({ networkId, accountAddress, publicKey }) => ({
              networkId,
              accountAddress,
              publicKey,
            })),
          );
        const evmAccount = list.find((item) => item.networkId === evmNetworkId);
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
    },
    [
      accountInfo.activeAccount?.account?.id,
      accountInfo.activeAccount?.indexedAccount?.id,
      actions,
      allNetworkId,
      earnAccount,
      evmNetworkId,
    ],
    {
      watchLoading: true,
      // debounced: 1000,
    },
  );

  return { portfolioInfo: result, isLoading };
};
