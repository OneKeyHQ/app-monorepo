import type { ComponentProps, ForwardedRef, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IGetWebRowHeight, IListViewProps } from '@onekeyhq/components';
import {
  Button,
  SectionList,
  SizableText,
  Spinner,
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
import { getDisplayedActions } from '@onekeyhq/shared/src/utils/txActionUtils';
import type {
  IAccountHistoryTx,
  IHistoryListSectionGroup,
} from '@onekeyhq/shared/types/history';
import type { ITokenFiat } from '@onekeyhq/shared/types/token';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import { useAccountData } from '../../hooks/useAccountData';
import { useBlockExplorerNavigation } from '../../hooks/useBlockExplorerNavigation';
import { useSearchKeyAtom } from '../../states/jotai/contexts/historyList';
import { openExplorerAddressUrl } from '../../utils/explorerUtils';
import useActiveTabDAppInfo from '../../views/DAppConnection/hooks/useActiveTabDAppInfo';
import { withBrowserProvider } from '../../views/Discovery/pages/Browser/WithBrowserProvider';
import { PullToRefresh } from '../../views/Home/components/PullToRefresh';
import AddressTypeSelector from '../AddressTypeSelector/AddressTypeSelector';
import { EmptySearch } from '../Empty';
import { EmptyHistory } from '../Empty/EmptyHistory';
import { HistoryLoadingView } from '../Loading';

import { TxHistoryListItem } from './TxHistoryListItem';

// Measured on web/desktop. Drives react-virtualized's CellMeasurer bypass so
// rows are positioned synchronously with scroll instead of via async layout.
// No-op on native (List.tsx Web fast path is not on the native code path).
//
// Geometry (tableLayout, see TxActionCommon.tsx): 68 = py top ($3 = 12) + py
// bottom ($3 = 12) + 44, where 44 is the taller of the left column (title
// $bodyMdMedium lineHeight 20 + gap $1 = 4 + subtitle $bodyMd lineHeight 20) and
// a 1–2 line changes column. So a row with <= MAX_FIXED_HEIGHT_CHANGE_LINES
// change lines is always 68.
// IMPORTANT: if the row padding, the left column, or renderTransferLine's
// per-line layout changes, update TX_ROW_HEIGHT / CHANGE_LINE_HEIGHT below.
const TX_ROW_HEIGHT = 68;
const SECTION_HEADER_HEIGHT_FIRST = 32; // mt=$0 on first section
const SECTION_HEADER_HEIGHT_NEXT = 52; // mt=$5 (~20px) on subsequent sections

// In tableLayout, an ASSET_TRANSFER row renders one change line per grouped
// token (grouped sends + grouped receives — see `buildExpandedTransferView` in
// TxActionTransfer.tsx). TX_ROW_HEIGHT fits up to this many change lines.
const MAX_FIXED_HEIGHT_CHANGE_LINES = 2;

// Height contributed by each change line beyond MAX_FIXED_HEIGHT_CHANGE_LINES:
// one $bodyMd line (lineHeight 20) plus the changes column's row gap ($1 = 4) —
// see the `<Stack gap="$1">` changes column in TxActionCommon.tsx. This lets
// getWebRowHeight return an exact, taller fixed height for multi-token rows
// instead of falling back to CellMeasurer, preserving the fast-scroll path.
const CHANGE_LINE_HEIGHT = 24;

// Count how many change lines the expanded transfer view will render for a row.
// Returns 1 for non-transfer actions (approve / function call / unknown only
// ever render a single change line in tableLayout). Distinct send + receive
// token counts are a safe upper bound on the rendered lines (UTXO single-token
// and send-to-self rows collapse to fewer): over-counting only reserves a
// slightly taller fixed height (a harmless trailing gap), never a shorter one
// (which would clip the row into the next).
// getWebRowHeight runs in the scroll measurement hot path and may query the
// same row repeatedly; cache the line count by tx object identity so
// getDisplayedActions + Set construction run at most once per tx. The count is
// intrinsic to the tx's transfers (independent of tableLayout) and the tx's
// token set is stable across pending -> confirmed, so sharing one cache is
// safe. Keyed by the IAccountHistoryTx reference, entries are GC'd when the
// list data is replaced.
const transferChangeLineCountCache = new WeakMap<IAccountHistoryTx, number>();

function getTransferChangeLineCount(item: IAccountHistoryTx): number {
  const cached = transferChangeLineCountCache.get(item);
  if (cached !== undefined) {
    return cached;
  }
  const action = getDisplayedActions({ decodedTx: item.decodedTx })[0];
  let changeLineCount = 1;
  if (
    action?.type === EDecodedTxActionType.ASSET_TRANSFER &&
    action.assetTransfer
  ) {
    const { sends, receives } = action.assetTransfer;
    const distinctTokenCount = (transfers: typeof sends) =>
      new Set((transfers ?? []).map((t) => t.tokenIdOnNetwork)).size;
    changeLineCount = distinctTokenCount(sends) + distinctTokenCount(receives);
  }
  transferChangeLineCountCache.set(item, changeLineCount);
  return changeLineCount;
}

type IProps = {
  data: IAccountHistoryTx[];
  tableLayout?: boolean;
  ListHeaderComponent?: ReactElement | null;
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
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  isLoadingMore?: boolean;
  hasMore?: boolean;
};

const ListFooterComponent = ({
  accountId,
  networkId,
  walletId,
  indexedAccountId,
  showFooter,
  hasItems,
  isSingleAccount,
  isLoadingMore,
  hasMore,
}: {
  accountId?: string;
  networkId?: string;
  walletId?: string;
  indexedAccountId?: string;
  showFooter?: boolean;
  hasItems?: boolean;
  isSingleAccount?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
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

  if (isLoadingMore) {
    return (
      <YStack alignItems="center" justifyContent="center" py="$4" gap="$2">
        <Spinner size="small" />
        {addPaddingOnListFooter ? <Stack h="$16" /> : null}
      </YStack>
    );
  }

  // The "view on block explorer" button is the permanent end-of-list affordance
  // — show it whenever the list has any items and the user has truly bottomed
  // out (no more pages to fetch locally). Hide while pagination is in flight
  // (handled above) and on empty / cap-suppressed lists.
  const showExplorerFooter =
    showFooter &&
    hasItems &&
    !hasMore &&
    (network?.isAllNetworks || !vaultSettings?.hideBlockExplorer);

  if (showExplorerFooter) {
    return (
      <>
        <YStack
          alignItems="center"
          justifyContent="center"
          gap="$2"
          px="$pagePadding"
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
                <Button
                  size="small"
                  variant="secondary"
                  onPress={() => {}}
                  testID="tx-history-list-view-btn"
                >
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
              testID="tx-history-explorer-btn"
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
        px="$pagePadding"
        py="$2"
        alignItems="center"
        bg="$bgApp"
        gap="$2"
        mt={index === 0 ? '$0' : '$5'}
      >
        <Spinner size="small" color="$textCaution" />
        <SizableText numberOfLines={1} size="$headingXs" color="$textCaution">
          {intl.formatMessage({ id: ETranslations.global_confirming })}
        </SizableText>
      </XStack>
    );
  }

  return (
    <Stack py="$2" px="$pagePadding" mt={index === 0 ? '$0' : '$5'}>
      <SizableText size="$headingXs" color="$textSubdued">
        {titleText}
      </SizableText>
    </Stack>
  );
}

function BaseTxHistoryListView(props: IProps) {
  const {
    data,
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
    onEndReached,
    onEndReachedThreshold,
    isLoadingMore,
    hasMore,
  } = props;

  const [searchKey] = useSearchKeyAtom();

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

  const internalListRef = useRef<any>(null);

  const handleListRef = useCallback(
    (instance: any) => {
      internalListRef.current = instance;
      if (typeof ref === 'function') {
        ref(instance);
      } else if (ref) {
        (ref as React.MutableRefObject<any>).current = instance;
      }
    },
    [ref],
  );

  const recomputeLayout = useCallback(() => {
    if (!platformEnv.isNative) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      internalListRef.current?.recomputeLayout?.();
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
        recomputeLayout={recomputeLayout}
      />
    ),
    [hideValue, onPressHistory, showIcon, tableLayout, recomputeLayout],
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

  // Web-only fast path: TxHistoryListItem and the section header have known
  // heights, so we can skip react-virtualized's CellMeasurer entirely on the
  // desktop/web Tabs.SectionList path. This is what eliminates the visual
  // blank during fast scroll, where rows were rendering at stale absolute
  // positions because CellMeasurer's totalHeight estimate kept oscillating.
  const getWebRowHeight = useMemo<
    IGetWebRowHeight<IAccountHistoryTx> | undefined
  >(
    () =>
      inTabList && !platformEnv.isNative
        ? (info) => {
            if (info.type === 'section-header') {
              return info.sectionIndex === 0
                ? SECTION_HEADER_HEIGHT_FIRST
                : SECTION_HEADER_HEIGHT_NEXT;
            }
            if (info.type === 'section-item') {
              if (info.item?.decodedTx?.status === EDecodedTxStatus.Pending) {
                return undefined;
              }
              // A multi-token transfer renders more change lines than the base
              // height can hold (tableLayout only). Stay on the CellMeasurer-free
              // fast path by returning the exact taller height — each extra line
              // adds CHANGE_LINE_HEIGHT — so the row expands without overflowing
              // the next instead of falling back to async measurement.
              if (tableLayout && info.item) {
                const changeLineCount = getTransferChangeLineCount(info.item);
                if (changeLineCount > MAX_FIXED_HEIGHT_CHANGE_LINES) {
                  return (
                    TX_ROW_HEIGHT +
                    (changeLineCount - MAX_FIXED_HEIGHT_CHANGE_LINES) *
                      CHANGE_LINE_HEIGHT
                  );
                }
              }
              return TX_ROW_HEIGHT;
            }
            // header / footer (loading / "load more" buttons) aren't a fixed
            // height — let CellMeasurer handle them.
            return undefined;
          }
        : undefined,
    [inTabList, tableLayout],
  );

  const itemCounts = useMemo(() => {
    return sections.reduce((acc, section) => acc + section.data.length, 0);
  }, [sections]);

  const EmptyComponentElement = useMemo(() => {
    if (!initialized) {
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
      />
    );
  }, [
    initialized,
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
      ref={handleListRef as any}
      showsVerticalScrollIndicator={false}
      windowSize={platformEnv.isNativeAndroid && inTabList ? 3 : undefined}
      nestedScrollEnabled={platformEnv.isNativeAndroid ? inTabList : false}
      removeClippedSubviews={platformEnv.isNativeAndroid}
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
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold ?? 0.2}
      ListFooterComponent={
        <ListFooterComponent
          showFooter={showFooter}
          hasItems={sections.length > 0}
          accountId={accountId}
          networkId={networkId}
          walletId={walletId}
          indexedAccountId={indexedAccountId}
          isSingleAccount={isSingleAccount}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
        />
      }
      ListHeaderComponent={ListHeaderComponent}
      keyExtractor={(tx: IAccountHistoryTx, index: number) =>
        tx.id || index.toString(10)
      }
      {...((getWebRowHeight ? { getWebRowHeight } : {}) as any)}
    />
  );
}

const TxHistoryListView = withBrowserProvider<IProps>(BaseTxHistoryListView);

export { TxHistoryListView };
