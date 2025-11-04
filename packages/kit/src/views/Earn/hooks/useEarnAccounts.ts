import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useEarnActions } from '../../../states/jotai/contexts/earn';

import { useAllNetworkId } from './useAllNetworkId';

export const useEarnAccounts = () => {
  const actions = useEarnActions();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const allNetworkId = useAllNetworkId();

  const {
    result,
    isLoading: isFetchingAccounts,
    run: refreshEarnAccounts,
  } = usePromiseResult(
    async () => {
      if (!account && !indexedAccount) {
        return;
      }
      const totalFiatMapKey = actions.current.buildEarnAccountsKey({
        accountId: account?.id,
        indexAccountId: indexedAccount?.id,
        networkId: allNetworkId,
      });

      const fetchAndUpdateOverview = async () => {
        if (!account && !indexedAccount) {
          return;
        }

        // Fetch account assets (contains accounts array)
        const assetsData =
          await backgroundApiProxy.serviceStaking.fetchAllNetworkAssets({
            accountId: account?.id ?? '',
            networkId: allNetworkId,
            indexedAccountId: account?.indexedAccountId || indexedAccount?.id,
          });

        const overviewData =
          await backgroundApiProxy.serviceStaking.fetchAccountOverview({
            accountId: account?.id ?? '',
            networkId: allNetworkId,
            indexedAccountId: account?.indexedAccountId || indexedAccount?.id,
          });

        actions.current.updateEarnAccounts({
          key: totalFiatMapKey,
          earnAccount: {
            accounts: assetsData?.accounts || [],
            ...overviewData,
            isOverviewLoaded: true,
          },
        });
      };

      const earnAccountData = actions.current.getEarnAccount(totalFiatMapKey);
      if (earnAccountData) {
        await timerUtils.wait(350);
        await fetchAndUpdateOverview();
      } else {
        await fetchAndUpdateOverview();
      }
      return { loaded: true };
    },
    [actions, account, allNetworkId, indexedAccount],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 3 }),
      revalidateOnReconnect: true,
      alwaysSetState: true,
    },
  );

  return {
    loaded: result?.loaded,
    isFetchingAccounts,
    refreshEarnAccounts,
  };
};
