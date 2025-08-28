import type { ComponentProps, ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IListViewProps } from '@onekeyhq/components';
import {
  Button,
  SectionList,
  SizableText,
  Stack,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useStyle } from '@onekeyhq/components/src/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import {
  convertToSectionGroups,
  getFilteredHistoryBySearchKey,
} from '@onekeyhq/shared/src/utils/historyUtils';
import type {
  IAccountHistoryTx,
  IHistoryListSectionGroup,
} from '@onekeyhq/shared/types/history';
import type { ITokenFiat } from '@onekeyhq/shared/types/token';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { useAccountData } from '../../hooks/useAccountData';
import { useBlockExplorerNavigation } from '../../hooks/useBlockExplorerNavigation';
import {
  useHasMoreOnChainHistoryAtom,
  useSearchKeyAtom,
} from '../../states/jotai/contexts/historyList';
import { openExplorerAddressUrl } from '../../utils/explorerUtils';
import useActiveTabDAppInfo from '../../views/DAppConnection/hooks/useActiveTabDAppInfo';
import { withBrowserProvider } from '../../views/Discovery/pages/Browser/WithBrowserProvider';
import { PullToRefresh } from '../../views/Home/components/PullToRefresh';
import AddressTypeSelector from '../AddressTypeSelector/AddressTypeSelector';
import { EmptySearch } from '../Empty';
import { EmptyHistory } from '../Empty/EmptyHistory';
import { HistoryLoadingView } from '../Loading';

import { TxHistoryListItem } from './TxHistoryListItem';

type IProps = {
  data: IAccountHistoryTx[];
  isLoading?: boolean;
  tableLayout?: boolean;
  ListHeaderComponent?: ReactElement;
  showHeader?: boolean;
  showFooter?: boolean;
  showIcon?: boolean;
  onPressHistory?: (history: IAccountHistoryTx) => void;
  initialized?: boolean;
  inTabList?: boolean;
  contentContainerStyle?: IListViewProps<IAccountHistoryTx>['contentContainerStyle'];
  hideValue?: boolean;
  onRefresh?: () => void;
  listViewStyleProps?: Pick<
    ComponentProps<typeof SectionList>,
    | 'ListHeaderComponentStyle'
    | 'ListFooterComponentStyle'
    | 'contentContainerStyle'
  >;
  walletId?: string;
  accountId?: string;
  networkId?: string;
  indexedAccountId?: string;
  isSingleAccount?: boolean;
  tokenMap?: Record<string, ITokenFiat>;
};

const ListFooterComponent = ({
  accountId,
  networkId,
  walletId,
  indexedAccountId,
  showFooter,
  hasMoreOnChainHistory,
  isSingleAccount,
}: {
  accountId?: string;
  networkId?: string;
  walletId?: string;
  indexedAccountId?: string;
  showFooter?: boolean;
  hasMoreOnChainHistory?: boolean;
  isSingleAccount?: boolean;
}) => {
  const { result: extensionActiveTabDAppInfo } = useActiveTabDAppInfo();
  const intl = useIntl();
  const addPaddingOnListFooter = useMemo(
    () => !!extensionActiveTabDAppInfo?.showFloatingPanel,
    [extensionActiveTabDAppInfo?.showFloatingPanel],
  );

  const { account, network, vaultSettings } = useAccountData({
    accountId,
    networkId,
  });
  const { requiresNetworkSelection, openExplorer } = useBlockExplorerNavigation(
    network,
    walletId,
  );

  const handleOnPress = useCallback(async () => {
    await openExplorer({
      accountId,
      indexedAccountId,
      networkId: account?.createAtNetwork ?? network?.id,
      address: account?.address,
    });
  }, [
    openExplorer,
    accountId,
    indexedAccountId,
    account?.createAtNetwork,
    account?.address,
    network?.id,
  ]);

  if (
    showFooter &&
    hasMoreOnChainHistory &&
    (network?.isAllNetworks || !vaultSettings?.hideBlockExplorer)
  ) {
    return (
      <>
        <YStack
          alignItems="center"
          justifyContent="center"
          gap="$2"
          px="$5"
          py="$6"
        >
          <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
            {intl.formatMessage({
              id: ETranslations.wallet_history_footer_view_full_history_in_explorer,
            })}
          </SizableText>
          {!isSingleAccount &&
          !accountUtils.isOthersWallet({ walletId: walletId ?? '' }) &&
          vaultSettings?.mergeDeriveAssetsEnabled ? (
            <AddressTypeSelector
              walletId={walletId ?? ''}
              networkId={networkId ?? ''}
              indexedAccountId={
                indexedAccountId ?? account?.indexedAccountId ?? ''
              }
              renderSelectorTrigger={
                <Button size="small" variant="secondary" onPress={() => {}}>
                  {intl.formatMessage({
                    id: ETranslations.global_block_explorer,
                  })}
                </Button>
              }
              onSelect={async ({ account: a }) => {
                await openExplorerAddressUrl({
                  networkId: network?.id,
                  address: a?.address,
                });
              }}
              doubleConfirm
            />
          ) : (
            <Button
              size="small"
              variant="secondary"
              onPress={handleOnPress}
              iconAfter={requiresNetworkSelection ? undefined : 'OpenOutline'}
            >
              {intl.formatMessage({ id: ETranslations.global_block_explorer })}
            </Button>
          )}
        </YStack>
        <Stack h="$5" />
        {addPaddingOnListFooter ? <Stack h="$16" /> : null}
      </>
    );
  }

  return (
    <>
      <Stack h="$5" />
      {addPaddingOnListFooter ? <Stack h="$16" /> : null}
    </>
  );
};

