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
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
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
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EInputAddressChangeType } from '@onekeyhq/shared/types/address';

import RecentRecipients from './RecentRecipients';

type IRecipientQuickSelectTab = 'recent' | 'account' | 'addressBook';

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
};

// Account avatar with wallet overlay for "My Accounts" items
function AccountAvatarWithWallet({
  address,
  walletId,
}: {
  address: string;
  walletId?: string;
}) {
  const { result: wallet } = usePromiseResult(
    async () => {
      if (!walletId) return undefined;
      const w = await backgroundApiProxy.serviceAccount.getWallet({ walletId });
      return w;
    },
    [walletId],
    { initResult: undefined },
  );

  return <AccountAvatar size="default" address={address} wallet={wallet} />;
}
const MemoizedAccountAvatarWithWallet = memo(
  AccountAvatarWithWallet,
  (prev, next) =>
    prev.address === next.address && prev.walletId === next.walletId,
);

const QuickSelectListItem = memo(
  ({ item, onPress }: { item: IQuickItem; onPress?: () => void }) => {
    // Use name if available, otherwise show truncated address as primary
    const displayName =
      item.name || accountUtils.shortenAddress({ address: item.address });
    return (
      <ListItem
        px="$5"
        py="$3"
        renderAvatar={() => (
          <MemoizedAccountAvatarWithWallet
            address={item.address}
            walletId={item.walletId}
          />
        )}
        onPress={onPress}
        testID={`recipient-item-${item.address}`}
      >
        <ListItem.Text
          flexGrow={1}
          flexBasis={0}
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
      </ListItem>
    );
  },
  (prevProps, nextProps) =>
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.address === nextProps.item.address &&
    prevProps.item.name === nextProps.item.name &&
    prevProps.item.deriveLabel === nextProps.item.deriveLabel &&
    prevProps.item.memo === nextProps.item.memo &&
    prevProps.item.note === nextProps.item.note,
);
QuickSelectListItem.displayName = 'QuickSelectListItem';

function QuickSelectSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Stack>
      {Array.from({ length: count }).map((_, index) => (
        <ListItem
          key={index}
          px="$5"
          py="$3"
          renderAvatar={() => (
            <Skeleton width="$10" height="$10" borderRadius="$2" bg="$bgApp" />
          )}
        >
          <ListItem.Text
            primary={<Skeleton height={18} width="50%" bg="$bgApp" />}
            secondary={<Skeleton height={14} width="70%" bg="$bgApp" />}
          />
        </ListItem>
      ))}
    </Stack>
  );
}

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
};

