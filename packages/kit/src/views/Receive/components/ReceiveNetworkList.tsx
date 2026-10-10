import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SectionList,
  Spinner,
  Stack,
  Toast,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { IAllNetworksDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAllNetworks';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IReceiveNetworkSelection,
  ITokenSelectorSecondaryTab,
  ITokenSelectorSecondaryTabListProps,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils, {
  POPULAR_NETWORK_IDS,
  buildPopularFirstNetworkSections,
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';
import type { INetworkListSection } from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useCreateAddressForNetwork } from '../../../components/AccountSelector/hooks/useCreateAddressForNetwork';
import { EmptyToken } from '../../../components/Empty';
import { ListItem } from '../../../components/ListItem';
import { ListLoading } from '../../../components/Loading';
import { NetworkAvatarBase } from '../../../components/NetworkAvatar';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useFuseSearch } from '../../ChainSelector/hooks/useFuseSearch';
import { ReceiveTestIDs } from '../testIDs';

import type { IntlShape } from 'react-intl';

type IReceiveNetworkListMode = 'tab' | 'selector';

type IReceiveNetworkListScope = {
  walletId: string;
  indexedAccountId?: string;
  // Any account of the wallet; with `indexedAccountId` the all-networks
  // lookup resolves HD / hardware accounts, imported / watch-only / external
  // wallets are looked up by this account.
  accountId: string;
  // tab: rows open the QR page and Lightning opens the invoice page.
  // selector: rows report back to the caller; Lightning is not listed.
  mode: IReceiveNetworkListMode;
};

type IReceiveNetworkListData = {
  networks: IServerNetwork[];
  accountMap: Record<string, IAllNetworkAccountInfo>;
  allNetworksState: IAllNetworksDBStruct;
};

type IReceiveNetworkListDataSource = {
  peek: () => IReceiveNetworkListData | undefined;
  load: (options?: { fresh?: boolean }) => Promise<IReceiveNetworkListData>;
  preload: () => void;
};

type IReceiveNetworkListProps = IReceiveNetworkListScope & {
  walletType?: string;
  searchText: string;
  onSelectNetwork: (selection: IReceiveNetworkSelection) => void;
  onSelectLightning?: (selection: IReceiveNetworkSelection) => void;
  testID?: string;
  // Scroll feed / top inset when the list sits under a collapsing header.
  listProps?: Partial<ITokenSelectorSecondaryTabListProps>;
  // Handed in when the caller requested the data ahead of the list.
  dataSource?: IReceiveNetworkListDataSource;
};

type IRowProps = {
  network: IServerNetwork;
  account: IAllNetworkAccountInfo | undefined;
  isEnabled: boolean;
  walletId: string;
  indexedAccountId?: string;
  onSelect: (selection: IReceiveNetworkSelection) => void | Promise<void>;
  createAddressForNetwork: ReturnType<
    typeof useCreateAddressForNetwork
  >['createAddressForNetwork'];
  enableNetwork: ReturnType<typeof useCreateAddressForNetwork>['enableNetwork'];
  onAddressCreated: () => Promise<void>;
};

const POPULAR_NETWORK_ID_SET = new Set(POPULAR_NETWORK_IDS);
// Enough placeholder rows to fill the list while it loads.
const LOADING_ROW_COUNT = 10;

async function fetchReceiveNetworkListData(
  { walletId, accountId, indexedAccountId, mode }: IReceiveNetworkListScope,
  { skipAccountsCache }: { skipAccountsCache: boolean },
): Promise<IReceiveNetworkListData> {
  const [{ mainnetItems }, { accountsInfo }, allNetworksState] =
    await Promise.all([
      backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
        { accountId, walletId, excludeTestNetwork: true },
      ),
      backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
        accountId,
        indexedAccountId,
        networkId: getNetworkIdsMap().onekeyall,
        excludeTestNetwork: true,
        // Rows show the global default type first, but a network that only
        // has a non-default address (e.g. BTC with Taproot only) must not
        // show "Create address".
        includingNotEqualGlobalDeriveTypeAccount: true,
        skipCache: skipAccountsCache,
      }),
      backgroundApiProxy.serviceAllNetwork.getAllNetworksState(),
    ]);
  const accountMap: Record<string, IAllNetworkAccountInfo> = {};
  accountsInfo.forEach((info) => {
    if (info.dbAccount && !accountMap[info.networkId]) {
      accountMap[info.networkId] = info;
    }
  });
  const networks = mainnetItems.filter(
    (network) =>
      !networkUtils.isAllNetwork({ networkId: network.id }) &&
      (mode === 'tab' ||
        !networkUtils.isLightningNetworkByNetworkId(network.id)),
  );
  return { networks, accountMap, allNetworksState };
}

