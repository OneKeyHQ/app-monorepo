import { memo, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Divider,
  Empty,
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { isAddressOwnedByDeactivatedBotWallet } from '@onekeyhq/kit/src/utils/botWalletAccountUtils';
import { showBotWalletDisabledToast } from '@onekeyhq/kit/src/utils/botWalletDisabledToast';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes/addressBook';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import {
  QuickSelectListItemFrame,
  QuickSelectListSkeleton,
  RecipientDetailLine,
} from './QuickSelectListShared';
import {
  isLookalikeAddress,
  shortenRecipientAddress,
} from './recipientListAddressUtils';
import {
  normalizeSearchKey,
  prioritizeNameThenAddressMatches,
} from './searchMatchUtils';
import { useRecentRecipientsData } from './useRecentRecipientsData';
import { useStableItemPress } from './useStableItemPress';

import type { IEnrichedRecentRecipient } from './useRecentRecipientsData';

interface IRecentRecipientsProps {
  accountId?: string;
  networkId: string;
  onSelect?: (params: {
    address: string;
    memo?: string;
    note?: string;
  }) => void;
  searchKey?: string;
  isSearchMode?: boolean;
  compact?: boolean;
  onMatchStatusChange?: (hasMatches: boolean, matchCount: number) => void;
  onLastUsedDeriveTypeChange?: (deriveType: string | undefined) => void;
  // Lookalikes among every tab's addresses; those rows show the full address.
  lookalikeAddresses?: ReadonlySet<string>;
  onAddressesChange?: (addresses: string[]) => void;
  refreshKey?: number;
}

type IQuickItem = {
  id?: string;
  name: string;
  address: string;
  memo?: string;
  note?: string;
  lastTransferTime?: number;
  lastTransferNetworkName?: string;
  isAddressBook?: boolean;
  walletName?: string;
  accountName?: string;
  walletId?: string;
  wallet?: IDBWallet;
};

// The address a row stands for, also what the lookalike check compares.
function getRecipientAddress(recipient: IEnrichedRecentRecipient): string {
  return recipient.validAddress ?? recipient.input ?? '';
}

function QuickSelectListItemBase({
  item,
  showFullAddress,
  canAddToAddressBook,
  keepWalletName,
  onPress,
  formatRelativeTime,
  intl,
  networkId,
}: {
  item: IQuickItem;
  showFullAddress: boolean;
  canAddToAddressBook: boolean;
  keepWalletName: boolean;
  onPress?: (item: IQuickItem) => void;
  formatRelativeTime?: (time: number) => string;
  intl: ReturnType<typeof useIntl>;
  networkId: string;
}) {
  const navigation = useAppNavigation();
  const handlePress = useCallback(() => onPress?.(item), [item, onPress]);

  const hasName = !!item.name;
  // The first line says who it is: the name, or the short address.
  const primaryText = hasName
    ? item.name
    : shortenRecipientAddress(item.address);

  // On EVM one address serves every chain: an unnamed address shows where
  // it was last paid, and an address book entry saved for every EVM chain
  // says so.
  const isEvmNetwork = networkUtils.isEvmNetwork({ networkId });
  let networkText: string | undefined;
  if (isEvmNetwork && item.isAddressBook) {
    networkText = 'EVM';
  } else if (isEvmNetwork && !hasName) {
    networkText = item.lastTransferNetworkName;
  }
  const addToAddressBookLabel = intl.formatMessage({
    id: ETranslations.add_to_address_book__action,
  });

  const handleAddToAddressBook = useCallback(() => {
    navigation.pushModal(EModalRoutes.AddressBookModal, {
      screen: EModalAddressBookRoutes.EditItemModal,
      params: {
        address: item.address,
        networkId,
      },
    });
  }, [navigation, item.address, networkId]);

  const handleLongPress = useCallback(() => {
    if (!canAddToAddressBook) return;
    ActionList.show({
      title: primaryText,
      sections: [
        {
          items: [
            {
              label: addToAddressBookLabel,
              icon: 'BookOpenOutline',
              onPress: handleAddToAddressBook,
            },
          ],
        },
      ],
    });
  }, [
    canAddToAddressBook,
    primaryText,
    addToAddressBookLabel,
    handleAddToAddressBook,
  ]);

  let primary: ReactNode;
  if (item.isAddressBook) {
    primary = (
      <XStack alignItems="center" gap="$1.5">
        <Icon name="BookOpenOutline" size="$4" color="$iconSubdued" />
        <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
          {item.name}
        </SizableText>
      </XStack>
    );
  } else if (item.walletName && item.accountName) {
    // The account tells rows apart, so the wallet before it gives way first;
    // the account's width cap leaves the wallet at least the rest of the
    // line. The wallet stays whole when it is needed: two rows share the
    // account name, or it says the keys are elsewhere (watch-only,
    // connected).
    primary = (
      <XStack alignItems="center">
        <SizableText
          size="$bodyLg"
          color="$textSubdued"
          numberOfLines={1}
          flexShrink={keepWalletName ? 0 : 1}
        >
          {item.walletName}
        </SizableText>
        <SizableText size="$bodyLg" color="$textSubdued" flexShrink={0}>
          {' / '}
        </SizableText>
        <SizableText
          size="$bodyLgMedium"
          numberOfLines={1}
          flexShrink={keepWalletName ? 1 : 0}
          maxWidth={keepWalletName ? undefined : '70%'}
        >
          {item.accountName}
        </SizableText>
      </XStack>
    );
  } else {
    primary = (
      <SizableText size="$bodyLgMedium" numberOfLines={1}>
        {primaryText}
      </SizableText>
    );
  }

  return (
    <QuickSelectListItemFrame
      address={item.address}
      walletId={item.walletId}
      wallet={item.wallet}
      onPress={handlePress}
      onLongPress={platformEnv.isNative ? handleLongPress : undefined}
      testID={`recent-item-${item.address}`}
      primary={primary}
      secondary={
        <RecipientDetailLine
          address={item.address}
          memo={item.memo}
          note={item.note}
          showFullAddress={showFullAddress}
          before={[
            hasName ? shortenRecipientAddress(item.address) : undefined,
            networkText,
          ]}
          after={[
            item.lastTransferTime && formatRelativeTime
              ? formatRelativeTime(item.lastTransferTime)
              : undefined,
          ]}
        />
      }
      trailing={
        canAddToAddressBook ? (
          <ActionList
            title={primaryText}
            items={[
              {
                label: addToAddressBookLabel,
                icon: 'BookOpenOutline',
                onPress: handleAddToAddressBook,
              },
            ]}
            renderTrigger={
              <ListItem.IconButton
                icon="DotVerSolid"
                testID={`recent-menu-${item.address}`}
              />
            }
          />
        ) : null
      }
    />
  );
}

