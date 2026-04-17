import type { ReactNode } from 'react';
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Badge,
  Button,
  DashText,
  Empty,
  Icon,
  MatchSizeableText,
  Popover,
  SegmentControl,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { addressTypeTooltipMap } from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelectorItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IAddressNetworkItem } from '@onekeyhq/kit/src/views/AddressBook/type';
import type {
  IDBIndexedAccount,
  IDBUtxoAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { useAddressBookPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/addressBooks';
import type { IAccountDeriveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes/addressBook';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
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

function DeriveTypeLabelWithTooltip({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  const trigger = (
    <DashText
      size="$bodyMd"
      $md={{ size: '$bodyLg' }}
      dashColor="$textDisabled"
      dashThickness={0.5}
      cursor="help"
    >
      {label}
    </DashText>
  );
  if (platformEnv.isNative) {
    return (
      <YStack alignSelf="flex-start">
        <Popover
          title=""
          showHeader={false}
          placement="top"
          renderTrigger={trigger}
          renderContent={
            <YStack p="$5">
              <SizableText size="$bodyMd">{description}</SizableText>
            </YStack>
          }
        />
      </YStack>
    );
  }
  return (
    <YStack alignSelf="flex-start">
      <Tooltip
        placement="top"
        renderTrigger={trigger}
        renderContent={description}
      />
    </YStack>
  );
}

type IRecipientQuickSelectProps = {
  accountId?: string;
  networkId: string;
  senderDeriveType?: string;
  searchKey?: string;
  isSearchMode?: boolean;
  activeTab?: IRecipientQuickSelectTab;
  hideTabs?: IRecipientQuickSelectTab[];
  keylessWalletsOnly?: boolean;
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
  lastUsedDeriveType?: string;
  searchKey?: string;
  debouncedSearchKey?: string;
  isSearchMode?: boolean;
  keylessWalletsOnly?: boolean;
  onInputTypeChange?: (type: EInputAddressChangeType) => void;
  onSelect?: (params: { address: string }) => void;
  onMatchStatusChange?: (hasMatches: boolean, matchCount: number) => void;
};

type IQuickItem = {
  id?: string;
  name: string;
  address: string;
  displayAddress?: string;
  memo?: string;
  note?: string;
  deriveLabel?: string;
  walletId?: string;
  wallet?: IDBWallet;
  customRenderAvatar?: () => ReactNode;
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
        customRenderAvatar={item.customRenderAvatar}
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
  indexedAccount?: IDBIndexedAccount;
  deriveInfo?: IAccountDeriveInfo;
  deriveType?: string;
  // The actual historical address that matched the current search (OK-53313).
  // When set, the row displays this address instead of the account's current
  // rotating address so the user sees the value they actually typed.
  matchedAddress?: string;
};

// Wallet account group type
type IWalletGroup = {
  walletId: string;
  walletName: string;
  isHardwareWallet: boolean;
  accounts: IAccountWithDeriveInfo[];
  wallet: IDBWallet;
};

// Collect every address an account should be searchable by. For BTC with
// fresh-address mode (OK-52953) the currently-shown address is one of
// many rotating entries stored in `IDBUtxoAccount.addresses` (relPath →
// addr); `customAddresses` covers user-added custom receive addresses.
// Without these a user searching an old receive address gets no hit.
function collectAccountSearchAddresses(
  account: INetworkAccount | undefined,
  extraAddresses?: string[],
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
    ...(extraAddresses ?? []),
  ].filter((a): a is string => !!a);
  // Preserve original case so the matched value can be shown back to the
  // user (OK-53313) instead of the current rotating receive address.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const addr of candidates) {
    const key = addr.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(addr);
    }
  }
  return unique;
}

// Find the actual address on `account` that matches `searchValue`
// (already lowercased). Returns the original-case string so callers can
// display it back to the user.
function findMatchedAccountAddress(
  account: INetworkAccount | undefined,
  searchValue: string,
  extraAddresses?: string[],
): string | undefined {
  if (!searchValue) return undefined;
  return collectAccountSearchAddresses(account, extraAddresses).find((addr) =>
    addr.toLowerCase().includes(searchValue),
  );
}

function AccountRecipients({
  networkId,
  senderDeriveType,
  lastUsedDeriveType: lastUsedDeriveTypeProp,
  searchKey,
  debouncedSearchKey: debouncedSearchKeyProp,
  isSearchMode,
  keylessWalletsOnly,
  onInputTypeChange,
  onSelect,
  onMatchStatusChange,
}: IAccountRecipientsProps) {
  const intl = useIntl();

  // Single IPC call — all wallet/account aggregation happens in background.
  // useDeferredValue lets React yield to events (close button) mid-render.
  const { result: walletGroupsRaw = [], isLoading: isLoadingAccounts } =
    usePromiseResult<IWalletGroup[]>(
      async () => {
        if (!networkId) {
          return [];
        }

        const { groups, mergeDeriveAssetsEnabled } =
          await backgroundApiProxy.serviceAccount.getWalletAccountGroupsForNetwork(
            { networkId, keylessWalletsOnly },
          );

        // senderDeriveType filtering stays on UI side (cheap, no IPC)
        if (!mergeDeriveAssetsEnabled) {
          return groups
            .map((group) => {
              const targetDeriveType =
                senderDeriveType ?? group.accounts[0]?.deriveType;
              if (!targetDeriveType) return group;
              const filtered = group.accounts.filter(
                (a) => !a.deriveType || a.deriveType === targetDeriveType,
              );
              return filtered.length > 0
                ? { ...group, accounts: filtered }
                : group;
            })
            .filter((g) => g.accounts.length > 0);
        }
        return groups;
      },
      [networkId, senderDeriveType, keylessWalletsOnly],
      { initResult: [], watchLoading: true, undefinedResultIfError: true },
    );
  const walletGroups = useDeferredValue(walletGroupsRaw);

  // BTC fresh address lookup — logic lives in ServiceFreshAddress.
  const { result: btcFreshAddressMap = {} } = usePromiseResult<
    Record<string, string[]>
  >(
    async () => {
      if (!networkUtils.isBTCNetwork(networkId) || !walletGroups.length) {
        return {};
      }
      const accounts = walletGroups.flatMap((group) =>
        (group.accounts ?? []).map((item) => ({
          accountId: item.account.id,
          deriveType: item.deriveType,
        })),
      );
      return backgroundApiProxy.serviceFreshAddress.getSearchableAddressesForAccounts(
        { networkId, accounts },
      );
    },
    [walletGroups, networkId],
    { initResult: {}, undefinedResultIfError: true },
  );

  const debouncedSearchKey = debouncedSearchKeyProp ?? '';
  const trimmedSearchKey = normalizeSearchKey(debouncedSearchKey);
  const isSearchActive = !!(isSearchMode && trimmedSearchKey);
  const searchValue = trimmedSearchKey;
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
              !!findMatchedAccountAddress(
                item.account,
                searchValue,
                item.account?.id
                  ? btcFreshAddressMap[item.account.id]
                  : undefined,
              ),
          });

        if (sortedAccounts.length > 0) {
          // Attach the matched address so the row can display the value the
          // user actually searched for instead of the current fresh address
          // (OK-53313). Name matches keep matchedAddress undefined so the
          // default display path still wins.
          const decoratedAccounts = sortedAccounts.map((item) => {
            const isNameHit = (item.account?.name ?? '')
              .toLowerCase()
              .includes(searchValue);
            if (isNameHit) return item;
            const matchedAddress = findMatchedAccountAddress(
              item.account,
              searchValue,
              item.account?.id
                ? btcFreshAddressMap[item.account.id]
                : undefined,
            );
            return matchedAddress ? { ...item, matchedAddress } : item;
          });
          const updatedGroup = { ...group, accounts: decoratedAccounts };
          if (nameMatched.length > 0) {
            nameMatchedGroups.push(updatedGroup);
          } else {
            addressOnlyGroups.push(updatedGroup);
          }
        }
      }
    }

    return [...nameMatchedGroups, ...addressOnlyGroups];
  }, [walletGroups, isSearchActive, searchValue, btcFreshAddressMap]);

  // Handle account selection
  const handleSelectAccount = useCallback(
    (item: IAccountWithDeriveInfo) => {
      const account = item?.account;
      if (!account) return;
      const address =
        item.matchedAddress ??
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

      // Collect unique derive types for this wallet group. For BTC
      // merge-derive chains we also surface the per-type explanation
      // (Taproot / Native SegWit / ...) as a description so users know
      // what each option means without guessing (OK-53312).
      const deriveTypeMap = new Map<
        string,
        { label: string; description?: string; deriveType: string }
      >();
      for (const item of allAccounts) {
        const dt = item.deriveType;
        if (dt && !deriveTypeMap.has(dt)) {
          const label = item.deriveInfo?.labelKey
            ? intl.formatMessage({ id: item.deriveInfo.labelKey })
            : (item.deriveInfo?.label ?? dt);
          const tooltipKey = item.deriveInfo?.addressEncoding
            ? addressTypeTooltipMap[item.deriveInfo.addressEncoding]
            : undefined;
          const description = tooltipKey
            ? intl.formatMessage({ id: tooltipKey })
            : undefined;
          deriveTypeMap.set(dt, { label, description, deriveType: dt });
        }
      }
      const deriveTypeOptions = Array.from(deriveTypeMap.values());
      const hasMultipleDeriveTypes = deriveTypeOptions.length > 1;

      // Filter accounts by selected derive type (for multi-derive chains)
      const walletId = group?.walletId ?? '';
      const rawDeriveType =
        walletDeriveType[walletId] ??
        lastUsedDeriveTypeProp ??
        senderDeriveType;
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
    lastUsedDeriveTypeProp,
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
    if (isDebouncing) return;
    onMatchStatusChange?.(accountMatchCount > 0, accountMatchCount);
  }, [accountMatchCount, onMatchStatusChange, isDebouncing]);

  // Flatten sections for simple rendering with section headers
  type IFlatItem =
    | {
        type: 'header';
        title: string;
        walletId: string;
        wallet?: IDBWallet;
        hasMultipleDeriveTypes: boolean;
        deriveTypeOptions: {
          label: string;
          description?: string;
          deriveType: string;
        }[];
        activeDeriveType?: string;
      }
    | {
        type: 'account';
        account: INetworkAccount;
        indexedAccount?: IDBIndexedAccount;
        matchedAddress?: string;
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
            wallet: section.wallet,
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
            indexedAccount: item.indexedAccount,
            matchedAddress: item.matchedAddress,
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

  // Show skeleton while loading OR while useDeferredValue is still stale
  // (isLoadingAccounts settles before the deferred walletGroups updates,
  // which would briefly show an empty list without this guard).
  const isDeferredStale =
    walletGroupsRaw !== walletGroups && walletGroupsRaw.length > 0;
  const isInitialLoading =
    (isLoadingAccounts !== false || isDeferredStale) &&
    walletGroups.length === 0;
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
              gap="$2"
            >
              <Button
                size="small"
                variant="tertiary"
                flexShrink={1}
                childrenAsText={false}
                onPress={() => toggleCollapse(item.walletId)}
              >
                <XStack alignItems="center" gap="$1.5">
                  {item.wallet ? (
                    <WalletAvatar wallet={item.wallet} size="$5" />
                  ) : null}
                  <XStack alignItems="center" flexShrink={1}>
                    <SizableText
                      size="$bodySmMedium"
                      numberOfLines={1}
                      flexShrink={1}
                    >
                      {item.title}
                    </SizableText>
                    <Icon
                      name={
                        isCollapsed
                          ? 'ChevronRightSmallOutline'
                          : 'ChevronDownSmallOutline'
                      }
                      size="$5"
                      color="$iconSubdued"
                      flexShrink={0}
                    />
                  </XStack>
                </XStack>
              </Button>
              {item.hasMultipleDeriveTypes ? (
                <ActionList
                  title={intl.formatMessage({
                    id: ETranslations.address_type_selector_title,
                  })}
                  items={item.deriveTypeOptions.map((option) => ({
                    label: option.label,
                    renderLabel: option.description
                      ? // eslint-disable-next-line react/no-unstable-nested-components
                        () => (
                          <DeriveTypeLabelWithTooltip
                            label={option.label}
                            description={option.description ?? ''}
                          />
                        )
                      : undefined,
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
                      flexShrink={0}
                      childrenAsText={false}
                    >
                      <XStack alignItems="center">
                        <SizableText size="$bodySmMedium" numberOfLines={1}>
                          {activeLabel ?? ''}
                        </SizableText>
                        <Icon
                          name="ChevronDownSmallSolid"
                          size="$5"
                          color="$iconSubdued"
                        />
                      </XStack>
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

        if (!item.account) {
          return null;
        }
        const {
          account,
          indexedAccount: itemIndexedAccount,
          matchedAddress,
          walletId,
          wallet,
        } = item;
        const currentAddress =
          account.addressDetail?.displayAddress ??
          account.address ??
          account.addressDetail?.address ??
          '';
        const itemAddress = matchedAddress ?? currentAddress;
        const itemKey = `${account.id ?? 'no-id'}-${itemAddress}`;
        const displayName = account.name ?? '';

        return (
          <QuickSelectListItem
            key={itemKey}
            item={{
              id: account.id ?? '',
              name: displayName,
              address: itemAddress || account.id || '',
              displayAddress: itemAddress,
              walletId,
              wallet,
              customRenderAvatar: () => (
                <AccountAvatar
                  size="default"
                  address={
                    itemIndexedAccount
                      ? undefined
                      : account.address ||
                        account.addressDetail?.displayAddress ||
                        account.id
                  }
                  indexedAccount={itemIndexedAccount}
                  account={account}
                  networkId={networkId}
                />
              ),
            }}
            onPress={() => handleSelectAccount({ account, matchedAddress })}
          />
        );
      })}
    </Stack>
  );
}

type IAddressBookRecipientsProps = {
  networkId: string;
  searchKey?: string;
  debouncedSearchKey?: string;
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
  debouncedSearchKey: debouncedSearchKeyProp,
  isSearchMode,
  onInputTypeChange,
  onSelect,
  onMatchStatusChange,
}: IAddressBookRecipientsProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const debouncedSearchKey = debouncedSearchKeyProp ?? '';
  const trimmedSearchKey = normalizeSearchKey(debouncedSearchKey);
  const searchValue = trimmedSearchKey;
  const isSearchActive = !!(isSearchMode && trimmedSearchKey);
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

function RecipientQuickSelect({
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
  keylessWalletsOnly,
  senderDeriveType,
}: IRecipientQuickSelectProps) {
  const intl = useIntl();
  const isRecentHidden = hideTabs?.includes('recent') ?? false;
  // Use controlled state from parent if provided, otherwise use local state
  const [localActiveTab, setLocalActiveTab] =
    useState<IRecipientQuickSelectTab>(isRecentHidden ? 'account' : 'recent');
  const activeTab = activeTabProp ?? localActiveTab;
  const setActiveTab = onActiveTabChange ?? setLocalActiveTab;

  // Last-used derive type from transfer-recipient API (for BTC/LTC).
  // Bubbled up from RecentRecipients → useRecentRecipientsData.
  const [lastUsedDeriveType, setLastUsedDeriveType] = useState<
    string | undefined
  >();

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

  // Defer pre-mounting non-active tabs by ~300ms so the first paint only
  // builds the active tab. Three heavy lists (Recent + Account + AddressBook)
  // each fire their own IPC fan-out and N×blockies avatar work on mount —
  // doing all three simultaneously during the page-in transition caused
  // visible frame drops on web/desktop/ext. After the transition settles,
  // fill in the other tabs so match counts and auto-switch (OK-52952)
  // still work.
  useEffect(() => {
    const timer = setTimeout(() => {
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
    }, 300);
    return () => clearTimeout(timer);
  }, [visibleTabKeys]);

  // Use debounced search key for auto-switch logic
  const debouncedSearchKey = useDebounce(searchKey, 300);
  const trimmedSearchKey = normalizeSearchKey(debouncedSearchKey);
  const isDebouncing = isSearchMode && searchKey !== debouncedSearchKey;

  // Tracks the last value sent to parent via onMatchStatusChange.
  // Declared here (before prevSearchKeyRef check) so the reset below
  // can clear it when searchKey changes.
  const lastMatchStatusRef = useRef<boolean | undefined>(undefined);

  // When the raw searchKey changes, reset tabMatchStatus to null so that
  // the noResult check waits for children to re-report with the new key.
  // This prevents a race where parent's debounce settles before children's,
  // causing a false noResult event from stale tabMatchStatus. (OK-53073)
  const prevSearchKeyRef = useRef(searchKey);
  if (prevSearchKeyRef.current !== searchKey) {
    prevSearchKeyRef.current = searchKey;
    setTabMatchStatus({ recent: null, account: null, addressBook: null });
    setTabMatchCounts({ recent: 0, account: 0, addressBook: 0 });
    lastMatchStatusRef.current = undefined;
  }

  // Track the search key at the time of last manual tab switch
  // Only allow auto-switch if user has typed something new
  const lastManualSwitchSearchKeyRef = useRef<string | undefined>(undefined);
  // Dedup auto-switch analytics to avoid multiple events per search
  const lastAutoSwitchRef = useRef<string | undefined>(undefined);

  // Callbacks for each tab's match status and count.
  // Return prev when unchanged to avoid unnecessary re-renders that
  // cascade to the parent and cause close-button hover flicker.
  const handleRecentMatchStatus = useCallback(
    (hasMatches: boolean, matchCount: number) => {
      setTabMatchStatus((prev) =>
        prev.recent === hasMatches ? prev : { ...prev, recent: hasMatches },
      );
      setTabMatchCounts((prev) =>
        prev.recent === matchCount ? prev : { ...prev, recent: matchCount },
      );
    },
    [],
  );

  const handleAccountMatchStatus = useCallback(
    (hasMatches: boolean, matchCount: number) => {
      setTabMatchStatus((prev) =>
        prev.account === hasMatches ? prev : { ...prev, account: hasMatches },
      );
      setTabMatchCounts((prev) =>
        prev.account === matchCount ? prev : { ...prev, account: matchCount },
      );
    },
    [],
  );

  const handleAddressBookMatchStatus = useCallback(
    (hasMatches: boolean, matchCount: number) => {
      setTabMatchStatus((prev) =>
        prev.addressBook === hasMatches
          ? prev
          : { ...prev, addressBook: hasMatches },
      );
      setTabMatchCounts((prev) =>
        prev.addressBook === matchCount
          ? prev
          : { ...prev, addressBook: matchCount },
      );
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

  // Report match status to parent. Wait until every visible tab has
  // reported (status !== null) before the first notification — avoids
  // firing once with a partial false then again with the real value,
  // which causes 2 parent re-renders and close-button hover flicker.
  useEffect(() => {
    const visibleStatuses = visibleTabKeys.map((tab) => tabMatchStatus[tab]);
    const allReported = visibleStatuses.every((status) => status !== null);
    if (!allReported) return;

    const anyTabHasMatches = visibleStatuses.some((status) => status === true);
    if (lastMatchStatusRef.current !== anyTabHasMatches) {
      lastMatchStatusRef.current = anyTabHasMatches;
      onMatchStatusChange?.(anyTabHasMatches);
    }

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

  // Nothing to render when all tabs are hidden (e.g. web dapp mode)
  if (visibleTabKeys.length === 0) {
    return null;
  }

  return (
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
              onLastUsedDeriveTypeChange={setLastUsedDeriveType}
            />
          </Stack>
        ) : null}
        {activeTab === 'account' || visitedTabs.account ? (
          <Stack display={activeTab === 'account' ? 'flex' : 'none'}>
            <AccountRecipients
              networkId={networkId}
              senderDeriveType={senderDeriveType}
              lastUsedDeriveType={lastUsedDeriveType}
              searchKey={searchKey}
              debouncedSearchKey={debouncedSearchKey}
              isSearchMode={isSearchMode}
              keylessWalletsOnly={keylessWalletsOnly}
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
              debouncedSearchKey={debouncedSearchKey}
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
  );
}

export default memo(RecipientQuickSelect);
