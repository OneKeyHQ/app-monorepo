import { memo, useEffect, useMemo } from 'react';

import {
  useMedia,
  useScrollContentTabBarOffset,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { NotificationEnableAlert } from '../../../components/NotificationEnableAlert';
import { TxHistoryListView } from '../../../components/TxHistoryListView';
import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  ProviderJotaiContextHistoryList,
  useSearchKeyAtom,
} from '../../../states/jotai/contexts/historyList';
import {
  useHomeFacts,
  useHomeInteraction,
  useHomeResource,
  useHomeSection,
} from '../../../states/jotai/contexts/home';
import { useHomeSectionPayload } from '../model/react/homeStoreHooks';
import { useHomeHistoryIntents } from '../model/react/useHomeHistoryIntents';
import {
  HOME_HISTORY_ACTION_IDS,
  selectRecentHomeHistoryRows,
} from '../model/sections/history/homeHistoryStoreModel';

import {
  FrozenTopHistoryScrollObserver,
  useFrozenTopHistoryData,
} from './hooks/useFrozenTopHistoryData';

function TxHistoryListContainer(
  params:
    | {
        plainMode?: boolean;
        tableLayout?: boolean;
        limit?: number;
        emptyTitle?: string;
        emptyDescription?: string;
      }
    | undefined,
) {
  const { plainMode, tableLayout, limit, emptyTitle, emptyDescription } =
    params ?? {};
  const { isFocused } = useTabIsRefreshingFocused();
  const isRouteFocused = useRouteIsFocused();
  const media = useMedia();
  const tabBarHeight = useScrollContentTabBarOffset();
  const {
    activeAccount: { account, indexedAccount, network, wallet },
  } = useActiveAccount({ num: 0 });
  const homeFacts = useHomeFacts();
  const historyResource = useHomeResource('history');
  const historySection = useHomeSection('history');
  const interaction = useHomeInteraction();
  const payload = useHomeSectionPayload('history');
  const { loadMore, openDetails, refresh } = useHomeHistoryIntents();
  const [, setSearchKey] = useSearchKeyAtom();

  useEffect(() => {
    setSearchKey('');
  }, [homeFacts?.ownerToken.scopeKey, setSearchKey]);

  const displayData = useMemo(
    () => selectRecentHomeHistoryRows(payload?.data ?? [], limit),
    [limit, payload?.data],
  );
  const initialized =
    historyResource.kind === 'ready' ||
    historyResource.kind === 'empty' ||
    historyResource.kind === 'error' ||
    historySection.value.kind === 'error';
  const isLoadingMore = interaction.pendingSectionCommands.some(
    (command) =>
      command.sectionId === 'history' &&
      command.type === 'sectionActionInvoked' &&
      command.actionId === HOME_HISTORY_ACTION_IDS.loadMore,
  );
  const loadMoreEnabled =
    !plainMode &&
    !limit &&
    !network?.isAllNetworks &&
    Boolean(payload?.hasMore);

  const isFrozenTopTabScenario = !plainMode && !limit;
  const frozenTopEnabled =
    isFocused && isRouteFocused && isFrozenTopTabScenario;
  const frozenTopIdentityKey = homeFacts?.ownerToken.scopeKey ?? '';
  const { displayedHistoryData, onAwayFromTopChange } = useFrozenTopHistoryData(
    displayData,
    frozenTopEnabled,
    frozenTopIdentityKey,
  );

  const listHeaderComponent = useMemo(
    () =>
      platformEnv.isNative && isFrozenTopTabScenario ? (
        <NotificationEnableAlert scene="txHistory" />
      ) : null,
    [isFrozenTopTabScenario],
  );

  return (
    <>
      {isFrozenTopTabScenario ? (
        <FrozenTopHistoryScrollObserver
          enabled={frozenTopEnabled}
          onAwayFromTopChange={onAwayFromTopChange}
        />
      ) : null}
      <TxHistoryListView
        addressMap={payload?.addressMap ?? {}}
        plainMode={plainMode}
        isTabFocused={isFocused}
        showIcon
        inTabList
        hideValue
        onRefresh={plainMode || limit ? undefined : refresh}
        data={displayedHistoryData}
        onPressHistory={openDetails}
        showHeader
        showFooter
        walletId={wallet?.id}
        accountId={account?.id}
        networkId={network?.id}
        indexedAccountId={indexedAccount?.id}
        initialized={initialized}
        tableLayout={tableLayout ?? media.gtMd}
        listViewStyleProps={{
          contentContainerStyle: {
            mt: '$3',
            pb: tabBarHeight,
          },
        }}
        tokenMap={payload?.tokenMap ?? {}}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        ListHeaderComponent={listHeaderComponent}
        onEndReached={loadMoreEnabled ? loadMore : undefined}
        isLoadingMore={isLoadingMore}
        hasMore={payload?.hasMore ?? false}
      />
    </>
  );
}

const TxHistoryListContainerWithProvider = memo(() => {
  return (
    <ProviderJotaiContextHistoryList>
      <TxHistoryListContainer />
    </ProviderJotaiContextHistoryList>
  );
});
TxHistoryListContainerWithProvider.displayName =
  'TxHistoryListContainerWithProvider';

export { TxHistoryListContainer, TxHistoryListContainerWithProvider };
