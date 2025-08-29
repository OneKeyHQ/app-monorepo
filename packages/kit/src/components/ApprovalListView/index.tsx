import type { ComponentProps } from 'react';
import { memo, useMemo } from 'react';

import { ListView, Stack, Tabs, YStack, useStyle } from '@onekeyhq/components';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

import {
  useApprovalListAtom,
  useApprovalListStateAtom,
} from '../../states/jotai/contexts/approvalList';
import useActiveTabDAppInfo from '../../views/DAppConnection/hooks/useActiveTabDAppInfo';
import { PullToRefresh } from '../../views/Home/components/PullToRefresh';
import { EmptyToken } from '../Empty';
import { ListLoading } from '../Loading/ListLoading';

import ApprovalListHeader from './ApprovalListHeader';
import ApproveListItem from './ApprovalListItem';

type IProps = {
  accountId: string;
  networkId: string;
  inTabList?: boolean;
  tableLayout?: boolean;
  onRefresh?: () => void;
  onPress?: (approval: IContractApproval) => void;
  withHeader?: boolean;
  listViewStyleProps?: Pick<
    ComponentProps<typeof ListView>,
    | 'ListHeaderComponentStyle'
    | 'ListFooterComponentStyle'
    | 'contentContainerStyle'
  >;
  hideRiskBadge?: boolean;
};

function ApprovalListViewCmp(props: IProps) {
  const {
    inTabList,
    listViewStyleProps,
    onRefresh,
    withHeader,
    tableLayout,
    onPress,
    hideRiskBadge,
    accountId,
    networkId,
  } = props;

  const [{ approvals }] = useApprovalListAtom();
  const [approvalListState] = useApprovalListStateAtom();

  const {
    ListHeaderComponentStyle,
    ListFooterComponentStyle,
    contentContainerStyle,
  } = listViewStyleProps || {};

  const resolvedContentContainerStyle = useStyle(contentContainerStyle || {}, {
    resolveValues: 'auto',
  });

  const resolvedListHeaderComponentStyle = useStyle(
    ListHeaderComponentStyle || {},
    {
      resolveValues: 'auto',
    },
  );

  const resolvedListFooterComponentStyle = useStyle(
    ListFooterComponentStyle || {},
    {
      resolveValues: 'auto',
    },
  );

  const { result: extensionActiveTabDAppInfo } = useActiveTabDAppInfo();
  const addPaddingOnListFooter = useMemo(
    () => !!extensionActiveTabDAppInfo?.showFloatingPanel,
    [extensionActiveTabDAppInfo?.showFloatingPanel],
  );

  const ListComponent = useMemo(() => {
    return inTabList ? Tabs.FlatList : ListView;
  }, [inTabList]);

  const showSkeleton = useMemo(() => {
    if (!approvalListState.initialized && approvalListState.isRefreshing) {
      return true;
    }
    return false;
  }, [approvalListState.initialized, approvalListState.isRefreshing]);

  const EmptyComponentElement = useMemo(() => {
    if (showSkeleton) {
      return (
        <YStack style={{ flex: 1 }}>
          <ListLoading isTokenSelectorView={!tableLayout} />
        </YStack>
      );
    }

    return <EmptyToken />;
  }, [showSkeleton, tableLayout]);

  return (
    <ListComponent
      // @ts-ignore
      estimatedItemSize={tableLayout ? undefined : 60}
      refreshControl={
        onRefresh ? <PullToRefresh onRefresh={onRefresh} /> : undefined
      }
      extraData={approvals?.length ?? 0}
      data={approvals}
      contentContainerStyle={resolvedContentContainerStyle as any}
      ListHeaderComponentStyle={resolvedListHeaderComponentStyle as any}
      ListFooterComponentStyle={resolvedListFooterComponentStyle as any}
      ListEmptyComponent={EmptyComponentElement}
      ListHeaderComponent={
        withHeader && !showSkeleton ? (
          <ApprovalListHeader
            tableLayout={tableLayout}
            accountId={accountId}
            networkId={networkId}
          />
        ) : null
      }
      renderItem={({ item }) => (
        <ApproveListItem
          key={`${item.networkId}_${item.contractAddress}`}
          approval={item}
          isAllNetworks={networkUtils.isAllNetwork({ networkId })}
          tableLayout={tableLayout}
          onPress={onPress}
          hideRiskBadge={hideRiskBadge}
        />
      )}
      ListFooterComponent={
        <Stack pb="$5">
          {addPaddingOnListFooter ? <Stack h="$16" /> : null}
        </Stack>
      }
    />
  );
}

const ApprovalListView = memo(ApprovalListViewCmp);

export { ApprovalListView };