// Loads the list's data and keeps the newest result for the next mount of
// the list. Networks, addresses and enabled state travel together: the rows
// need all three, and a list that fills in piece by piece goes through
// several loading looks and changes row height under the user.
function createReceiveNetworkListDataSource(
  scope: IReceiveNetworkListScope,
): IReceiveNetworkListDataSource {
  let latest: IReceiveNetworkListData | undefined;
  let pending: Promise<IReceiveNetworkListData> | undefined;
  const load = (options?: { fresh?: boolean }) => {
    const fresh = !!options?.fresh;
    if (pending && !fresh) {
      return pending;
    }
    const promise: Promise<IReceiveNetworkListData> =
      fetchReceiveNetworkListData(scope, { skipAccountsCache: fresh })
        .then((data) => {
          // Only the newest load is kept; an older one may still land later.
          if (pending === promise) {
            latest = data;
          }
          return data;
        })
        .finally(() => {
          if (pending === promise) {
            pending = undefined;
          }
        });
    pending = promise;
    return promise;
  };
  return {
    peek: () => latest,
    load,
    preload: () => {
      // A failed warm-up is retried by the list's own load.
      load().catch(() => undefined);
    },
  };
}

// The "Networks" segment of the main Receive token list, handed to the
// generic token selector as its secondary tab.
export function buildReceiveNetworkSecondaryTab({
  intl,
  walletId,
  indexedAccountId,
  accountId,
  walletType,
  onSelectNetwork,
  onSelectLightning,
}: {
  intl: IntlShape;
  walletId: string;
  indexedAccountId?: string;
  accountId: string;
  walletType?: string;
  onSelectNetwork: (selection: IReceiveNetworkSelection) => void;
  onSelectLightning: (selection: IReceiveNetworkSelection) => void;
}): ITokenSelectorSecondaryTab {
  // Requested as the Receive page opens, so the segment usually paints
  // complete on its first frame instead of going through a loading state.
  const dataSource = createReceiveNetworkListDataSource({
    walletId,
    indexedAccountId,
    accountId,
    mode: 'tab',
  });
  dataSource.preload();
  return {
    tokensTabLabel: intl.formatMessage({
      id: ETranslations.receive_token_tab__title,
    }),
    label: intl.formatMessage({ id: ETranslations.global_network }),
    searchPlaceholder: intl.formatMessage({
      id: ETranslations.form_search_network_placeholder,
    }),
    testIDs: {
      segment: ReceiveTestIDs.SelectSegment,
      tokensTab: ReceiveTestIDs.SelectSegmentToken,
      secondaryTab: ReceiveTestIDs.SelectSegmentNetwork,
      searchBar: ReceiveTestIDs.SelectSearchBar,
    },
    renderContent: (searchKey, listProps) => (
      <ReceiveNetworkList
        testID={ReceiveTestIDs.NetworkList}
        mode="tab"
        walletId={walletId}
        indexedAccountId={indexedAccountId}
        accountId={accountId}
        walletType={walletType}
        searchText={searchKey}
        onSelectNetwork={onSelectNetwork}
        onSelectLightning={onSelectLightning}
        listProps={listProps}
        dataSource={dataSource}
      />
    ),
    onTabChange: ({ toSecondary }) => {
      defaultLogger.transaction.receive.receiveSwitchTab({
        fromTab: toSecondary ? 'token' : 'network',
        toTab: toSecondary ? 'network' : 'token',
      });
    },
  };
}

