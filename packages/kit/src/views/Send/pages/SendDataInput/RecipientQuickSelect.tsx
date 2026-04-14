import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { flatten, map } from 'lodash';
import { useIntl } from 'react-intl';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  ActionList,
  Badge,
  Button,
  Empty,
  MatchSizeableText,
  SegmentControl,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IAddressNetworkItem } from '@onekeyhq/kit/src/views/AddressBook/type';
import type {
  IDBUtxoAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { useAddressBookPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/addressBooks';
import type { IAccountDeriveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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
  senderDeriveType?: string;
  searchKey?: string;
  isSearchMode?: boolean;
  activeTab?: IRecipientQuickSelectTab;
  hideTabs?: IRecipientQuickSelectTab[];
  onActiveTabChange?: (tab: IRecipientQuickSelectTab) => void;
  onInputTypeChange?: (type: EInputAddressChangeType) => void;
  onSelect?: (params: {
    address: string;
    memo?: string;
    note?: string;
    quickSelectTab?: IRecipientQuickSelectTab;
    isSearchMode?: boolean;
    searchKeyLength?: number;
    matchCount?: number;
  }) => void;
  onMatchStatusChange?: (hasMatches: boolean) => void;
};

type IAccountRecipientsProps = {
  networkId: string;
  senderDeriveType?: string;
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
  displayAddress?: string; // Address shown in secondary text (may differ from avatar seed)
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
    const showAddr = item.displayAddress ?? item.address;
    const secondary = showAddr ? (
      <MatchSizeableText size="$bodyMd" color="$textSubdued">
        {item.memo || item.note
          ? `${showAddr} · ${accountUtils.shortenAddress({
              address: item.memo || item.note,
              leadingLength: 6,
              trailingLength: 4,
            })}`
          : showAddr}
      </MatchSizeableText>
    ) : undefined;

    return (
      <QuickSelectListItemFrame
        address={item.address}
        walletId={item.walletId}
        wallet={item.wallet}
        onPress={onPress}
        testID={`recipient-item-${item.address}`}
        primary={
          <XStack gap="$2" alignItems="center" flexWrap="nowrap">
            <MatchSizeableText
              size="$bodyLgMedium"
              numberOfLines={1}
              flexShrink={1}
              flexGrow={1}
              flexBasis={0}
            >
              {displayName}
            </MatchSizeableText>
            {item.deriveLabel ? (
              <Badge badgeSize="sm" badgeType="default" flexShrink={0}>
                {item.deriveLabel}
              </Badge>
            ) : null}
          </XStack>
        }
        secondary={secondary}
      />
    );
  },
  (prevProps, nextProps) =>
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.address === nextProps.item.address &&
    prevProps.item.displayAddress === nextProps.item.displayAddress &&
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
  deriveType?: string;
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

// Collect every address an account should be searchable by. For BTC with
// fresh-address mode (OK-52953) the currently-shown address is one of
// many rotating entries stored in `IDBUtxoAccount.addresses` (relPath →
// addr); `customAddresses` covers user-added custom receive addresses.
// Without these a user searching an old receive address gets no hit.
function collectAccountSearchAddresses(
  account: INetworkAccount | undefined,
): string[] {
  if (!account) return [];
  const utxo = account as Partial<IDBUtxoAccount>;
  const candidates = [
    account.addressDetail?.displayAddress,
    account.address,
    account.addressDetail?.address,
    account.addressDetail?.masterAddress,
    ...(utxo.addresses ? Object.values(utxo.addresses) : []),
    ...(utxo.customAddresses ? Object.values(utxo.customAddresses) : []),
  ].filter((a): a is string => !!a);
  return Array.from(new Set(candidates.map((a) => a.toLowerCase())));
}

// Get wallet accounts on the specified network (with derive type info)
async function getWalletNetworkAccounts(
  wallet: IDBWallet,
  networkId: string,
): Promise<IAccountWithDeriveInfo[]> {
  const { dbIndexedAccounts, dbAccounts } = wallet;

  // HD / Hardware wallets use dbIndexedAccounts
  if (dbIndexedAccounts?.length) {
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

    const results = await promiseAllSettledEnhanced(
      accountRequestTaskFactories,
      {
        continueOnError: true,
        concurrency: NETWORK_ACCOUNTS_FETCH_CONCURRENCY,
      },
    );
    return flatten(
      map(results, (item) =>
        (item ?? [])
          .filter((acc) => acc.account)
          .map((acc) => ({
            account: acc.account as INetworkAccount,
            deriveInfo: acc.deriveInfo,
            deriveType: acc.deriveType,
          })),
      ),
    );
  }

  // Imported / Private-key wallets use dbAccounts directly
  if (dbAccounts?.length) {
    const networkImpl = networkId.split('--')[0];
    return dbAccounts
      .filter((acc) => acc.impl === networkImpl)
      .map((acc) => ({
        account: acc as unknown as INetworkAccount,
        deriveInfo: undefined,
      }));
  }

  return [];
}

function AccountRecipients({
  networkId,
  senderDeriveType,
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

        const vaultSettings =
          await backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId,
          });
        const showAllDeriveTypes = !!vaultSettings?.mergeDeriveAssetsEnabled;

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
            let accounts = await getWalletNetworkAccounts(wallet, networkId);
            // For chains with multiple derive types (BTC/LTC), keep all
            // accounts so users can switch derive type via header menu.
            // For other chains, filter by sender's derive type to avoid
            // showing duplicates (e.g. bip44 + ledger-live on EVM).
            if (!showAllDeriveTypes) {
              const targetDeriveType =
                senderDeriveType ?? accounts[0]?.deriveType;
              if (targetDeriveType) {
                const filtered = accounts.filter(
                  (a) => !a.deriveType || a.deriveType === targetDeriveType,
                );
                if (filtered.length > 0) {
                  accounts = filtered;
                }
              }
            }
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
          // Skip watch-only, external, deprecated, and deleted (mocked) wallets
          // Keep HD, Hardware, Imported, QR wallets
          const shouldSkip =
            accountUtils.isWatchingWallet({ walletId: wallet.id }) ||
            accountUtils.isExternalWallet({ walletId: wallet.id }) ||
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
      [networkId, senderDeriveType],
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
            isAddressMatch: (item) =>
              collectAccountSearchAddresses(item.account).some((addr) =>
                addr.includes(searchValue),
              ),
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

  // Handle account selection
  const handleSelectAccount = useCallback(
    (item: IAccountWithDeriveInfo) => {
      const account = item?.account;
      if (!account) return;
      const address =
        account.addressDetail?.displayAddress ??
        account.address ??
        account.addressDetail?.address ??
        '';
      onInputTypeChange?.(EInputAddressChangeType.AccountSelector);
      onSelect?.({ address });
    },
    [onInputTypeChange, onSelect],
  );

  // Derive type selection per wallet group (for BTC/LTC multi-derive chains)
  const [walletDeriveType, setWalletDeriveType] = useState<
    Record<string, string>
  >({});

  // Convert wallet groups to sections format for SectionList
  const sections = useMemo(() => {
    if (!filteredWalletGroups || !Array.isArray(filteredWalletGroups)) {
      return [];
    }
    return filteredWalletGroups.map((group) => {
      const allAccounts = group?.accounts ?? [];

      // Collect unique derive types for this wallet group
      const deriveTypeMap = new Map<
        string,
        { label: string; deriveType: string }
      >();
      for (const item of allAccounts) {
        const dt = item.deriveType;
        if (dt && !deriveTypeMap.has(dt)) {
          const label = item.deriveInfo?.labelKey
            ? intl.formatMessage({ id: item.deriveInfo.labelKey })
            : (item.deriveInfo?.label ?? dt);
          deriveTypeMap.set(dt, { label, deriveType: dt });
        }
      }
      const deriveTypeOptions = Array.from(deriveTypeMap.values());
      const hasMultipleDeriveTypes = deriveTypeOptions.length > 1;

      // Filter accounts by selected derive type (for multi-derive chains)
      const walletId = group?.walletId ?? '';
      const rawDeriveType = walletDeriveType[walletId] ?? senderDeriveType;
      // Validate against available options; fall back to first option if not found
      const activeDeriveType =
        rawDeriveType && deriveTypeMap.has(rawDeriveType)
          ? rawDeriveType
          : deriveTypeOptions[0]?.deriveType;
      // When searching, show all derive types so matches on non-active
      // derive paths aren't hidden. When not searching, filter by active.
      let filteredAccounts = allAccounts;
      if (hasMultipleDeriveTypes && activeDeriveType && !isSearchActive) {
        const filtered = allAccounts.filter(
          (a) => !a.deriveType || a.deriveType === activeDeriveType,
        );
        if (filtered.length > 0) {
          filteredAccounts = filtered;
        }
      }

      return {
        title: group?.walletName ?? '',
        walletId,
        wallet: group?.wallet,
        hasMultipleDeriveTypes,
        deriveTypeOptions,
        activeDeriveType,
        data: filteredAccounts,
      };
    });
  }, [
    filteredWalletGroups,
    walletDeriveType,
    senderDeriveType,
    intl,
    isSearchActive,
  ]);

  // Count visible accounts (after derive type filtering)
  const accountMatchCount = useMemo(
    () => sections.reduce((sum, s) => sum + (s.data?.length ?? 0), 0),
    [sections],
  );

  useEffect(() => {
    if (isDebouncing) {
      onMatchStatusChange?.(false, 0);
      return;
    }
    onMatchStatusChange?.(accountMatchCount > 0, accountMatchCount);
  }, [accountMatchCount, onMatchStatusChange, isDebouncing]);

  // Flatten sections for simple rendering with section headers
  type IFlatItem =
    | {
        type: 'header';
        title: string;
        walletId: string;
        hasMultipleDeriveTypes: boolean;
        deriveTypeOptions: { label: string; deriveType: string }[];
        activeDeriveType?: string;
      }
    | {
        type: 'account';
        account: INetworkAccount;
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
            hasMultipleDeriveTypes: section.hasMultipleDeriveTypes,
            deriveTypeOptions: section.deriveTypeOptions,
            activeDeriveType: section.activeDeriveType,
          });
        }
        // Add account items
        (section.data ?? []).forEach((item) => {
          items.push({
            type: 'account',
            account: item.account,
            walletId: section.walletId,
            walletName: section.title,
            wallet: section.wallet,
          });
        });
        return items;
      }),
    [sections],
  );

  // Collapse state per wallet group (default: all expanded)
  const [collapsedWallets, setCollapsedWallets] = useState<
    Record<string, boolean>
  >({});
  const toggleCollapse = useCallback((walletId: string) => {
    setCollapsedWallets((prev) => ({
      ...prev,
      [walletId]: !prev[walletId],
    }));
  }, []);

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
        // Render section header with collapse toggle
        if (item.type === 'header') {
          const isCollapsed = !!collapsedWallets[item.walletId];
          const activeLabel = item.deriveTypeOptions.find(
            (o) => o.deriveType === item.activeDeriveType,
          )?.label;
          return (
            <XStack
              key={`header-${item.walletId}`}
              px="$5"
              pt="$4"
              pb="$2"
              alignItems="center"
              gap="$4"
            >
              <Button
                size="small"
                variant="tertiary"
                flexShrink={1}
                textEllipsis
                onPress={() => toggleCollapse(item.walletId)}
                iconAfter={
                  isCollapsed
                    ? 'ChevronRightSmallOutline'
                    : 'ChevronDownSmallOutline'
                }
              >
                {item.title}
              </Button>
              {item.hasMultipleDeriveTypes ? (
                <ActionList
                  title={intl.formatMessage({
                    id: ETranslations.address_type_selector_title,
                  })}
                  items={item.deriveTypeOptions.map((option) => ({
                    label: option.label,
                    onPress: () => {
                      setWalletDeriveType((prev) => ({
                        ...prev,
                        [item.walletId]: option.deriveType,
                      }));
                    },
                  }))}
                  renderTrigger={
                    <Button
                      size="small"
                      variant="tertiary"
                      iconAfter="ChevronDownSmallSolid"
                      flexShrink={0}
                    >
                      {activeLabel ?? ''}
                    </Button>
                  }
                />
              ) : null}
            </XStack>
          );
        }

        // Skip account items when their wallet group is collapsed
        if (collapsedWallets[item.walletId]) {
          return null;
        }

        // Render account item
        if (!item.account) {
          return null;
        }
        const { account, walletId, wallet } = item;
        const itemAddress =
          account.addressDetail?.displayAddress ??
          account.address ??
          account.addressDetail?.address ??
          '';
        const itemKey = `${account.id ?? 'no-id'}-${itemAddress}`;

        // Wallet name is already shown in the section header, only show account name
        const displayName = account.name ?? '';

        return (
          <QuickSelectListItem
            key={itemKey}
            item={{
              id: account.id ?? '',
              name: displayName,
              // Use account.id as avatar seed when address is empty (e.g. Lightning)
              address: itemAddress || account.id || '',
              // Only show address in secondary text when it's a real address
              displayAddress: itemAddress,
              walletId,
              wallet,
            }}
            onPress={() => handleSelectAccount({ account })}
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
    if (isDebouncing) {
      onMatchStatusChange?.(false, 0);
      return;
    }
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
  hideTabs,
  senderDeriveType,
}: IRecipientQuickSelectProps) {
  const intl = useIntl();
  const isRecentHidden = hideTabs?.includes('recent') ?? false;
  // Use controlled state from parent if provided, otherwise use local state
  const [localActiveTab, setLocalActiveTab] =
    useState<IRecipientQuickSelectTab>(isRecentHidden ? 'account' : 'recent');
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

  // Set of tabs that should appear (excludes hideTabs and Lightning hidden tabs)
  const visibleTabKeys = useMemo<IRecipientQuickSelectTab[]>(() => {
    const isLightning = networkUtils.isLightningNetworkByNetworkId(networkId);
    const all: IRecipientQuickSelectTab[] = isLightning
      ? ['recent']
      : ['recent', 'account', 'addressBook'];
    return hideTabs?.length ? all.filter((t) => !hideTabs.includes(t)) : all;
  }, [hideTabs, networkId]);

  // Track which tabs have been visited (once visited, stay mounted to avoid AbortError crashes)
  const [visitedTabs, setVisitedTabs] = useState<
    Record<IRecipientQuickSelectTab, boolean>
  >({
    recent: !isRecentHidden,
    account: false,
    addressBook: false,
  });

  // When activeTab changes, mark it as visited.
  useEffect(() => {
    setVisitedTabs((prev) =>
      prev[activeTab] ? prev : { ...prev, [activeTab]: true },
    );
  }, [activeTab]);

  // Pre-mount every visible tab (kept hidden via display:none until active)
  // so each can fetch its data and report its match count without requiring
  // the user to click in first. Without this, the addressBook tab label
  // never showed its (N) count when a BTC chain landed on Accounts by
  // default, and auto-switch couldn't jump to a non-mounted tab (OK-52952).
  useEffect(() => {
    setVisitedTabs((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const tab of visibleTabKeys) {
        if (!next[tab]) {
          next[tab] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [visibleTabKeys]);

  // For multi-derive chains (BTC/LTC), default to Accounts tab so
  // addresses are visible without manual tab switch (OK-52809).
  useEffect(() => {
    if (!networkId) return;
    let cancelled = false;
    void backgroundApiProxy.serviceNetwork
      .getVaultSettings({ networkId })
      .then((settings) => {
        if (!cancelled && settings?.mergeDeriveAssetsEnabled) {
          setActiveTab('account');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [networkId, setActiveTab]);

  // Use debounced search key for auto-switch logic
  const debouncedSearchKey = useDebounce(searchKey, 300);
  const trimmedSearchKey = normalizeSearchKey(debouncedSearchKey);
  const isDebouncing = isSearchMode && searchKey !== debouncedSearchKey;

  // Track the search key at the time of last manual tab switch
  // Only allow auto-switch if user has typed something new
  const lastManualSwitchSearchKeyRef = useRef<string | undefined>(undefined);
  // Dedup auto-switch analytics to avoid multiple events per search
  const lastAutoSwitchRef = useRef<string | undefined>(undefined);

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
  const lastNoResultKeyRef = useRef<string | undefined>(undefined);

  // Auto-switch to a tab with matches when current tab has no matches
  useEffect(() => {
    const nextTab = getAutoSwitchRecipientTab({
      isSearchMode,
      trimmedSearchKey,
      activeTab,
      tabMatchStatus,
      lastManualSwitchSearchKey: lastManualSwitchSearchKeyRef.current,
      hideTabs,
    });

    if (nextTab) {
      const dedupKey = `${trimmedSearchKey}:${activeTab}:${nextTab}`;
      if (lastAutoSwitchRef.current !== dedupKey) {
        lastAutoSwitchRef.current = dedupKey;
        defaultLogger.transaction.send.quickSelectTabSwitch({
          network: networkId,
          fromTab: activeTab,
          toTab: nextTab,
          isAutoSwitch: true,
        });
      }
      setActiveTab(nextTab);
    }
  }, [
    isSearchMode,
    trimmedSearchKey,
    activeTab,
    tabMatchStatus,
    setActiveTab,
    networkId,
    hideTabs,
  ]);

  const tabOptions = useMemo(() => {
    const formatLabel = (label: string, tab: IRecipientQuickSelectTab) => {
      if (isSearchMode && trimmedSearchKey && tabMatchCounts[tab] > 0) {
        return `${label} (${tabMatchCounts[tab]})`;
      }
      return label;
    };

    const labelMap: Record<IRecipientQuickSelectTab, string> = {
      recent: intl.formatMessage({ id: ETranslations.global_recents }),
      account: intl.formatMessage({ id: ETranslations.global_accounts }),
      addressBook: intl.formatMessage({ id: ETranslations.address_book_title }),
    };
    return visibleTabKeys.map((tab) => ({
      label: formatLabel(labelMap[tab], tab),
      value: tab,
    }));
  }, [intl, isSearchMode, trimmedSearchKey, tabMatchCounts, visibleTabKeys]);

  // Report match status to parent. Only consider tabs that are actually visible
  // (Lightning hides account/addressBook; callers can pass hideTabs).
  useEffect(() => {
    const visibleStatuses = visibleTabKeys.map((tab) => tabMatchStatus[tab]);
    const anyTabHasMatches = visibleStatuses.some((status) => status === true);
    onMatchStatusChange?.(anyTabHasMatches);

    const allReported = visibleStatuses.every((status) => status !== null);
    if (
      isSearchMode &&
      trimmedSearchKey &&
      !isDebouncing &&
      allReported &&
      !anyTabHasMatches &&
      lastNoResultKeyRef.current !== trimmedSearchKey
    ) {
      lastNoResultKeyRef.current = trimmedSearchKey;
      defaultLogger.transaction.send.quickSelectSearchNoResult({
        network: networkId,
        searchKeyLength: trimmedSearchKey.length,
      });
    }
  }, [
    visibleTabKeys,
    tabMatchStatus,
    onMatchStatusChange,
    isSearchMode,
    isDebouncing,
    trimmedSearchKey,
    networkId,
  ]);

  const getSearchContext = useCallback(
    () => ({
      isSearchMode: !!(isSearchMode && trimmedSearchKey),
      searchKeyLength: trimmedSearchKey.length,
      matchCount:
        isSearchMode && trimmedSearchKey
          ? visibleTabKeys.reduce(
              (sum, tab) => sum + (tabMatchCounts[tab] ?? 0),
              0,
            )
          : 0,
    }),
    [isSearchMode, trimmedSearchKey, tabMatchCounts, visibleTabKeys],
  );

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
            const toTab = value as IRecipientQuickSelectTab;
            defaultLogger.transaction.send.quickSelectTabSwitch({
              network: networkId,
              fromTab: activeTab,
              toTab,
              isAutoSwitch: false,
            });
            setActiveTab(toTab);
          }}
        />
        <Stack mx={-20} pb="$3">
          {/* Render active tab, or visited tabs (hidden with display:none to avoid unmount crashes) */}
          {!isRecentHidden && (activeTab === 'recent' || visitedTabs.recent) ? (
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
                  onSelect?.({
                    ...params,
                    quickSelectTab: 'recent',
                    ...getSearchContext(),
                  });
                }}
                onMatchStatusChange={handleRecentMatchStatus}
              />
            </Stack>
          ) : null}
          {activeTab === 'account' || visitedTabs.account ? (
            <Stack display={activeTab === 'account' ? 'flex' : 'none'}>
              <AccountRecipients
                networkId={networkId}
                senderDeriveType={senderDeriveType}
                searchKey={searchKey}
                isSearchMode={isSearchMode}
                onInputTypeChange={onInputTypeChange}
                onSelect={({ address }) =>
                  onSelect?.({
                    address,
                    quickSelectTab: 'account',
                    ...getSearchContext(),
                  })
                }
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
                onSelect={(params) =>
                  onSelect?.({
                    ...params,
                    quickSelectTab: 'addressBook',
                    ...getSearchContext(),
                  })
                }
                onMatchStatusChange={handleAddressBookMatchStatus}
              />
            </Stack>
          ) : null}
        </Stack>
      </YStack>
    </Animated.View>
  );
}
