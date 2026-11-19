import type { ComponentProps } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import { ListView, Stack, YStack, useStyle } from '@onekeyhq/components';
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
  useTokenMapAtom,
} from '../../states/jotai/contexts/approvalList';
import useActiveTabDAppInfo from '../../views/DAppConnection/hooks/useActiveTabDAppInfo';
import { PullToRefresh } from '../../views/Home/components/PullToRefresh';
import { EmptyApproval } from '../Empty';
import { ListLoading } from '../Loading/ListLoading';

import ApprovalListHeader from './ApprovalListHeader';
import ApproveListItem from './ApprovalListItem';
import { ApprovalListViewContext } from './ApprovalListViewContext';

import type { LayoutChangeEvent } from 'react-native';

type IProps = {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
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

function ApprovalListViewCmp(
  props: IProps & { onLayout: (event: LayoutChangeEvent) => void },
) {
  const {
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
  const [{ tokenMap }] = useTokenMapAtom();

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

  const showSkeleton = useMemo(() => {
    if (!approvalListState.initialized) {
      return true;
    }
    return false;
  }, [approvalListState.initialized]);

  const EmptyComponentElement = useMemo(() => {
    if (showSkeleton) {
      return (
        <YStack style={{ flex: 1 }}>
          <ListLoading isTokenSelectorView={!tableLayout} />
        </YStack>
      );
    }

    return <EmptyApproval />;
  }, [showSkeleton, tableLayout]);

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

  return (
    <ListView
      // @ts-ignore
      estimatedItemSize={tableLayout ? undefined : 60}
      showsVerticalScrollIndicator={false}
      onLayout={platformEnv.isNative ? props.onLayout : undefined}
      nestedScrollEnabled={false}
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
        withHeader && !showSkeleton && (tableLayout || !hideRiskOverview) ? (
          <ApprovalListHeader
            hideRiskOverview={hideRiskOverview}
            tokenMap={tokenMap}
            contractMap={contractMap}
          />
        ) : undefined
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
  const [listWidth, setListWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setListWidth(event.nativeEvent.layout.width);
  }, []);
  const tableLayout =
    props.tableLayout ?? (platformEnv.isNative && listWidth >= 768);
  const contextValue = useMemo(() => {
    return {
      accountId: props.accountId,
      networkId: props.networkId,
      indexedAccountId: props.indexedAccountId,
      tableLayout,
      hideRiskBadge: props.hideRiskBadge,
      selectDisabled: props.selectDisabled,
      isAllNetworks: networkUtils.isAllNetwork({ networkId: props.networkId }),
    };
  }, [
    props.accountId,
    props.indexedAccountId,
    props.hideRiskBadge,
    props.networkId,
    props.selectDisabled,
    tableLayout,
  ]);

  return (
    <ApprovalListViewContext.Provider value={contextValue}>
      <ApprovalListViewCmp
        {...props}
        tableLayout={tableLayout}
        onLayout={onLayout}
      />
    </ApprovalListViewContext.Provider>
  );
});

ApprovalListView.displayName = 'ApprovalListView';

export default ApprovalListView;
