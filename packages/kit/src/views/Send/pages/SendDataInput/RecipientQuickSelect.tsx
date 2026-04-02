import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { flatten, map } from 'lodash';
import { useIntl } from 'react-intl';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  Badge,
  Empty,
  MatchSizeableText,
  SegmentControl,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IAddressNetworkItem } from '@onekeyhq/kit/src/views/AddressBook/type';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { useAddressBookPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/addressBooks';
import type { IAccountDeriveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes/addressBook';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { promiseAllSettledEnhanced } from '@onekeyhq/shared/src/utils/promiseUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EInputAddressChangeType } from '@onekeyhq/shared/types/address';

import {
  QuickSelectListItemFrame,
  QuickSelectListSkeleton,
} from './QuickSelectListShared';
import RecentRecipients from './RecentRecipients';
import {
  type IRecipientQuickSelectTab,
  type IRecipientTabMatchStatus,
  getAutoSwitchRecipientTab,
} from './recipientQuickSelectTabUtils';
import {
  normalizeSearchKey,
  prioritizeNameThenAddressMatches,
} from './searchMatchUtils';

type IRecipientQuickSelectProps = {
  accountId?: string;
  networkId: string;
  searchKey?: string;
  isSearchMode?: boolean;
  activeTab?: IRecipientQuickSelectTab;
  onActiveTabChange?: (tab: IRecipientQuickSelectTab) => void;
  onInputTypeChange?: (type: EInputAddressChangeType) => void;
  onSelect?: (params: {
    address: string;
    memo?: string;
    note?: string;
  }) => void;
  onMatchStatusChange?: (hasMatches: boolean) => void;
};

type IAccountRecipientsProps = {
  networkId: string;
  searchKey?: string;
  isSearchMode?: boolean;
  onInputTypeChange?: (type: EInputAddressChangeType) => void;
  onSelect?: (params: { address: string }) => void;
  onMatchStatusChange?: (hasMatches: boolean, matchCount: number) => void;
};

type IQuickItem = {
  id?: string;
  name: string;
  address: string;
  memo?: string;
  note?: string;
  deriveLabel?: string;
  walletId?: string;
  wallet?: IDBWallet;
};

const QuickSelectListItem = memo(
  ({ item, onPress }: { item: IQuickItem; onPress?: () => void }) => {
    // Use name if available, otherwise show truncated address as primary
    const displayName =
      item.name || accountUtils.shortenAddress({ address: item.address });
    return (
      <QuickSelectListItemFrame
        address={item.address}
        walletId={item.walletId}
        wallet={item.wallet}
        onPress={onPress}
        testID={`recipient-item-${item.address}`}
        primary={
          <XStack gap="$2" alignItems="center">
            <MatchSizeableText size="$bodyLgMedium">
              {displayName}
            </MatchSizeableText>
            {item.deriveLabel ? (
              <Badge badgeSize="sm" badgeType="default">
                {item.deriveLabel}
              </Badge>
            ) : null}
          </XStack>
        }
        secondary={
          <MatchSizeableText size="$bodyMd" color="$textSubdued">
            {item.memo ? `${item.address} · ${item.memo}` : item.address}
          </MatchSizeableText>
        }
      />
    );
  },
  (prevProps, nextProps) =>
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.address === nextProps.item.address &&
    prevProps.item.name === nextProps.item.name &&
    prevProps.item.deriveLabel === nextProps.item.deriveLabel &&
    prevProps.item.memo === nextProps.item.memo &&
    prevProps.item.note === nextProps.item.note &&
    prevProps.item.wallet?.id === nextProps.item.wallet?.id,
);
QuickSelectListItem.displayName = 'QuickSelectListItem';

// Account with derive type info
type IAccountWithDeriveInfo = {
  account: INetworkAccount;
  deriveInfo?: IAccountDeriveInfo;
};

// Wallet account group type
type IWalletGroup = {
  walletId: string;
  walletName: string;
  isHardwareWallet: boolean;
  accounts: IAccountWithDeriveInfo[];
  wallet: IDBWallet;
};

const NETWORK_ACCOUNTS_FETCH_CONCURRENCY = 4;
const WALLET_GROUP_FETCH_CONCURRENCY = 6;

// Get wallet accounts on the specified network (with derive type info)
async function getWalletNetworkAccounts(
  wallet: IDBWallet,
  networkId: string,
): Promise<IAccountWithDeriveInfo[]> {
  const { dbIndexedAccounts } = wallet;

  if (!dbIndexedAccounts?.length) {
    return [];
  }

  const accountRequestTaskFactories = dbIndexedAccounts.map(
    (indexedAccount) => async () => {
      const resp =
        await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
          {
            networkId,
            indexedAccountId: indexedAccount.id,
            excludeEmptyAccount: true,
          },
        );
      return resp.networkAccounts;
    },
  );

  const results = await promiseAllSettledEnhanced(accountRequestTaskFactories, {
    continueOnError: true,
    concurrency: NETWORK_ACCOUNTS_FETCH_CONCURRENCY,
  });
  // Extract all accounts with derive type info
  const allAccounts = flatten(
    map(results, (item) =>
      (item ?? [])
        .filter((acc) => acc.account)
        .map((acc) => ({
          account: acc.account as INetworkAccount,
          deriveInfo: acc.deriveInfo,
        })),
    ),
  );

  return allAccounts;
}

