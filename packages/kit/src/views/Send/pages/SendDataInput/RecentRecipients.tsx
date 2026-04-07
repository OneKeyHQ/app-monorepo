import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import {
  ActionList,
  Divider,
  Empty,
  MatchSizeableText,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
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
} from './QuickSelectListShared';
import {
  normalizeSearchKey,
  prioritizeNameThenAddressMatches,
} from './searchMatchUtils';
import { useRecentRecipientsData } from './useRecentRecipientsData';

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
  walletId?: string;
  wallet?: IDBWallet;
};

function QuickSelectListItemBase({
  item,
  onPress,
  formatRelativeTime,
  intl,
  networkId,
}: {
  item: IQuickItem;
  onPress?: () => void;
  formatRelativeTime?: (time: number) => string;
  intl: ReturnType<typeof useIntl>;
  networkId: string;
}) {
  const navigation = useAppNavigation();
  const [isHovered, setIsHovered] = useState(false);

  // Animated style for hover menu opacity
  const menuAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isHovered ? 1 : 0, { duration: 150 }),
  }));

  // Determine display mode based on available info
  const hasName = !!item.name;

  // Build primary text: Name or shortened address as identifier
  const primaryText = useMemo(() => {
    if (hasName) {
      return item.name;
    }
    return accountUtils.shortenAddress({ address: item.address });
  }, [hasName, item.name, item.address]);

  // Show network name badge only on EVM (where recipients may span multiple chains)
  const isEvmNetwork = networkUtils.isEvmNetwork({ networkId });
  const showNetworkBadge =
    isEvmNetwork && !hasName && !!item.lastTransferNetworkName;

  // Only show menu for items NOT already in address book
  const showAddToAddressBook = !item.isAddressBook;

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
    if (!showAddToAddressBook) return;
    ActionList.show({
      title: item.address,
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
    showAddToAddressBook,
    item.address,
    addToAddressBookLabel,
    handleAddToAddressBook,
  ]);

  return (
    <QuickSelectListItemFrame
      address={item.address}
      walletId={item.walletId}
      wallet={item.wallet}
      onPress={onPress}
      onLongPress={platformEnv.isNative ? handleLongPress : undefined}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      testID={`recent-item-${item.address}`}
      primary={
        <XStack gap="$2" alignItems="center">
          <SizableText
            size="$bodyLgMedium"
            numberOfLines={1}
            flexShrink={1}
            minWidth="$20"
          >
            {primaryText}
          </SizableText>
          {item.isAddressBook ? (
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              flexShrink={0}
              maxWidth="$32"
              numberOfLines={1}
            >
              {isEvmNetwork
                ? 'EVM'
                : (item.lastTransferNetworkName ??
                  intl.formatMessage({
                    id: ETranslations.address_book_title,
                  }))}
            </SizableText>
          ) : null}
          {showNetworkBadge ? (
            <SizableText
              size="$bodySm"
              color="$textDisabled"
              flexShrink={0}
              maxWidth="$24"
              numberOfLines={1}
            >
              {item.lastTransferNetworkName}
            </SizableText>
          ) : null}
          {item.lastTransferTime && formatRelativeTime ? (
            <SizableText
              size="$bodySm"
              color="$textDisabled"
              flexShrink={2}
              numberOfLines={1}
            >
              {formatRelativeTime(item.lastTransferTime)}
            </SizableText>
          ) : null}
        </XStack>
      }
      secondary={
        <MatchSizeableText
          size="$bodyMd"
          color="$textSubdued"
          wordWrap="break-word"
        >
          {item.memo ? `${item.address} · ${item.memo}` : item.address}
        </MatchSizeableText>
      }
      trailing={
        showAddToAddressBook && !platformEnv.isNative ? (
          <Animated.View style={[{ marginLeft: 8 }, menuAnimatedStyle]}>
            <ActionList
              title={item.address}
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
          </Animated.View>
        ) : null
      }
    />
  );
}

const QuickSelectListItem = memo(
  QuickSelectListItemBase,
  (prevProps, nextProps) =>
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

  const { recentRecipients, isLoadingRecent } = useRecentRecipientsData({
    accountId,
    networkId,
    refreshKey,
  });

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
        (recipient.addressBookName?.toLowerCase().includes(trimmedSearchKey) ??
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

  // Notify parent of match status and count
  useEffect(() => {
    // Skip reporting stale counts during debounce gap to prevent badge flickering
    if (isDebouncing) return;
    onMatchStatusChange?.(
      filteredRecentRecipients.length > 0,
      filteredRecentRecipients.length,
    );
  }, [filteredRecentRecipients.length, onMatchStatusChange, isDebouncing]);

  const renderContent = useCallback(() => {
    if (!filteredRecentRecipients.length && isLoadingRecent) {
      return <QuickSelectListSkeleton />;
    }
    if (filteredRecentRecipients.length > 0) {
      return filteredRecentRecipients.map((recipient) => {
        const canonicalAddress =
          recipient.validAddress ?? recipient.input ?? '';
        return (
          <QuickSelectListItem
            key={canonicalAddress}
            item={{
              id: canonicalAddress,
              name:
                recipient.addressBookName ?? recipient.walletAccountName ?? '',
              address: canonicalAddress,
              memo: recipient.addressMemo || recipient.recipientMemo,
              note: recipient.addressNote,
              lastTransferTime: recipient.lastTransferTime,
              lastTransferNetworkName: recipient.lastTransferNetworkName,
              isAddressBook: recipient.isAddressBook,
              walletName: recipient.walletName,
              walletId: recipient.walletId,
              wallet: recipient.walletId
                ? recentWalletMap.get(recipient.walletId)
                : undefined,
            }}
            intl={intl}
            networkId={networkId}
            formatRelativeTime={formatCompactTime}
            onPress={() => {
              onSelect?.({
                address: canonicalAddress,
                memo: recipient.addressMemo || recipient.recipientMemo,
                note: recipient.addressNote,
              });
            }}
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
    filteredRecentRecipients,
    formatCompactTime,
    intl,
    isLoadingRecent,
    isSearchActive,
    networkId,
    onSelect,
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
    </Stack>
  );
}

export default RecentRecipients;
