import type { ComponentProps } from 'react';
import { memo, useMemo } from 'react';

import { ListView, Tabs, YStack, useStyle } from '@onekeyhq/components';

import { useApprovalListAtom } from '../../states/jotai/contexts/approvalList';
import { PullToRefresh } from '../../views/Home/components/PullToRefresh';
import { EmptyToken } from '../Empty';
import { ListLoading } from '../Loading';

import ApprovalListHeader from './ApprovalListHeader';
import ApproveListItem from './ApprovalListItem';

type IProps = {
  inTabList?: boolean;
  tableLayout?: boolean;
  onRefresh?: () => void;
  withHeader?: boolean;
  listViewStyleProps?: Pick<
    ComponentProps<typeof ListView>,
    | 'ListHeaderComponentStyle'
    | 'ListFooterComponentStyle'
    | 'contentContainerStyle'
  >;
};

function ApprovalListViewCmp(props: IProps) {
  const { inTabList, listViewStyleProps, onRefresh, withHeader, tableLayout } =
    props;

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

  const ListComponent = useMemo(() => {
    return inTabList ? Tabs.FlatList : ListView;
  }, [inTabList]);

  const showSkeleton = false;

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

  const [{ approvals }] = useApprovalListAtom();

  return (
    <ListComponent
      // @ts-ignore
      estimatedItemSize={tableLayout ? undefined : 60}
      refreshControl={
        onRefresh ? <PullToRefresh onRefresh={onRefresh} /> : undefined
      }
      extraData={approvals.length}
      data={approvals}
      contentContainerStyle={resolvedContentContainerStyle as any}
      ListHeaderComponentStyle={resolvedListHeaderComponentStyle as any}
      ListFooterComponentStyle={resolvedListFooterComponentStyle as any}
      ListEmptyComponent={EmptyComponentElement}
      ListHeaderComponent={
        withHeader ? <ApprovalListHeader tableLayout={tableLayout} /> : null
      }
      renderItem={({ item }) => (
        <ApproveListItem
          key={`${item.tokenAddress}_${item.spenderAddress}`}
          approval={item}
        />
      )}
    />
  );
}

const ApprovalListView = memo(ApprovalListViewCmp);

export { ApprovalListView };