function AccountRecipients({
  networkId,
  searchKey,
  isSearchMode,
  onInputTypeChange,
  onSelect,
  onMatchStatusChange,
}: IAccountRecipientsProps) {
  const intl = useIntl();

  // Get all wallets and their accounts (reuses BulkCopyAddresses logic)
  const { result: walletGroups = [], isLoading: isLoadingAccounts } =
    usePromiseResult<IWalletGroup[]>(
      async () => {
        if (!networkId) {
          return [];
        }

        // Fetch wallets, filter non-backed-up, include accounts
        const { wallets } = await backgroundApiProxy.serviceAccount.getWallets({
          ignoreEmptySingletonWalletAccounts: true,
          ignoreNonBackedUpWallets: true,
          nestedHiddenWallets: true,
          includingAccounts: true,
        });

        const walletGroupTaskFactories: Array<
          () => Promise<IWalletGroup | null>
        > = [];

        const createWalletGroupTaskFactory =
          (wallet: IDBWallet, walletName: string) =>
          async (): Promise<IWalletGroup | null> => {
            const accounts = await getWalletNetworkAccounts(wallet, networkId);
            if (accounts.length === 0) {
              return null;
            }
            return {
              walletId: wallet.id,
              walletName,
              isHardwareWallet: accountUtils.isHwWallet({
                walletId: wallet.id,
              }),
              accounts,
              wallet,
            };
          };

        for (const wallet of wallets) {
          // Skip watch-only, deprecated, and deleted (mocked) wallets
          // Keep HD, Hardware, External, Imported, QR wallets
          const shouldSkip =
            accountUtils.isWatchingWallet({ walletId: wallet.id }) ||
            wallet.deprecated ||
            wallet.isMocked;

          if (shouldSkip) {
            // eslint-disable-next-line no-continue
            continue;
          }

          walletGroupTaskFactories.push(
            createWalletGroupTaskFactory(wallet, wallet.name),
          );

          for (const hiddenWallet of wallet.hiddenWallets ?? []) {
            if (hiddenWallet.deprecated || hiddenWallet.isMocked) {
              // eslint-disable-next-line no-continue
              continue;
            }
            walletGroupTaskFactories.push(
              createWalletGroupTaskFactory(
                hiddenWallet,
                `${wallet.name} - ${hiddenWallet.name}`,
              ),
            );
          }
        }

        const groups = await promiseAllSettledEnhanced(
          walletGroupTaskFactories,
          {
            continueOnError: true,
            concurrency: WALLET_GROUP_FETCH_CONCURRENCY,
          },
        );
        return groups.filter((group): group is IWalletGroup => !!group);
      },
      [networkId],
      { initResult: [], watchLoading: true, undefinedResultIfError: true },
    );

  const debouncedSearchKey = useDebounce(searchKey, 300);
  const trimmedSearchKey = normalizeSearchKey(debouncedSearchKey);
  const isSearchActive = !!(isSearchMode && trimmedSearchKey);
  const searchValue = trimmedSearchKey;
  // Detect debounce gap: searchKey changed but debounce hasn't settled yet
  const isDebouncing = isSearchMode && searchKey !== debouncedSearchKey;

  // Filter accounts (name matches first, then address matches)
  const filteredWalletGroups = useMemo(() => {
    if (!walletGroups || !Array.isArray(walletGroups)) {
      return [];
    }
    if (!isSearchActive) {
      return walletGroups;
    }

    const nameMatchedGroups: typeof walletGroups = [];
    const addressOnlyGroups: typeof walletGroups = [];

    for (const group of walletGroups) {
      if (!group) {
        // skip null/undefined groups
      } else if ((group.walletName ?? '').toLowerCase().includes(searchValue)) {
        nameMatchedGroups.push(group);
      } else {
        const accounts = group.accounts ?? [];
        const { nameMatched, sorted: sortedAccounts } =
          prioritizeNameThenAddressMatches({
            items: accounts,
            isNameMatch: (item) =>
              (item.account?.name ?? '').toLowerCase().includes(searchValue),
            isAddressMatch: (item) => {
              const address =
                item.account?.address ?? item.account?.addressDetail?.address;
              return address?.toLowerCase().includes(searchValue) ?? false;
            },
          });

        if (sortedAccounts.length > 0) {
          const updatedGroup = { ...group, accounts: sortedAccounts };
          if (nameMatched.length > 0) {
            nameMatchedGroups.push(updatedGroup);
          } else {
            addressOnlyGroups.push(updatedGroup);
          }
        }
      }
    }

    return [...nameMatchedGroups, ...addressOnlyGroups];
  }, [walletGroups, isSearchActive, searchValue]);

  // Notify parent of match status and count
  const accountMatchCount = useMemo(
    () =>
      filteredWalletGroups.reduce(
        (sum, group) => sum + (group?.accounts?.length ?? 0),
        0,
      ),
    [filteredWalletGroups],
  );
  useEffect(() => {
    // Skip reporting stale counts during debounce gap to prevent badge flickering
    if (isDebouncing) return;
    onMatchStatusChange?.(accountMatchCount > 0, accountMatchCount);
  }, [accountMatchCount, onMatchStatusChange, isDebouncing]);

  // Handle account selection
  const handleSelectAccount = useCallback(
    (item: IAccountWithDeriveInfo) => {
      const account = item?.account;
      if (!account) return;
      const address = account.address ?? account.addressDetail?.address ?? '';
      onInputTypeChange?.(EInputAddressChangeType.AccountSelector);
      onSelect?.({ address });
    },
    [onInputTypeChange, onSelect],
  );

  // Get derive type label
  const getDeriveLabel = useCallback(
    (deriveInfo?: IAccountDeriveInfo) => {
      if (!deriveInfo) return undefined;
      if (deriveInfo.labelKey) {
        return intl.formatMessage({ id: deriveInfo.labelKey });
      }
      return deriveInfo.label;
    },
    [intl],
  );

  // Convert wallet groups to sections format for SectionList
  const sections = useMemo(() => {
    if (!filteredWalletGroups || !Array.isArray(filteredWalletGroups)) {
      return [];
    }
    return filteredWalletGroups.map((group) => {
      // Check if this wallet group has multiple derive types
      const accounts = group?.accounts ?? [];
      const deriveTypes = new Set(
        accounts
          .map((item) => item.deriveInfo?.label || item.deriveInfo?.labelKey)
          .filter(Boolean),
      );
      const hasMultipleDeriveTypes = deriveTypes.size > 1;

      return {
        title: group?.walletName ?? '',
        walletId: group?.walletId ?? '',
        wallet: group?.wallet,
        hasMultipleDeriveTypes,
        data: accounts,
      };
    });
  }, [filteredWalletGroups]);

  // Flatten sections for simple rendering with section headers
  type IFlatItem =
    | { type: 'header'; title: string; walletId: string }
    | {
        type: 'account';
        account: INetworkAccount;
        deriveInfo?: IAccountDeriveInfo;
        hasMultipleDeriveTypes: boolean;
        walletId: string;
        walletName: string;
        wallet?: IDBWallet;
      };

  const flattenedItems = useMemo<IFlatItem[]>(
    () =>
      sections.flatMap((section) => {
        const items: IFlatItem[] = [];
        // Add section header
        if (section.title) {
          items.push({
            type: 'header',
            title: section.title,
            walletId: section.walletId,
          });
        }
        // Add account items
        (section.data ?? []).forEach((item) => {
          items.push({
            type: 'account',
            account: item.account,
            deriveInfo: item.deriveInfo,
            hasMultipleDeriveTypes: section.hasMultipleDeriveTypes,
            walletId: section.walletId,
            walletName: section.title,
            wallet: section.wallet,
          });
        });
        return items;
      }),
    [sections],
  );

  // Show skeleton on initial load or while loading (when isLoadingAccounts is undefined or true)
  const isInitialLoading =
    isLoadingAccounts !== false && walletGroups.length === 0;
  if (isInitialLoading) {
    return <QuickSelectListSkeleton />;
  }

  if (filteredWalletGroups.length === 0) {
    return (
      <Empty
        mt="$3"
        icon={isSearchActive ? 'SearchOutline' : 'WalletCryptoOutline'}
        title={intl.formatMessage({
          id: isSearchActive
            ? ETranslations.no_search_results__title
            : ETranslations.no_account,
        })}
      />
    );
  }

  // Use .map() instead of ListView to prevent component remounting on tab switch
  // ListView may unmount children when display changes from none to flex
  return (
    <Stack>
      {flattenedItems.map((item) => {
        // Render section header
        if (item.type === 'header') {
          return (
            <Stack key={`header-${item.walletId}`} px="$5" pt="$4" pb="$2">
              <SizableText size="$headingXs" color="$textSubdued">
                {item.title}
              </SizableText>
            </Stack>
          );
        }

        // Render account item
        if (!item.account) {
          return null;
        }
        const {
          account,
          deriveInfo,
          hasMultipleDeriveTypes,
          walletId,
          wallet,
        } = item;
        const itemAddress =
          account.address ?? account.addressDetail?.address ?? '';
        const deriveLabel = hasMultipleDeriveTypes
          ? getDeriveLabel(deriveInfo)
          : undefined;
        const itemKey = `${account.id ?? 'no-id'}-${itemAddress}`;

        const walletName = item.walletName;
        const displayName = walletName
          ? `${walletName} / ${account.name ?? ''}`
          : (account.name ?? '');

        return (
          <QuickSelectListItem
            key={itemKey}
            item={{
              id: account.id ?? '',
              name: displayName,
              address: itemAddress,
              deriveLabel,
              walletId,
              wallet,
            }}
            onPress={() => handleSelectAccount({ account, deriveInfo })}
          />
        );
      })}
    </Stack>
  );
}

