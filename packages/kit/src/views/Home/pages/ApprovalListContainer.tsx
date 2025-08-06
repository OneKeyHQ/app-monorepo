import { memo, useEffect } from 'react';

import { CanceledError } from 'axios';

import { useMedia, useTabIsRefreshingFocused } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EHomeTab } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ApprovalListView } from '../../../components/ApprovalListView';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useApprovalListActions,
  withApprovalListProvider,
} from '../../../states/jotai/contexts/approvalList';
import { onHomePageRefresh } from '../components/PullToRefresh';

function ApprovalListContainer() {
  const {
    activeAccount: { account, network, indexedAccount, wallet },
  } = useActiveAccount({ num: 0 });

  const { isFocused, isHeaderRefreshing, setIsHeaderRefreshing } =
    useTabIsRefreshingFocused();

  const media = useMedia();

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

        console.log('resp', resp);

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
      revalidateOnFocus: true,
    },
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

    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refresh);
    appEventBus.on(EAppEventBusNames.RefreshApprovalList, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refresh);
      appEventBus.off(EAppEventBusNames.RefreshApprovalList, refresh);
    };
  }, [isFocused, run]);

  return (
    <ApprovalListView
      inTabList
      withHeader
      isAllNetworks={network?.isAllNetworks}
      onRefresh={onHomePageRefresh}
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

const ApprovalListContainerWithProvider = memo(
  withApprovalListProvider(ApprovalListContainer),
);

export { ApprovalListContainerWithProvider };
