import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { StackStyle } from '@onekeyhq/components/src/shared/tamagui';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import {
  convertToSectionGroups,
  getFilteredHistoryBySearchKey,
  getHistoryTxDisplayStatus,
} from '@onekeyhq/shared/src/utils/historyUtils';
import type {
  IAccountHistoryTx,
  IHistoryListSectionGroup,
} from '@onekeyhq/shared/types/history';
import type { ITokenFiat } from '@onekeyhq/shared/types/token';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { useAccountData } from '../../hooks/useAccountData';
import { useBlockExplorerNavigation } from '../../hooks/useBlockExplorerNavigation';
import { useSearchKeyAtom } from '../../states/jotai/contexts/historyList';
import { openExplorerAddressUrl } from '../../utils/explorerUtils';
import useActiveTabDAppInfo from '../../views/DAppConnection/hooks/useActiveTabDAppInfo';
import { withBrowserProvider } from '../../views/Discovery/pages/Browser/WithBrowserProvider';
import AddressTypeSelector from '../AddressTypeSelector/AddressTypeSelector';
import { EmptySearch } from '../Empty';
import { EmptyHistory } from '../Empty/EmptyHistory';
import { HistoryLoadingView } from '../Loading';

import { TxHistoryListItem } from './TxHistoryListItem';

export type ITxHistoryListViewProps = {
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
  contentContainerStyle?: StackStyle;
  hideValue?: boolean;
  onRefresh?: () => void;
  listViewStyleProps?: {
    contentContainerStyle?: StackStyle;
  };
  walletId?: string;
  accountId?: string;
  networkId?: string;
  indexedAccountId?: string;
  isSingleAccount?: boolean;
  tokenMap?: Record<string, ITokenFiat>;
  plainMode?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onEndReached?: () => void | Promise<void>;
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
              whenCollapsed="skip"
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

function TxHistoryListViewSectionHeader({
  title,
  titleKey,
  data,
  index,
}: IHistoryListSectionGroup & { index: number }) {
  const intl = useIntl();
  const titleText = title || intl.formatMessage({ id: titleKey }) || '';

  if (
    data[0] &&
    getHistoryTxDisplayStatus(data[0]) === EDecodedTxStatus.Pending
  ) {
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

function BaseTxHistoryListView({
  data,
  initialized,
  tableLayout,
  plainMode,
  showIcon,
  onPressHistory,
  hideValue,
  walletId,
  accountId,
  networkId,
  indexedAccountId,
  isSingleAccount,
  tokenMap,
}: ITxHistoryListViewProps) {
  const [searchKey] = useSearchKeyAtom();
  const sections = useMemo(
    () =>
      convertToSectionGroups({
        items: getFilteredHistoryBySearchKey({ history: data, searchKey }),
        formatDate: (date: number) =>
          formatDate(new Date(date), { hideTimeForever: true }),
      }),
    [data, searchKey],
  );

  if (!sections.length) {
    if (!initialized) return <HistoryLoadingView tableLayout={tableLayout} />;
    if (searchKey && data.length > 0) return <EmptySearch />;
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
  }

  return (
    <YStack>
      {sections.map((section, index) => (
        <YStack key={section.title}>
          <TxHistoryListViewSectionHeader {...section} index={index} />
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

const TxHistoryListView = withBrowserProvider<ITxHistoryListViewProps>(
  BaseTxHistoryListView,
);

export { TxHistoryListView, ListFooterComponent };