// Get wallet accounts on the specified network (with derive type info)
async function getWalletNetworkAccounts(
  wallet: IDBWallet,
  networkId: string,
): Promise<IAccountWithDeriveInfo[]> {
  const { dbIndexedAccounts } = wallet;

  if (!dbIndexedAccounts?.length) {
    return [];
  }

  const accountsRequest = dbIndexedAccounts.map(async (indexedAccount) => {
    try {
      const resp =
        await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
          {
            networkId,
            indexedAccountId: indexedAccount.id,
            excludeEmptyAccount: true,
          },
        );
      return resp.networkAccounts;
    } catch {
      return [];
    }
  });

  const results = await Promise.all(accountsRequest);
  // Extract all accounts with derive type info
  const allAccounts = flatten(
    map(results, (item) =>
      item
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

        const groups: IWalletGroup[] = [];

        for (const wallet of wallets) {
          // Skip watch-only, deprecated, and deleted (mocked) wallets
          // Keep HD, Hardware, External, Imported, QR wallets
          const shouldSkip =
            accountUtils.isWatchingWallet({ walletId: wallet.id }) ||
            wallet.deprecated ||
            wallet.isMocked;

          if (!shouldSkip) {
            // Process main wallet
            const mainWalletAccounts = await getWalletNetworkAccounts(
              wallet,
              networkId,
            );
            if (mainWalletAccounts.length > 0) {
              groups.push({
                walletId: wallet.id,
                walletName: wallet.name,
                isHardwareWallet: accountUtils.isHwWallet({
                  walletId: wallet.id,
                }),
                accounts: mainWalletAccounts,
              });
            }

            // Process hidden wallets
            if (wallet.hiddenWallets?.length) {
              for (const hiddenWallet of wallet.hiddenWallets) {
                if (!hiddenWallet.deprecated && !hiddenWallet.isMocked) {
                  const hiddenWalletAccounts = await getWalletNetworkAccounts(
                    hiddenWallet,
                    networkId,
                  );
                  if (hiddenWalletAccounts.length > 0) {
                    groups.push({
                      walletId: hiddenWallet.id,
                      walletName: `${wallet.name} - ${hiddenWallet.name}`,
                      isHardwareWallet: accountUtils.isHwWallet({
                        walletId: hiddenWallet.id,
                      }),
                      accounts: hiddenWalletAccounts,
                    });
                  }
                }
              }
            }
          }
        }

        return groups;
      },
      [networkId],
      { initResult: [], watchLoading: true, undefinedResultIfError: true },
    );

  const debouncedSearchKey = useDebounce(searchKey, 300);
  const trimmedSearchKey = debouncedSearchKey?.trim().toLowerCase();
  const isSearchActive = !!(isSearchMode && trimmedSearchKey);
  const searchValue = trimmedSearchKey ?? '';
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
        const nameMatched: typeof accounts = [];
        const addressOnlyMatched: typeof accounts = [];

        for (const item of accounts) {
          const { account } = item ?? {};
          if (account) {
            const address =
              account.address ?? account.addressDetail?.address ?? '';
            const isNameMatch = (account.name ?? '')
              .toLowerCase()
              .includes(searchValue);
            const isAddressMatch = address.toLowerCase().includes(searchValue);

            if (isNameMatch) {
              nameMatched.push(item);
            } else if (isAddressMatch) {
              addressOnlyMatched.push(item);
            }
          }
        }

        const sortedAccounts = [...nameMatched, ...addressOnlyMatched];
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
        hasMultipleDeriveTypes,
        data: accounts,
      };
    });
  }, [filteredWalletGroups]);

  // Show skeleton on initial load or while loading (when isLoadingAccounts is undefined or true)
  const isInitialLoading =
    isLoadingAccounts !== false && walletGroups.length === 0;
  if (isInitialLoading) {
    return <QuickSelectSkeleton />;
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

  // Flatten sections for simple rendering with section headers
  type IFlatItem =
    | { type: 'header'; title: string; walletId: string }
    | {
        type: 'account';
        account: INetworkAccount;
        deriveInfo?: IAccountDeriveInfo;
        hasMultipleDeriveTypes: boolean;
        walletId: string;
      };

  const flattenedItems: IFlatItem[] = sections.flatMap((section) => {
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
      });
    });
    return items;
  });

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
        const { account, deriveInfo, hasMultipleDeriveTypes, walletId } = item;
        const itemAddress =
          account.address ?? account.addressDetail?.address ?? '';
        const deriveLabel = hasMultipleDeriveTypes
          ? getDeriveLabel(deriveInfo)
          : undefined;
        const itemKey = `${account.id ?? 'no-id'}-${itemAddress}`;

        // Find the wallet name from the section this account belongs to
        const walletName =
          sections.find((s) => s.walletId === walletId)?.title ?? '';
        const displayName = walletName
          ? `${walletName} / ${account.name ?? ''}`
          : account.name ?? '';

        return (
          <QuickSelectListItem
            key={itemKey}
            item={{
              id: account.id ?? '',
              name: displayName,
              address: itemAddress,
              deriveLabel,
              walletId,
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
  const trimmedSearchKey = debouncedSearchKey?.trim().toLowerCase();
  const searchValue = trimmedSearchKey ?? '';
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
    const nameMatched: typeof addressBookItems = [];
    const addressOnlyMatched: typeof addressBookItems = [];
    for (const item of addressBookItems) {
      const isNameMatch = item.name.toLowerCase().includes(searchValue);
      const isAddressMatch = item.address.toLowerCase().includes(searchValue);
      if (isNameMatch) {
        nameMatched.push(item);
      } else if (isAddressMatch) {
        addressOnlyMatched.push(item);
      }
    }
    return [...nameMatched, ...addressOnlyMatched];
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
    return <QuickSelectSkeleton count={4} />;
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
  const [tabMatchStatus, setTabMatchStatus] = useState<
    Record<IRecipientQuickSelectTab, boolean | null>
  >({
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

  // When activeTab changes, mark it as visited (delayed to avoid render issues)
  useEffect(() => {
    if (!visitedTabs[activeTab]) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setVisitedTabs((prev) => ({ ...prev, [activeTab]: true }));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeTab, visitedTabs]);

  // Use debounced search key for auto-switch logic
  const debouncedSearchKey = useDebounce(searchKey, 300);
  const trimmedSearchKey = debouncedSearchKey?.trim().toLowerCase();

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

  // Report match status to parent: true if ANY tab has matches (not just active tab)
  // Treat null (unvisited/unreported) as "unknown" — only report no-match
  // when all tabs have definitively reported their status
  useEffect(() => {
    const statuses = Object.values(tabMatchStatus);
    const anyTabHasMatches = statuses.some((status) => status === true);
    const allTabsReported = statuses.every((status) => status !== null);
    // If some tabs haven't reported yet, assume potential matches exist
    onMatchStatusChange?.(anyTabHasMatches || !allTabsReported);
  }, [tabMatchStatus, onMatchStatusChange]);

  // Auto-switch to a tab with matches when current tab has no matches
  useEffect(() => {
    if (!isSearchMode || !trimmedSearchKey) return;

    // If current tab has matches or hasn't reported yet, don't switch
    if (tabMatchStatus[activeTab] !== false) return;

    // Don't auto-switch if user manually switched tabs and hasn't typed anything new
    if (lastManualSwitchSearchKeyRef.current === trimmedSearchKey) return;

    // Find first tab with matches (in order: recent, account, addressBook)
    const tabs: IRecipientQuickSelectTab[] = [
      'recent',
      'account',
      'addressBook',
    ];
    const tabWithMatches = tabs.find(
      (tab) => tab !== activeTab && tabMatchStatus[tab] === true,
    );

    if (tabWithMatches) {
      setActiveTab(tabWithMatches);
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
            id: ETranslations.global_bulk_copy_addresses_tabs_my_accounts,
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