// Rows compare by data plus the `onPress` identity: the parent passes one
// stable handler (useStableItemPress), so a row only re-renders on real data
// changes yet never holds on to a stale callback.
const QuickSelectListItem = memo(
  QuickSelectListItemBase,
  (prevProps, nextProps) =>
    prevProps.onPress === nextProps.onPress &&
    prevProps.showFullAddress === nextProps.showFullAddress &&
    prevProps.canAddToAddressBook === nextProps.canAddToAddressBook &&
    prevProps.keepWalletName === nextProps.keepWalletName &&
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.address === nextProps.item.address &&
    prevProps.item.name === nextProps.item.name &&
    prevProps.item.memo === nextProps.item.memo &&
    prevProps.item.note === nextProps.item.note &&
    prevProps.item.lastTransferTime === nextProps.item.lastTransferTime &&
    prevProps.item.lastTransferNetworkName ===
      nextProps.item.lastTransferNetworkName &&
    prevProps.item.isAddressBook === nextProps.item.isAddressBook &&
    prevProps.item.walletName === nextProps.item.walletName &&
    prevProps.item.accountName === nextProps.item.accountName &&
    prevProps.item.walletId === nextProps.item.walletId &&
    prevProps.item.wallet?.id === nextProps.item.wallet?.id &&
    prevProps.networkId === nextProps.networkId &&
    prevProps.intl.locale === nextProps.intl.locale &&
    prevProps.formatRelativeTime === nextProps.formatRelativeTime,
);