function TxHistoryListViewSectionHeader(props: IHistoryListSectionGroup) {
  const { title, titleKey, data } = props;
  const intl = useIntl();
  const titleText = title || intl.formatMessage({ id: titleKey }) || '';

  if (data[0] && data[0].decodedTx.status === EDecodedTxStatus.Pending) {
    return (
      <XStack h="$9" px="$5" alignItems="center" bg="$bgApp" space="$2">
        <Stack
          w="$2"
          height="$2"
          backgroundColor="$textCaution"
          borderRadius="$full"
        />
        <SizableText numberOfLines={1} size="$headingSm" color="$textCaution">
          {intl.formatMessage({ id: ETranslations.global_pending })}
        </SizableText>
      </XStack>
    );
  }

  return <SectionList.SectionHeader title={titleText} />;
}

function BaseTxHistoryListView(props: IProps) {
  const {
    data,
    isLoading,
    ListHeaderComponent,
    showIcon,
    onPressHistory,
    tableLayout,
    showFooter,
    initialized,
    contentContainerStyle,
    inTabList = false,
    hideValue,
    listViewStyleProps,
    onRefresh,
    accountId,
    networkId,
    walletId,
    indexedAccountId,
    isSingleAccount,
    tokenMap,
  } = props;

  const [searchKey] = useSearchKeyAtom();
  const [hasMoreOnChainHistory] = useHasMoreOnChainHistoryAtom();

  const filteredHistory = useMemo(
    () =>
      getFilteredHistoryBySearchKey({
        history: data,
        searchKey,
      }),
    [data, searchKey],
  );

  const sections = useMemo(
    () =>
      convertToSectionGroups({
        items: filteredHistory,
        formatDate: (date: number) =>
          formatDate(new Date(date), {
            hideTimeForever: true,
          }),
      }),
    [filteredHistory],
  );

  const renderItem = useCallback(
    (info: { item: IAccountHistoryTx; index: number }) => (
      <TxHistoryListItem
        hideValue={hideValue}
        index={info.index}
        historyTx={info.item}
        showIcon={showIcon}
        onPress={onPressHistory}
        tableLayout={tableLayout}
      />
    ),
    [hideValue, onPressHistory, showIcon, tableLayout],
  );
  const renderSectionHeader = useCallback(
    ({
      section: { title, titleKey, data: tx },
    }: {
      section: IHistoryListSectionGroup;
    }) => (
      <TxHistoryListViewSectionHeader
        title={title}
        titleKey={titleKey}
        data={tx}
      />
    ),
    [],
  );

  const resolvedContentContainerStyle = useStyle(
    contentContainerStyle || listViewStyleProps?.contentContainerStyle || {},
    {
      resolveValues: 'auto',
    },
  );

  const { ListHeaderComponentStyle, ListFooterComponentStyle } =
    listViewStyleProps || {};
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
    return inTabList ? Tabs.SectionList : SectionList;
  }, [inTabList]);

  const itemCounts = useMemo(() => {
    return sections.reduce((acc, section) => acc + section.data.length, 0);
  }, [sections]);

  const EmptyComponentElement = useMemo(() => {
    if (!initialized && isLoading) {
      return <HistoryLoadingView tableLayout={tableLayout} />;
    }
    if (searchKey && data.length > 0) {
      return <EmptySearch />;
    }
    return (
      <EmptyHistory
        showViewInExplorer
        walletId={walletId}
        accountId={accountId}
        networkId={networkId}
        indexedAccountId={indexedAccountId}
        isSingleAccount={isSingleAccount}
        tokenMap={tokenMap}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, data.length]);

  return (
    <ListComponent
      refreshControl={
        onRefresh ? <PullToRefresh onRefresh={onRefresh} /> : undefined
      }
      // @ts-ignore
      estimatedItemSize={platformEnv.isNative ? 60 : 56}
      contentContainerStyle={resolvedContentContainerStyle as any}
      stickySectionHeadersEnabled={false}
      sections={sections}
      extraData={itemCounts}
      ListEmptyComponent={EmptyComponentElement}
      ListHeaderComponentStyle={resolvedListHeaderComponentStyle as any}
      ListFooterComponentStyle={resolvedListFooterComponentStyle as any}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader as any}
      ListFooterComponent={
        <ListFooterComponent
          showFooter={showFooter}
          hasMoreOnChainHistory={hasMoreOnChainHistory}
          accountId={accountId}
          networkId={networkId}
          walletId={walletId}
          indexedAccountId={indexedAccountId}
          isSingleAccount={isSingleAccount}
        />
      }
      ListHeaderComponent={ListHeaderComponent}
      keyExtractor={(tx, index) => tx.id || index.toString(10)}
    />
  );
}

const TxHistoryListView = withBrowserProvider<IProps>(BaseTxHistoryListView);

export { TxHistoryListView };
