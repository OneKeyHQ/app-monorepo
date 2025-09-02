import { memo, useCallback, useEffect } from 'react';

import { CanceledError } from 'axios';

import { useMedia, useTabIsRefreshingFocused } from '@onekeyhq/components';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_APPROVAL,
} from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';
import { EHomeTab } from '@onekeyhq/shared/types';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import ApprovalListView from '../../../components/ApprovalListView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useApprovalListActions } from '../../../states/jotai/contexts/approvalList';
import { HomeApprovalListProviderMirror } from '../components/HomeApprovalListProvider/HomeApprovalListProviderMirror';
import { onHomePageRefresh } from '../components/PullToRefresh';

function ApprovalListContainer() {
  const {
    activeAccount: { account, network, indexedAccount, wallet },
  } = useActiveAccount({ num: 0 });

  const { isFocused, isHeaderRefreshing, setIsHeaderRefreshing } =
    useTabIsRefreshingFocused();

  const media = useMedia();
  const navigation = useAppNavigation();

  const {
    updateApprovalList,
    updateTokenMap,
    updateContractMap,
    updateApprovalListState,
  } = useApprovalListActions().current;

  const { run } = usePromiseResult(
    async () => {
      if (!account || !network) return;

      try {
        appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
          isRefreshing: true,
          type: EHomeTab.APPROVALS,
          accountId: account.id,
          networkId: network.id,
        });

        await backgroundApiProxy.serviceApproval.abortFetchAccountApprovals();

        const resp =
          await backgroundApiProxy.serviceApproval.fetchAccountApprovals({
            accountId: account.id,
            networkId: network.id,
            indexedAccountId: indexedAccount?.id,
          });

        updateApprovalList({ data: resp.contractApprovals });
        updateTokenMap({ data: resp.tokenMap });
        updateContractMap({ data: resp.contractMap });
      } catch (error) {
        if (error instanceof CanceledError) {
          console.log('fetchAccountApprovals canceled');
        } else {
          throw error;
        }
      } finally {
        appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
          isRefreshing: false,
          type: EHomeTab.APPROVALS,
          accountId: account.id,
          networkId: network.id,
        });
        setIsHeaderRefreshing(false);
        updateApprovalListState({
          isRefreshing: false,
          initialized: true,
        });
      }
    },
    [
      account,
      network,
      updateApprovalListState,
      indexedAccount?.id,
      updateApprovalList,
      updateTokenMap,
      updateContractMap,
      setIsHeaderRefreshing,
    ],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_APPROVAL,
    },
  );

  const handleApprovalOnPress = useCallback(
    (approval: IContractApproval) => {
      navigation.pushModal(EModalRoutes.ApprovalManagementModal, {
        screen: EModalApprovalManagementRoutes.ApprovalDetails,
        params: {
          approval,
        },
      });
    },
    [navigation],
  );

  useEffect(() => {
    if (isHeaderRefreshing) {
      void run();
    }
  }, [isHeaderRefreshing, run]);

  useEffect(() => {
    if (wallet?.id && network?.id && account?.id) {
      updateApprovalListState({
        initialized: false,
        isRefreshing: true,
      });
    }
  }, [wallet?.id, network?.id, account?.id, updateApprovalListState]);

  useEffect(() => {
    const refresh = () => {
      if (isFocused) {
        void run();
      }
    };

    const refreshAnyway = () => {
      void run({ alwaysSetState: true });
    };

    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refresh);
    appEventBus.on(EAppEventBusNames.RefreshApprovalList, refreshAnyway);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refresh);
      appEventBus.off(EAppEventBusNames.RefreshApprovalList, refreshAnyway);
    };
  }, [isFocused, run]);

  return (
    <ApprovalListView
      accountId={account?.id ?? ''}
      networkId={network?.id ?? ''}
      inTabList
      withHeader
      searchDisabled
      selectDisabled
      filterByNetworkDisabled
      onRefresh={onHomePageRefresh}
      onPress={handleApprovalOnPress}
      listViewStyleProps={{
        ListHeaderComponentStyle: {
          pt: '$3',
        },
      }}
      {...(media.gtLg && {
        tableLayout: true,
      })}
    />
  );
}

const ApprovalListContainerWithProvider = memo(() => {
  return (
    <HomeApprovalListProviderMirror>
      <ApprovalListContainer />
    </HomeApprovalListProviderMirror>
  );
});
ApprovalListContainerWithProvider.displayName =
  'ApprovalListContainerWithProvider';

export { ApprovalListContainerWithProvider };