function RecentRecipients(props: IRecentRecipientsProps) {
  const intl = useIntl();
  const {
    accountId,
    networkId,
    searchKey: rawSearchKey,
    isSearchMode,
    onSelect,
    compact = false,
    onMatchStatusChange,
    onLastUsedDeriveTypeChange,
    lookalikeAddresses,
    onAddressesChange,
    refreshKey,
  } = props;

  const { formatDistanceToNowStrict } = useFormatDate();

  // Compact time format: "2h ago" / "3d ago" for Latin, "2小时前" / "3天前" for CJK
  const formatCompactTime = useCallback(
    (date: Date | number) => {
      const now = Date.now();
      const ts = typeof date === 'number' ? date : date.getTime();
      const diffMs = now - ts;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);
      const diffMonth = Math.floor(diffDay / 30);
      const diffYear = Math.floor(diffDay / 365);

      // For CJK locales, use the localized strict format
      if (/^(zh|ja|ko)/.test(intl.locale)) {
        return formatDistanceToNowStrict(date);
      }

      // Short English-style format for all other locales
      if (diffYear > 0) return `${diffYear}y ago`;
      if (diffMonth > 0) return `${diffMonth}mo ago`;
      if (diffDay > 0) return `${diffDay}d ago`;
      if (diffHour > 0) return `${diffHour}h ago`;
      if (diffMin > 0) return `${diffMin}m ago`;
      return 'now';
    },
    [intl.locale, formatDistanceToNowStrict],
  );

  const {
    recentRecipients,
    isLoadingRecent,
    isLoadingMore,
    lastUsedDeriveType,
  } = useRecentRecipientsData({
    accountId,
    networkId,
    refreshKey,
  });

  useEffect(() => {
    onLastUsedDeriveTypeChange?.(lastUsedDeriveType);
  }, [lastUsedDeriveType, onLastUsedDeriveTypeChange]);

  useEffect(() => {
    onAddressesChange?.(
      recentRecipients.map(getRecipientAddress).filter(Boolean),
    );
  }, [recentRecipients, onAddressesChange]);

  const debouncedSearchKey = useDebounce(rawSearchKey, 300);
  const trimmedSearchKey = normalizeSearchKey(debouncedSearchKey);
  const isSearchActive = !!(isSearchMode && trimmedSearchKey);
  // Detect debounce gap: searchKey changed but debounce hasn't settled yet
  const isDebouncing = isSearchMode && rawSearchKey !== debouncedSearchKey;

  const filteredRecentRecipients = useMemo(() => {
    if (!isSearchActive) {
      return recentRecipients;
    }
    return prioritizeNameThenAddressMatches({
      items: recentRecipients,
      isNameMatch: (recipient) =>
        (recipient.walletAccountName
          ?.toLowerCase()
          .includes(trimmedSearchKey) ??
          false) ||
        (recipient.addressBookItemName
          ?.toLowerCase()
          .includes(trimmedSearchKey) ??
          false),
      isAddressMatch: (recipient) =>
        (recipient.input?.toLowerCase().includes(trimmedSearchKey) ?? false) ||
        (recipient.validAddress?.toLowerCase().includes(trimmedSearchKey) ??
          false),
    }).sorted;
  }, [isSearchActive, recentRecipients, trimmedSearchKey]);

  const recentWalletIds = useMemo(
    () =>
      Array.from(
        new Set(
          recentRecipients
            .map((recipient) => recipient.walletId)
            .filter((walletId): walletId is string => !!walletId),
        ),
      ),
    [recentRecipients],
  );
  const { result: recentWalletMap = new Map<string, IDBWallet>() } =
    usePromiseResult<Map<string, IDBWallet>>(
      async () => {
        if (recentWalletIds.length === 0) {
          return new Map();
        }

        const walletEntries = await Promise.all(
          recentWalletIds.map(async (walletId) => {
            try {
              const wallet = await backgroundApiProxy.serviceAccount.getWallet({
                walletId,
              });
              return [walletId, wallet] as const;
            } catch {
              return undefined;
            }
          }),
        );

        return new Map(
          walletEntries.filter(
            (entry): entry is readonly [string, IDBWallet] => !!entry,
          ),
        );
      },
      [recentWalletIds],
      { initResult: new Map(), undefinedResultIfError: true },
    );

  // Pre-compute deactivated-bot-wallet status for every recent recipient so
  // the per-tap check is a sync map lookup instead of an IPC round-trip.
  // Recipients without a walletId are external addresses and can't belong
  // to a bot wallet — they default to false.
  const { result: deactivatedRecipientWalletIds = new Set<string>() } =
    usePromiseResult<Set<string>>(
      async () => {
        if (recentWalletIds.length === 0) {
          return new Set();
        }
        try {
          const statusMap =
            await backgroundApiProxy.serviceAccount.getBotWalletDeactivationStatusMap(
              { walletIds: recentWalletIds },
            );
          return new Set(
            Object.entries(statusMap)
              .filter(([, isDeactivated]) => isDeactivated)
              .map(([walletId]) => walletId),
          );
        } catch {
          return new Set();
        }
      },
      [recentWalletIds],
      { initResult: new Set(), undefinedResultIfError: true },
    );

  const handleRecipientPress = useStableItemPress(async (item: IQuickItem) => {
    // Recents may include addresses that belong to a bot wallet
    // which has since been deactivated. Block selection so we
    // don't paste a dead address into the recipient input — show
    // a toast so the user understands why the row is rejected.
    // Fast path: recipients with a known walletId resolve via the
    // precomputed set (no IPC). Recipients without a walletId
    // (e.g. BTC fresh addresses) still need the async lookup.
    if (item.walletId) {
      if (deactivatedRecipientWalletIds.has(item.walletId)) {
        showBotWalletDisabledToast('beReceiver');
        return;
      }
    } else if (
      await isAddressOwnedByDeactivatedBotWallet({
        networkId,
        address: item.address,
      })
    ) {
      showBotWalletDisabledToast('beReceiver');
      return;
    }
    onSelect?.({
      address: item.address,
      memo: item.memo,
    });
  });

  // Notify parent of match status and count.
  // Skip during debounce — parent resets tabMatchStatus to null on
  // searchKey change, so allReported stays false until we re-report.
  useEffect(() => {
    if (isDebouncing) return;
    onMatchStatusChange?.(
      filteredRecentRecipients.length > 0,
      filteredRecentRecipients.length,
    );
  }, [filteredRecentRecipients.length, onMatchStatusChange, isDebouncing]);

  // Account names shown more than once ("Account #1" in two wallets) need
  // the wallet name in full to tell the rows apart.
  const accountNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    filteredRecentRecipients.forEach((recipient) => {
      if (
        !recipient.isAddressBook &&
        recipient.walletName &&
        recipient.accountName
      ) {
        counts.set(
          recipient.accountName,
          (counts.get(recipient.accountName) ?? 0) + 1,
        );
      }
    });
    return counts;
  }, [filteredRecentRecipients]);

  // Lightning Network doesn't support address book.
  const isLightningNetwork =
    networkUtils.isLightningNetworkByNetworkId(networkId);

  const renderContent = useCallback(() => {
    if (!filteredRecentRecipients.length && isLoadingRecent) {
      return <QuickSelectListSkeleton />;
    }
    if (filteredRecentRecipients.length > 0) {
      return filteredRecentRecipients.map((recipient) => {
        const canonicalAddress = getRecipientAddress(recipient);
        const isLookalike = isLookalikeAddress(
          lookalikeAddresses,
          canonicalAddress,
        );
        return (
          <QuickSelectListItem
            key={canonicalAddress}
            item={{
              id: canonicalAddress,
              name:
                recipient.addressBookItemName ??
                recipient.walletAccountName ??
                '',
              address: canonicalAddress,
              memo: recipient.recipientMemo,
              lastTransferTime: recipient.lastTransferTime,
              lastTransferNetworkName: recipient.lastTransferNetworkName,
              isAddressBook: recipient.isAddressBook,
              walletName: recipient.walletName,
              accountName: recipient.accountName,
              walletId: recipient.walletId,
              wallet: recipient.walletId
                ? recentWalletMap.get(recipient.walletId)
                : undefined,
            }}
            showFullAddress={isSearchActive || isLookalike}
            // Offered for addresses worth saving: not saved yet, not an
            // account the user signs with, and not a lookalike, which a
            // saved contact would let past the similarity checks. Watch-only
            // and connected accounts keep it: with the transfer allowlist on
            // they must be saved before a send.
            canAddToAddressBook={
              !recipient.isAddressBook &&
              !isLightningNetwork &&
              !isLookalike &&
              !(
                recipient.walletAccountId &&
                accountUtils.isOwnAccount({
                  accountId: recipient.walletAccountId,
                })
              )
            }
            keepWalletName={
              (accountNameCounts.get(recipient.accountName ?? '') ?? 0) > 1 ||
              accountUtils.isWatchingWallet({ walletId: recipient.walletId }) ||
              accountUtils.isExternalWallet({ walletId: recipient.walletId })
            }
            intl={intl}
            networkId={networkId}
            formatRelativeTime={formatCompactTime}
            onPress={handleRecipientPress}
          />
        );
      });
    }
    if (isSearchActive) {
      return (
        <Empty
          mt="$3"
          icon="SearchOutline"
          title={intl.formatMessage({
            id: ETranslations.no_search_results__title,
          })}
        />
      );
    }
    return (
      <Empty
        mt="$3"
        icon="ClockTimeHistoryOutline"
        title={intl.formatMessage({
          id: ETranslations.transfer_recent_transfers,
        })}
        description={intl.formatMessage({
          id: ETranslations.transfer_recent_transfers_empty,
        })}
      />
    );
  }, [
    accountNameCounts,
    filteredRecentRecipients,
    formatCompactTime,
    intl,
    isLightningNetwork,
    isLoadingRecent,
    isSearchActive,
    lookalikeAddresses,
    networkId,
    handleRecipientPress,
    recentWalletMap,
  ]);

  return (
    <Stack mx={compact ? 0 : -20}>
      {compact ? null : <Divider mb="$5" borderColor="$borderSubdued" />}
      {compact ? null : (
        <SizableText size="$bodyMd" color="$textSubdued" mb="$2" ml="$5">
          {intl.formatMessage({ id: ETranslations.transfer_recent_transfers })}
        </SizableText>
      )}
      {renderContent()}
      {isLoadingMore ? (
        <XStack justifyContent="center" py="$3">
          <Spinner size="small" />
        </XStack>
      ) : null}
    </Stack>
  );
}

export default RecentRecipients;