type IAddressBookRecipientsProps = {
  networkId: string;
  searchKey?: string;
  isSearchMode?: boolean;
  onInputTypeChange?: (type: EInputAddressChangeType) => void;
  onSelect?: (params: {
    address: string;
    memo?: string;
    note?: string;
  }) => void;
  onMatchStatusChange?: (hasMatches: boolean, matchCount: number) => void;
};

function AddressBookRecipients({
  networkId,
  searchKey,
  isSearchMode,
  onInputTypeChange,
  onSelect,
  onMatchStatusChange,
}: IAddressBookRecipientsProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const debouncedSearchKey = useDebounce(searchKey, 300);
  const trimmedSearchKey = normalizeSearchKey(debouncedSearchKey);
  const searchValue = trimmedSearchKey;
  const isSearchActive = !!(isSearchMode && trimmedSearchKey);
  // Detect debounce gap: searchKey changed but debounce hasn't settled yet
  const isDebouncing = isSearchMode && searchKey !== debouncedSearchKey;
  const [{ updateTimestamp }] = useAddressBookPersistAtom();

  const { result, isLoading } = usePromiseResult<{
    items: IAddressNetworkItem[];
  }>(
    async () => {
      if (!networkId) {
        return {
          items: [],
        };
      }
      const networkImpl = networkUtils.getNetworkImpl({ networkId });
      const addressBookItemsResult =
        await backgroundApiProxy.serviceAddressBook.getNetworkItems({
          networkId,
          // For EVM, allow cross-EVM entries (same as AddressBook picker behavior)
          exact: networkImpl !== IMPL_EVM,
        });
      return {
        items: addressBookItemsResult.items,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [networkId, updateTimestamp],
    { watchLoading: true, undefinedResultIfError: true },
  );

  const addressBookItems = useMemo(() => result?.items ?? [], [result?.items]);

  const filteredItems = useMemo(() => {
    if (!isSearchActive) {
      return addressBookItems;
    }
    return prioritizeNameThenAddressMatches({
      items: addressBookItems,
      isNameMatch: (item) =>
        (item.name ?? '').toLowerCase().includes(searchValue),
      isAddressMatch: (item) =>
        item.address.toLowerCase().includes(searchValue),
    }).sorted;
  }, [addressBookItems, isSearchActive, searchValue]);

  // Notify parent of match status and count
  useEffect(() => {
    // Skip reporting stale counts during debounce gap to prevent badge flickering
    if (isDebouncing) return;
    onMatchStatusChange?.(filteredItems.length > 0, filteredItems.length);
  }, [filteredItems.length, onMatchStatusChange, isDebouncing]);

  const isInitialLoading = isLoading && !result;

  if (isInitialLoading) {
    // Keep layout occupied during first load to avoid blank flash
    return <QuickSelectListSkeleton count={4} />;
  }

  if (filteredItems.length === 0) {
    return isSearchActive ? (
      <Empty
        mt="$3"
        icon="SearchOutline"
        title={intl.formatMessage({
          id: ETranslations.no_search_results__title,
        })}
      />
    ) : (
      <Empty
        mt="$3"
        icon="BookOpenOutline"
        title={intl.formatMessage({
          id: ETranslations.address_book_title,
        })}
        description={intl.formatMessage({
          id: ETranslations.address_book__desc,
        })}
        buttonProps={{
          variant: 'secondary',
          size: 'medium',
          children: intl.formatMessage({
            id: ETranslations.address_book_add_address_title,
          }),
          onPress: () => {
            navigation.pushModal(EModalRoutes.AddressBookModal, {
              screen: EModalAddressBookRoutes.EditItemModal,
              params: { networkId },
            });
          },
        }}
      />
    );
  }

  // Use .map() instead of ListView to prevent component remounting on tab switch
  return (
    <Stack>
      {filteredItems.map((item) => (
        <QuickSelectListItem
          key={item.id ?? `${item.address}-${item.networkId}`}
          item={{
            id: item.id,
            name: item.name,
            address: item.address,
            memo: item.memo,
            note: item.note,
          }}
          onPress={() => {
            onInputTypeChange?.(EInputAddressChangeType.AddressBook);
            onSelect?.({
              address: item.address,
              memo: item.memo,
              note: item.note,
            });
          }}
        />
      ))}
    </Stack>
  );
}

export default function RecipientQuickSelect({
  accountId,
  networkId,
  searchKey,
  isSearchMode,
  activeTab: activeTabProp,
  onActiveTabChange,
  onSelect,
  onInputTypeChange,
  onMatchStatusChange,
}: IRecipientQuickSelectProps) {
  const intl = useIntl();
  // Use controlled state from parent if provided, otherwise use local state
  const [localActiveTab, setLocalActiveTab] =
    useState<IRecipientQuickSelectTab>('recent');
  const activeTab = activeTabProp ?? localActiveTab;
  const setActiveTab = onActiveTabChange ?? setLocalActiveTab;

  // Track match status for each tab (null = not yet reported by component)
  const [tabMatchStatus, setTabMatchStatus] =
    useState<IRecipientTabMatchStatus>({
      recent: null,
      account: null,
      addressBook: null,
    });

  // Track match counts for each tab (for display in tab labels)
  const [tabMatchCounts, setTabMatchCounts] = useState<
    Record<IRecipientQuickSelectTab, number>
  >({
    recent: 0,
    account: 0,
    addressBook: 0,
  });

  // Key to trigger refresh of recent recipients data
  const [recentRefreshKey, setRecentRefreshKey] = useState(0);

  // Force refresh recent recipients on mount to clear cached data
  useEffect(() => {
    setRecentRefreshKey((prev) => prev + 1);
  }, []);

  // Track which tabs have been visited (once visited, stay mounted to avoid AbortError crashes)
  const [visitedTabs, setVisitedTabs] = useState<
    Record<IRecipientQuickSelectTab, boolean>
  >({
    recent: true, // Default tab starts as visited
    account: false,
    addressBook: false,
  });

  // When activeTab changes, mark it as visited.
  useEffect(() => {
    setVisitedTabs((prev) =>
      prev[activeTab] ? prev : { ...prev, [activeTab]: true },
    );
  }, [activeTab]);

  // Use debounced search key for auto-switch logic
  const debouncedSearchKey = useDebounce(searchKey, 300);
  const trimmedSearchKey = normalizeSearchKey(debouncedSearchKey);

  // Track the search key at the time of last manual tab switch
  // Only allow auto-switch if user has typed something new
  const lastManualSwitchSearchKeyRef = useRef<string | undefined>(undefined);

  // Callbacks for each tab's match status and count
  const handleRecentMatchStatus = useCallback(
    (hasMatches: boolean, matchCount: number) => {
      setTabMatchStatus((prev) => ({ ...prev, recent: hasMatches }));
      setTabMatchCounts((prev) => ({ ...prev, recent: matchCount }));
    },
    [],
  );

  const handleAccountMatchStatus = useCallback(
    (hasMatches: boolean, matchCount: number) => {
      setTabMatchStatus((prev) => ({ ...prev, account: hasMatches }));
      setTabMatchCounts((prev) => ({ ...prev, account: matchCount }));
    },
    [],
  );

  const handleAddressBookMatchStatus = useCallback(
    (hasMatches: boolean, matchCount: number) => {
      setTabMatchStatus((prev) => ({ ...prev, addressBook: hasMatches }));
      setTabMatchCounts((prev) => ({ ...prev, addressBook: matchCount }));
    },
    [],
  );

  // Report match status to parent: true only if a tab has explicitly reported matches
  useEffect(() => {
    const statuses = Object.values(tabMatchStatus);
    const anyTabHasMatches = statuses.some((status) => status === true);
    onMatchStatusChange?.(anyTabHasMatches);
  }, [tabMatchStatus, onMatchStatusChange]);

  // Auto-switch to a tab with matches when current tab has no matches
  useEffect(() => {
    const nextTab = getAutoSwitchRecipientTab({
      isSearchMode,
      trimmedSearchKey,
      activeTab,
      tabMatchStatus,
      lastManualSwitchSearchKey: lastManualSwitchSearchKeyRef.current,
    });

    if (nextTab) {
      setActiveTab(nextTab);
    }
  }, [isSearchMode, trimmedSearchKey, activeTab, tabMatchStatus, setActiveTab]);

  const tabOptions = useMemo(() => {
    const formatLabel = (label: string, tab: IRecipientQuickSelectTab) => {
      if (isSearchMode && trimmedSearchKey && tabMatchCounts[tab] > 0) {
        return `${label} (${tabMatchCounts[tab]})`;
      }
      return label;
    };

    return [
      {
        label: formatLabel(
          intl.formatMessage({ id: ETranslations.global_recents }),
          'recent',
        ),
        value: 'recent',
      },
      {
        label: formatLabel(
          intl.formatMessage({
            id: ETranslations.global_accounts,
          }),
          'account',
        ),
        value: 'account',
      },
      {
        label: formatLabel(
          intl.formatMessage({ id: ETranslations.address_book_title }),
          'addressBook',
        ),
        value: 'addressBook',
      },
    ];
  }, [intl, isSearchMode, trimmedSearchKey, tabMatchCounts]);

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <YStack mt="$3" gap="$3">
        <SegmentControl
          fullWidth
          value={activeTab}
          options={tabOptions}
          onChange={(value) => {
            // Record the current search key to prevent auto-switch until user types again
            lastManualSwitchSearchKeyRef.current = trimmedSearchKey;
            setActiveTab(value as IRecipientQuickSelectTab);
          }}
        />
        <Stack mx={-20}>
          {/* Render active tab, or visited tabs (hidden with display:none to avoid unmount crashes) */}
          {activeTab === 'recent' || visitedTabs.recent ? (
            <Stack display={activeTab === 'recent' ? 'flex' : 'none'}>
              <RecentRecipients
                compact
                accountId={accountId}
                networkId={networkId}
                searchKey={searchKey}
                isSearchMode={isSearchMode}
                onSelect={(params) => {
                  // Reset input type to Manual to prevent auto-navigation from Recent tab
                  onInputTypeChange?.(EInputAddressChangeType.Manual);
                  onSelect?.(params);
                }}
                onMatchStatusChange={handleRecentMatchStatus}
                refreshKey={recentRefreshKey}
              />
            </Stack>
          ) : null}
          {activeTab === 'account' || visitedTabs.account ? (
            <Stack display={activeTab === 'account' ? 'flex' : 'none'}>
              <AccountRecipients
                networkId={networkId}
                searchKey={searchKey}
                isSearchMode={isSearchMode}
                onInputTypeChange={onInputTypeChange}
                onSelect={({ address }) => onSelect?.({ address })}
                onMatchStatusChange={handleAccountMatchStatus}
              />
            </Stack>
          ) : null}
          {activeTab === 'addressBook' || visitedTabs.addressBook ? (
            <Stack display={activeTab === 'addressBook' ? 'flex' : 'none'}>
              <AddressBookRecipients
                networkId={networkId}
                searchKey={searchKey}
                isSearchMode={isSearchMode}
                onInputTypeChange={onInputTypeChange}
                onSelect={onSelect}
                onMatchStatusChange={handleAddressBookMatchStatus}
              />
            </Stack>
          ) : null}
        </Stack>
      </YStack>
    </Animated.View>
  );
}