function ReceiveNetworkRow({
  network,
  account,
  isEnabled,
  walletId,
  indexedAccountId,
  onSelect,
  createAddressForNetwork,
  enableNetwork,
  onAddressCreated,
}: IRowProps) {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const isLightning = networkUtils.isLightningNetworkByNetworkId(network.id);

  const subtitle = useMemo(() => {
    if (account) {
      return isLightning
        ? ''
        : accountUtils.shortenAddress({ address: account.apiAddress });
    }
    return intl.formatMessage({
      id: loading
        ? ETranslations.global_creating_address
        : ETranslations.global_create_address,
    });
  }, [account, intl, isLightning, loading]);

  const handlePress = useCallback(async () => {
    let selectedAccountId = account?.accountId;
    let createdAddress = false;
    if (!selectedAccountId) {
      try {
        setLoading(true);
        selectedAccountId = await createAddressForNetwork({
          walletId,
          indexedAccountId,
          networkId: network.id,
          isNetworkEnabled: isEnabled,
        });
        if (!selectedAccountId) {
          return;
        }
        createdAddress = true;
        await onAddressCreated();
      } finally {
        setLoading(false);
      }
    } else if (!isEnabled) {
      // An existing address on a network the user had switched off: the
      // receive flow enables it the same way the token list does.
      await enableNetwork(network.id);
      Toast.success({
        title: intl.formatMessage({ id: ETranslations.network_also_enabled }),
      });
    }
    await onSelect({ network, accountId: selectedAccountId, createdAddress });
  }, [
    account?.accountId,
    createAddressForNetwork,
    enableNetwork,
    indexedAccountId,
    intl,
    isEnabled,
    network,
    onAddressCreated,
    onSelect,
    walletId,
  ]);

  return (
    <ListItem
      testID={ReceiveTestIDs.NetworkListItem(network.id)}
      title={network.name}
      subtitle={subtitle}
      renderAvatar={
        <NetworkAvatarBase
          logoURI={network.logoURI}
          isCustomNetwork={network.isCustomNetwork}
          networkName={network.name}
          size="$10"
        />
      }
      onPress={handlePress}
      disabled={loading}
    >
      {loading ? (
        <Stack p="$0.5">
          <Spinner />
        </Stack>
      ) : null}
      {!account && !loading ? (
        <Icon name="PlusLargeOutline" color="$iconSubdued" />
      ) : null}
    </ListItem>
  );
}
const ReceiveNetworkRowMemo = memo(ReceiveNetworkRow);

