import type { ComponentProps, ForwardedRef, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

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
  isTabFocused?: boolean;
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
  ref?: ForwardedRef<typeof SectionList>;
  plainMode?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
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

function TxHistoryListViewSectionHeader(
  props: IHistoryListSectionGroup & {
    inTabList?: boolean;
    isTabFocused?: boolean;
    index: number;
    recomputeLayout: () => void;
  },
) {
  const {
    title,
    titleKey,
    data,
    index,
    recomputeLayout,
    inTabList,
    isTabFocused,
  } = props;
  const intl = useIntl();
  const titleText = title || intl.formatMessage({ id: titleKey }) || '';

  useEffect(() => {
    if (
      data[0] &&
      data[0].decodedTx.status === EDecodedTxStatus.Pending &&
      ((inTabList && isTabFocused) || !inTabList)
    ) {
      setTimeout(() => {
        recomputeLayout();
      }, 350);
    }
  }, [data, inTabList, isTabFocused, recomputeLayout]);

  if (data[0] && data[0].decodedTx.status === EDecodedTxStatus.Pending) {
    return (
      <XStack
        px="$5"
        py="$2"
        alignItems="center"
        bg="$bgApp"
        gap="$2"
        mt={index === 0 ? '$0' : '$5'}
      >
        <Stack
          w="$2"
          height="$2"
          backgroundColor="$textCaution"
          borderRadius="$full"
        />
        <SizableText numberOfLines={1} size="$headingXs" color="$textCaution">
          {intl.formatMessage({ id: ETranslations.global_pending })}
        </SizableText>
      </XStack>
    );
  }

  return (
    <Stack py="$2" px="$5" mt={index === 0 ? '$0' : '$5'}>
      <SizableText size="$headingXs" color="$textSubdued">
        {titleText}
      </SizableText>
    </Stack>
  );
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
    isTabFocused,
    hideValue,
    listViewStyleProps,
    onRefresh,
    accountId,
    networkId,
    walletId,
    indexedAccountId,
    isSingleAccount,
    tokenMap,
    ref,
    plainMode,
    emptyTitle,
    emptyDescription,
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

  const ListComponentRef = useRef<typeof ListComponent>(null);

  const recomputeLayout = useCallback(() => {
    if (!platformEnv.isNative) {
      // update tab list header height after alert dismissed
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (ListComponentRef.current as any)?.recomputeLayout?.();
    }
  }, []);

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
      index,
    }: {
      section: IHistoryListSectionGroup;
      index: number;
    }) => (
      <TxHistoryListViewSectionHeader
        recomputeLayout={recomputeLayout}
        title={title}
        titleKey={titleKey}
        data={tx}
        index={index}
        inTabList={inTabList}
        isTabFocused={isTabFocused}
      />
    ),
    [recomputeLayout, inTabList, isTabFocused],
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
        showViewInExplorer={!plainMode}
        walletId={walletId}
        accountId={accountId}
        networkId={networkId}
        indexedAccountId={indexedAccountId}
        isSingleAccount={isSingleAccount}
        tokenMap={tokenMap}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
    );
  }, [
    initialized,
    isLoading,
    searchKey,
    data.length,
    walletId,
    accountId,
    networkId,
    indexedAccountId,
    isSingleAccount,
    tokenMap,
    tableLayout,
    plainMode,
    emptyTitle,
    emptyDescription,
  ]);

  if (plainMode) {
    if (sections.length === 0) {
      return EmptyComponentElement;
    }

    return (
      <YStack>
        {sections.map((section, index) => (
          <YStack key={section.title}>
            {renderSectionHeader({ section, index })}
            {section.data.map((item, itemIndex) => (
              <TxHistoryListItem
                key={item.id}
                historyTx={item}
                index={itemIndex}
                showIcon={showIcon}
                onPress={onPressHistory}
                tableLayout={tableLayout}
                hideValue={hideValue}
                compact={plainMode}
              />
            ))}
          </YStack>
        ))}
      </YStack>
    );
  }

  return (
    <ListComponent
      ref={(ref ?? ListComponentRef) as any}
      nestedScrollEnabled={platformEnv.isNativeAndroid ? inTabList : false}
      refreshControl={
        !platformEnv.isNativeAndroid && onRefresh ? (
          <PullToRefresh onRefresh={onRefresh} />
        ) : undefined
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
          hasMoreOnChainHistory={
            sections.length > 0 ? hasMoreOnChainHistory : false
          }
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
