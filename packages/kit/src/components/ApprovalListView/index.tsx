import type { ComponentProps } from 'react';
import { memo, useCallback, useMemo, useRef } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import { ListView, Stack, Tabs, YStack, useStyle } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

import {
  useApprovalListAtom,
  useApprovalListStateAtom,
  useContractMapAtom,
  useSearchKeyAtom,
  useSearchNetworkAtom,
} from '../../states/jotai/contexts/approvalList';
import useActiveTabDAppInfo from '../../views/DAppConnection/hooks/useActiveTabDAppInfo';
import { PullToRefresh } from '../../views/Home/components/PullToRefresh';
import { EmptyApproval } from '../Empty';
import { ListLoading } from '../Loading/ListLoading';

import ApprovalListHeader from './ApprovalListHeader';
import ApproveListItem from './ApprovalListItem';
import { ApprovalListViewContext } from './ApprovalListViewContext';

type IProps = {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
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
  selectDisabled?: boolean;
  searchDisabled?: boolean;
  filterByNetworkDisabled?: boolean;
  hideRiskOverview?: boolean;
};

function ApprovalListViewCmp(props: IProps) {
  const {
    inTabList,
    listViewStyleProps,
    onRefresh,
    onPress,
    tableLayout,
    withHeader,
    searchDisabled,
    filterByNetworkDisabled,
    hideRiskOverview,
  } = props;
  const intl = useIntl();
  const [{ approvals }] = useApprovalListAtom();
  const [approvalListState] = useApprovalListStateAtom();
  const [searchKey] = useSearchKeyAtom();
  const [searchNetwork] = useSearchNetworkAtom();
  const [{ contractMap }] = useContractMapAtom();

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
    return <EmptyApproval />;
  }, []);

  const filteredApprovals = useMemo(() => {
    let _filteredApprovals = approvals;

    if (!searchDisabled && !isEmpty(searchKey)) {
      const searchKeyLower = searchKey.toLowerCase();
      _filteredApprovals = _filteredApprovals.filter((approval) => {
        if (approval.contractAddress.toLowerCase() === searchKeyLower) {
          return true;
        }

        const contract =
          contractMap[
            approvalUtils.buildContractMapKey({
              networkId: approval.networkId,
              contractAddress: approval.contractAddress,
            })
          ];

        if (contract && contract.label) {
          return contract.label?.toLowerCase().includes(searchKeyLower);
        }
        return intl
          .formatMessage({ id: ETranslations.global_unknown })
          .toLowerCase()
          .includes(searchKeyLower);
      });
    }

    if (
      !filterByNetworkDisabled &&
      searchNetwork.networkId &&
      !networkUtils.isAllNetwork({ networkId: searchNetwork.networkId })
    ) {
      _filteredApprovals = _filteredApprovals.filter((approval) => {
        return approval.networkId === searchNetwork.networkId;
      });
    }

    return _filteredApprovals;
  }, [
    approvals,
    searchDisabled,
    searchKey,
    filterByNetworkDisabled,
    searchNetwork.networkId,
    contractMap,
    intl,
  ]);

  const ListComponentRef = useRef<typeof ListComponent>(null);

  const recomputeLayout = useCallback(() => {
    if (!platformEnv.isNative) {
      // update tab list header height after alert dismissed
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (ListComponentRef.current as any)?.recomputeLayout?.();
    }
  }, []);

  if (!platformEnv.isNativeAndroid && showSkeleton) {
    return (
      <YStack style={{ flex: 1 }}>
        <ListLoading isTokenSelectorView={!tableLayout} />
      </YStack>
    );
  }

  return (
    <ListComponent
      // @ts-ignore
      estimatedItemSize={tableLayout ? undefined : 60}
      ref={ListComponentRef as any}
      nestedScrollEnabled={platformEnv.isNativeAndroid ? inTabList : false}
      refreshControl={
        !platformEnv.isNativeAndroid && onRefresh ? (
          <PullToRefresh onRefresh={onRefresh} />
        ) : undefined
      }
      extraData={filteredApprovals?.length ?? 0}
      data={filteredApprovals}
      contentContainerStyle={resolvedContentContainerStyle as any}
      ListHeaderComponentStyle={resolvedListHeaderComponentStyle as any}
      ListFooterComponentStyle={resolvedListFooterComponentStyle as any}
      ListEmptyComponent={EmptyComponentElement}
      ListHeaderComponent={
        withHeader && !showSkeleton ? (
          <ApprovalListHeader
            recomputeLayout={recomputeLayout}
            hideRiskOverview={hideRiskOverview}
          />
        ) : null
      }
      renderItem={({ item }) => (
        <ApproveListItem
          key={`${item.networkId}_${item.contractAddress}`}
          approval={item}
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

const ApprovalListView = memo((props: IProps) => {
  const contextValue = useMemo(() => {
    return {
      accountId: props.accountId,
      networkId: props.networkId,
      tableLayout: props.tableLayout,
      hideRiskBadge: props.hideRiskBadge,
      selectDisabled: props.selectDisabled,
      isAllNetworks: networkUtils.isAllNetwork({ networkId: props.networkId }),
    };
  }, [
    props.accountId,
    props.hideRiskBadge,
    props.networkId,
    props.selectDisabled,
    props.tableLayout,
  ]);

  return (
    <ApprovalListViewContext.Provider value={contextValue}>
      <ApprovalListViewCmp {...props} />
    </ApprovalListViewContext.Provider>
  );
});

ApprovalListView.displayName = 'ApprovalListView';

export default ApprovalListView;