export function ReceiveNetworkList({
  walletId,
  indexedAccountId,
  accountId,
  walletType,
  mode,
  searchText,
  onSelectNetwork,
  onSelectLightning,
  testID,
  listProps,
  dataSource: sharedDataSource,
}: IReceiveNetworkListProps) {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const isOthersWallet = accountUtils.isOthersWallet({ walletId });
  const freshLoadRef = useRef(false);
  const { createAddressForNetwork, enableNetwork } =
    useCreateAddressForNetwork();

  const dataSource = useMemo(
    () =>
      sharedDataSource ??
      createReceiveNetworkListDataSource({
        walletId,
        indexedAccountId,
        accountId,
        mode,
      }),
    [accountId, indexedAccountId, mode, sharedDataSource, walletId],
  );
  // Starts from whatever the source already holds, then revalidates.
  const { result: data, run: reloadData } = usePromiseResult(
    () => dataSource.load({ fresh: freshLoadRef.current }),
    [dataSource],
    { initResult: dataSource.peek() },
  );

  const refreshAfterAddressCreated = useCallback(async () => {
    freshLoadRef.current = true;
    try {
      await reloadData({ alwaysSetState: true });
    } finally {
      freshLoadRef.current = false;
    }
  }, [reloadData]);

  const [enabledOverrides, setEnabledOverrides] = useState<
    Record<string, boolean>
  >({});
  const handleEnableNetwork = useCallback(
    async (networkId: string) => {
      await enableNetwork(networkId);
      setEnabledOverrides((prev) => ({ ...prev, [networkId]: true }));
    },
    [enableNetwork],
  );

  const visibleNetworks = useMemo(() => {
    if (!data) {
      return [];
    }
    // Imported / watch-only / external wallets cannot derive new addresses:
    // only networks that already have one are listed.
    return isOthersWallet
      ? data.networks.filter((network) => !!data.accountMap[network.id])
      : data.networks;
  }, [data, isOthersWallet]);

  const fuseSearch = useFuseSearch(visibleNetworks);
  const isSearchMode = !!searchText.trim();

  const popularTitle = intl.formatMessage({ id: ETranslations.global_popular });
  const sections = useMemo<INetworkListSection[]>(() => {
    const keyword = searchText.trim();
    if (keyword) {
      const matches = fuseSearch(keyword);
      return matches.length ? [{ data: matches }] : [];
    }
    return buildPopularFirstNetworkSections({
      networks: visibleNetworks,
      popularTitle,
    });
  }, [fuseSearch, popularTitle, searchText, visibleNetworks]);

  const handleSelect = useCallback(
    async (selection: IReceiveNetworkSelection) => {
      const { network, createdAddress } = selection;
      const isLightning = networkUtils.isLightningNetworkByNetworkId(
        network.id,
      );
      if (mode === 'tab') {
        let action: 'open' | 'create' | 'invoice' = 'open';
        if (isLightning) {
          action = 'invoice';
        } else if (createdAddress) {
          action = 'create';
        }
        defaultLogger.transaction.receive.receiveSelectNetworkTab({
          networkId: network.id,
          section: POPULAR_NETWORK_ID_SET.has(network.id) ? 'popular' : 'alpha',
          action,
          hasAddress: !createdAddress,
          isSearchMode,
          walletType,
        });
      }
      if (isLightning) {
        onSelectLightning?.(selection);
        return;
      }
      onSelectNetwork(selection);
    },
    [isSearchMode, mode, onSelectLightning, onSelectNetwork, walletType],
  );

  const renderSectionHeader = useCallback(
    (item: { section: { title?: string } }) =>
      item?.section?.title ? (
        <SectionList.SectionHeader title={item.section.title} />
      ) : (
        <Stack h="$3" />
      ),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: IServerNetwork }) => {
      const state = data?.allNetworksState;
      const isEnabled =
        enabledOverrides[item.id] ||
        (state
          ? isEnabledNetworksInAllNetworks({
              networkId: item.id,
              disabledNetworks: state.disabledNetworks,
              enabledNetworks: state.enabledNetworks,
              isTestnet: false,
            })
          : true);
      return (
        <ReceiveNetworkRowMemo
          network={item}
          account={data?.accountMap[item.id]}
          isEnabled={isEnabled}
          walletId={walletId}
          indexedAccountId={indexedAccountId}
          onSelect={handleSelect}
          createAddressForNetwork={createAddressForNetwork}
          enableNetwork={handleEnableNetwork}
          onAddressCreated={refreshAfterAddressCreated}
        />
      );
    },
    [
      createAddressForNetwork,
      data,
      enabledOverrides,
      handleEnableNetwork,
      handleSelect,
      indexedAccountId,
      refreshAfterAddressCreated,
      walletId,
    ],
  );

  const listEmptyComponent = useMemo(() => {
    if (data) {
      // Same search-empty as the token segment: copy, icon and position.
      return (
        <EmptyToken
          illustration="SearchDocument"
          title={intl.formatMessage({
            id: ETranslations.token_selector_search_no_result__title,
          })}
          mt="18%"
        />
      );
    }
    // The one loading look: the frame the rows are about to fill, at their
    // final positions, so nothing moves when they land.
    return (
      <Stack>
        {isSearchMode ? (
          <Stack h="$3" />
        ) : (
          <SectionList.SectionHeader title={popularTitle} />
        )}
        <ListLoading isTokenSelectorView listCount={LOADING_ROW_COUNT} />
      </Stack>
    );
  }, [data, intl, isSearchMode, popularTitle]);

  return (
    <SectionList
      testID={testID}
      onScroll={listProps?.onScroll}
      scrollEventThrottle={listProps?.scrollEventThrottle}
      contentContainerStyle={listProps?.contentContainerStyle}
      estimatedItemSize={60}
      stickySectionHeadersEnabled
      sections={sections}
      renderSectionHeader={renderSectionHeader}
      renderItem={renderItem}
      ListEmptyComponent={listEmptyComponent}
      ListFooterComponent={<Stack h={bottom || '$3'} />}
    />
  );
}
