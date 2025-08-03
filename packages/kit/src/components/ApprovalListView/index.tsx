import { ListView, Tabs, useStyle } from '@onekeyhq/components';
import { ScrollView } from '@onekeyhq/components/src/composite/Tabs/ScrollView';
import { ComponentProps, memo, useMemo } from 'react';
import { PullToRefresh } from '../../views/Home/components/PullToRefresh';
import { useApprovalListAtom } from '../../states/jotai/contexts/approvalList';
import ApproveListItem from './ApproveListItem';

type IProps = {
  inTabList?: boolean;
  onRefresh?: () => void;
  listViewStyleProps?: Pick<
    ComponentProps<typeof ListView>,
    | 'ListHeaderComponentStyle'
    | 'ListFooterComponentStyle'
    | 'contentContainerStyle'
  >;
};

function ApprovalListViewCmp(props: IProps) {
  const { inTabList, listViewStyleProps, onRefresh } = props;

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
