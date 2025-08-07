import type { ComponentProps } from 'react';
import { memo, useMemo } from 'react';

import { ListView, Stack, Tabs, YStack, useStyle } from '@onekeyhq/components';
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
  inTabList?: boolean;
  tableLayout?: boolean;
  isAllNetworks?: boolean;
  onRefresh?: () => void;
  onPress?: (approval: IContractApproval) => void;
  withHeader?: boolean;
  listViewStyleProps?: Pick<
    ComponentProps<typeof ListView>,
    | 'ListHeaderComponentStyle'
    | 'ListFooterComponentStyle'
    | 'contentContainerStyle'
  >;
};

function ApprovalListViewCmp(props: IProps) {
  const {
    inTabList,
    listViewStyleProps,
    onRefresh,
    withHeader,
    tableLayout,
    isAllNetworks,
    onPress,
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
          <ApprovalListHeader tableLayout={tableLayout} />
        ) : null
      }
      renderItem={({ item }) => (
        <ApproveListItem
          key={`${item.networkId}_${item.contractAddress}`}
          approval={item}
          isAllNetworks={isAllNetworks}
          tableLayout={tableLayout}
          onPress={onPress}
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
