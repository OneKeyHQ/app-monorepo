import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { CanceledError } from 'axios';
import BigNumber from 'bignumber.js';
import { uniqBy } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { Icon, Page, SizableText, Toast, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TokenListView } from '@onekeyhq/kit/src/components/TokenListView';
import { TokenSelectorLpTokenSwitch } from '@onekeyhq/kit/src/components/TokenSelectorFilter';
import {
  type IScopedActiveTokenList,
  type IScopedActiveTokenListState,
  buildScopedActiveTokenListFromResponses,
  fetchFilteredTokenSelectorTokens,
  fetchTokenSelectorAccountTokens,
  filterTokenSelectorSearchTokensByBackendIndexedNetworks,
  resolveIsSelectorAllNetworks,
} from '@onekeyhq/kit/src/components/TokenSelectorFilter/utils';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useIsDeFiEnabled } from '@onekeyhq/kit/src/hooks/useIsDeFiEnabled';
import { useTokenListActions } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { useHomeTokenListSnapshot } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { useTokenSelectorFilterPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IAccountDeriveTypes,
  IVaultSettings,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { SEARCH_KEY_MIN_LENGTH } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAssetSelectorParamList } from '@onekeyhq/shared/src/routes';
import { EAssetSelectorRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { isEnabledNetworksInAllNetworks } from '@onekeyhq/shared/src/utils/networkUtils';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  extractCrossNetworkSearchQuery,
  tokenizeTokenSearchKeywords,
} from '@onekeyhq/shared/src/utils/tokenSelectorCrossNetworkUtils';
import {
  TOKEN_SELECTOR_LP_TOKEN_FILTER_ENABLED,
  buildTokenSelectorDappTokenFilterParams,
  filterTokenSelectorTokensByDappTokenFilterParams,
  isTokenSelectorDappTokenFilterSupportedNetwork,
} from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import {
  buildSelectorTokenListFromResponses,
  checkIsOnlyOneTokenHasBalance,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useAccountSelectorCreateAddress } from '../../../components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { NetworkAvatarBase } from '../../../components/NetworkAvatar/NetworkAvatar';
import { useAccountData } from '../../../hooks/useAccountData';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { filterTokensByAccountNetworkCompatibility } from '../../../utils/tokenSelectorAccountCompatibility';
import { HomeTokenListProviderMirrorWrapper } from '../../Home/components/HomeTokenListProvider';
import { AssetSelectorTestIDs } from '../testIDs';
import {
  resolveSearchTokenListForKeywords,
  shouldApplySearchResponse,
} from '../utils/tokenSelectorSearchUtils';

import type { ITokenSelectorSearchTokenList } from '../utils/tokenSelectorSearchUtils';
import type { RouteProp } from '@react-navigation/core';
import type { TextInputFocusEventData } from 'react-native';

const num = 0;

type ISelectorTokenListRequestContext = {
  accountId: string;
  networkId: string;
  indexedAccountId: string;
  activeAccountId: string;
  activeNetworkId: string;
  isSelectorAllNetworks: boolean;
  mergeDeriveAddressData: boolean;
  showLpTokensOnly: boolean;
  useSelectorFilteredTokenList: boolean;
  showActiveAccountTokenList: boolean;
};

type ITokenSelectorSearchFilterContext =
  | 'all-token'
  | 'wallet-token'
  | 'dapp-token';

type ITokenSelectorNormalViewSnapshot = {
  tokenList: {
    tokens: IAccountToken[];
    smallBalanceTokens: IAccountToken[];
  };
  tokenListMap: Record<string, ITokenFiat>;
  aggregateTokenListMap: Record<string, { tokens: IAccountToken[] }>;
  aggregateTokenFiatMap: Record<string, ITokenFiat>;
};

type ITokenSelectorScopedViewSnapshot = {
  tokenList: IScopedActiveTokenList;
  tokenListMap: Record<string, ITokenFiat>;
};

const TOKEN_SELECTOR_VIEW_CACHE_MAX_TOKEN_ROWS = 300;

type ITokenSelectorHeaderRightProps = {
  showDeFiTokenSwitch?: boolean;
  loading?: boolean;
  onLpTokenFilterChange: (value: boolean) => void;
  onSwitchNetwork?: () => void;
  networkLogoURI?: string;
  networkName?: string;
  networkShortName?: string;
  isCustomNetwork?: IServerNetwork['isCustomNetwork'];
};

const TokenSelectorHeaderRight = memo(
  ({
    showDeFiTokenSwitch,
    loading,
    onLpTokenFilterChange,
    onSwitchNetwork,
    networkLogoURI,
    networkName,
    networkShortName,
    isCustomNetwork,
  }: ITokenSelectorHeaderRightProps) => {
    const [tokenSelectorFilter] = useTokenSelectorFilterPersistAtom();
    const showTokenSelectorFilter =
      TOKEN_SELECTOR_LP_TOKEN_FILTER_ENABLED && showDeFiTokenSwitch;
    const showLpTokensOnly = showTokenSelectorFilter
      ? tokenSelectorFilter.sendTokenShowLpTokensOnly
      : false;
    const shouldShowNetworkSwitch = !!onSwitchNetwork && !!networkName;

    if (!showTokenSelectorFilter && !shouldShowNetworkSwitch) {
      return null;
    }

    return (
      <XStack alignItems="center" gap="$2" mr="$-2">
        {showTokenSelectorFilter ? (
          <TokenSelectorLpTokenSwitch
            value={showLpTokensOnly}
            onChange={onLpTokenFilterChange}
            loading={loading}
          />
        ) : null}
        {shouldShowNetworkSwitch ? (
          <XStack
            alignItems="center"
            gap="$1.5"
            px="$2"
            py="$1"
            borderRadius="$full"
            hoverStyle={{ bg: '$bgHover' }}
            pressStyle={{ bg: '$bgActive' }}
            onPress={onSwitchNetwork}
            userSelect="none"
          >
            <NetworkAvatarBase
              logoURI={networkLogoURI ?? ''}
              size="$5"
              isCustomNetwork={isCustomNetwork}
              networkName={networkName}
            />
            <SizableText size="$bodyMdMedium" numberOfLines={1} maxWidth="$16">
              {networkShortName}
            </SizableText>
            <Icon name="SwitchHorOutline" size="$4.5" color="$iconSubdued" />
          </XStack>
        ) : null}
      </XStack>
    );
  },
);
TokenSelectorHeaderRight.displayName = 'TokenSelectorHeaderRight';

function isSameSelectorTokenListRequestContext(
  a: ISelectorTokenListRequestContext,
  b: ISelectorTokenListRequestContext,
) {
  return (
    a.accountId === b.accountId &&
    a.networkId === b.networkId &&
    a.indexedAccountId === b.indexedAccountId &&
    a.activeAccountId === b.activeAccountId &&
    a.activeNetworkId === b.activeNetworkId &&
    a.isSelectorAllNetworks === b.isSelectorAllNetworks &&
    a.mergeDeriveAddressData === b.mergeDeriveAddressData &&
    a.showLpTokensOnly === b.showLpTokensOnly &&
    a.useSelectorFilteredTokenList === b.useSelectorFilteredTokenList &&
    a.showActiveAccountTokenList === b.showActiveAccountTokenList
  );
}

function readTokenSelectorViewSnapshot<T>(key: string | undefined) {
  return key ? swrCacheUtils.get<T>(key) : undefined;
}

function writeTokenSelectorViewSnapshot<T>({
  key,
  snapshot,
}: {
  key: string | undefined;
  snapshot: T;
}) {
  if (key) {
    swrCacheUtils.set(key, snapshot);
  }
}

function hasNormalTokenSelectorSnapshotData(
  snapshot: ITokenSelectorNormalViewSnapshot | undefined,
) {
  return Boolean(
    snapshot &&
    (snapshot.tokenList.tokens.length > 0 ||
      snapshot.tokenList.smallBalanceTokens.length > 0),
  );
}

function getNormalTokenSelectorSnapshotRowCount(
  snapshot: ITokenSelectorNormalViewSnapshot,
) {
  return (
    snapshot.tokenList.tokens.length +
    snapshot.tokenList.smallBalanceTokens.length
  );
}

function getScopedTokenSelectorSnapshotRowCount(
  snapshot: ITokenSelectorScopedViewSnapshot,
) {
  return snapshot.tokenList.tokens.length;
}

function isTokenSelectorViewCacheSizeSafe(rowCount: number) {
  return rowCount <= TOKEN_SELECTOR_VIEW_CACHE_MAX_TOKEN_ROWS;
}

function readNormalTokenSelectorViewSnapshot(key: string | undefined) {
  const snapshot =
    readTokenSelectorViewSnapshot<ITokenSelectorNormalViewSnapshot>(key);
  if (
    snapshot &&
    !isTokenSelectorViewCacheSizeSafe(
      getNormalTokenSelectorSnapshotRowCount(snapshot),
    )
  ) {
    if (key) {
      swrCacheUtils.remove(key);
    }
    return undefined;
  }
  return snapshot;
}

function readScopedTokenSelectorViewSnapshot(key: string | undefined) {
  const snapshot =
    readTokenSelectorViewSnapshot<ITokenSelectorScopedViewSnapshot>(key);
  if (
    snapshot &&
    !isTokenSelectorViewCacheSizeSafe(
      getScopedTokenSelectorSnapshotRowCount(snapshot),
    )
  ) {
    if (key) {
      swrCacheUtils.remove(key);
    }
    return undefined;
  }
  return snapshot;
}

function writeNormalTokenSelectorViewSnapshot({
  key,
  snapshot,
}: {
  key: string | undefined;
  snapshot: ITokenSelectorNormalViewSnapshot;
}) {
  if (!key) {
    return;
  }
  if (
    !isTokenSelectorViewCacheSizeSafe(
      getNormalTokenSelectorSnapshotRowCount(snapshot),
    )
  ) {
    swrCacheUtils.remove(key);
    return;
  }
  writeTokenSelectorViewSnapshot({ key, snapshot });
}

function writeScopedTokenSelectorViewSnapshot({
  key,
  snapshot,
}: {
  key: string | undefined;
  snapshot: ITokenSelectorScopedViewSnapshot;
}) {
  if (!key) {
    return;
  }
  if (
    !isTokenSelectorViewCacheSizeSafe(
      getScopedTokenSelectorSnapshotRowCount(snapshot),
    )
  ) {
    swrCacheUtils.remove(key);
    return;
  }
  writeTokenSelectorViewSnapshot({ key, snapshot });
}

function buildNormalTokenSelectorViewSnapshot({
  tokenList,
  tokenListMap,
  aggregateTokenListMap,
  aggregateTokenFiatMap,
}: ITokenSelectorNormalViewSnapshot): ITokenSelectorNormalViewSnapshot {
  return {
    tokenList,
    tokenListMap,
    aggregateTokenListMap,
    aggregateTokenFiatMap,
  };
}

function buildScopedTokenSelectorViewSnapshot({
  tokenList,
  tokenListMap,
}: ITokenSelectorScopedViewSnapshot): ITokenSelectorScopedViewSnapshot {
  return {
    tokenList,
    tokenListMap,
  };
}

function TokenSelector() {
  const intl = useIntl();
  const { updateCreateAccountState, updateProcessingTokenState } =
    useTokenListActions().current;

  const route =
    useRoute<
      RouteProp<IAssetSelectorParamList, EAssetSelectorRoutes.TokenSelector>
    >();

  const navigation = useAppNavigation();

  const { createAddress } = useAccountSelectorCreateAddress();

  const {
    title,
    networkId,
    accountId,
    indexedAccountId,
    closeAfterSelect = true,
    onSelect,
    searchAll,
    enableCrossNetworkSearch,
    browseEmptyTitle,
    isAllNetworks,
    searchPlaceholder,
    footerTipText,
    activeAccountId,
    activeNetworkId,
    forceShowActiveAccountTokenList,
    aggregateTokenSelectorScreen,
    allAggregateTokenMap,
    hideZeroBalanceTokens,
    keepDefaultZeroBalanceTokens,
    enableNetworkAfterSelect,
    exchangeFilter,
    hideBalanceAndValue,
    onSwitchNetwork,
    showDeFiTokenSwitch,
  } = route.params;

  const {
    network,
    account,
    vaultSettings: selectorVaultSettings,
  } = useAccountData({
    networkId,
    accountId,
  });

  const [searchKey, setSearchKey] = useState('');
  const [tokenSelectorFilter, setTokenSelectorFilter] =
    useTokenSelectorFilterPersistAtom();
  // Derive all-networks mode synchronously from the networkId: `network` loads
  // async, and falling back to `network?.isAllNetworks` let the mount-frame
  // self-fetch run in single-network mode and POST the all-network mock id to
  // the wallet API (entries like Receive don't pass the route param).
  const isSelectorAllNetworks = resolveIsSelectorAllNetworks({
    isAllNetworks,
    networkId,
  });
  const isDeFiEnabled = useIsDeFiEnabled(network?.id, !!showDeFiTokenSwitch);
  // `network` loads async, but the filter support check short-circuits on
  // `isAllNetworks` alone, so probe with a synchronous stand-in in all-networks
  // mode: otherwise `showLpTokensOnly` flips after mount and the normal
  // self-fetch fires a full all-network fan-out before the filtered branch
  // takes over and fires a second one.
  let filterProbeNetwork:
    | Pick<IServerNetwork, 'id' | 'isAllNetworks' | 'backendIndex'>
    | undefined;
  if (network) {
    filterProbeNetwork = {
      id: network.id,
      isAllNetworks: isSelectorAllNetworks,
      backendIndex: network.backendIndex,
    };
  } else if (isSelectorAllNetworks) {
    filterProbeNetwork = {
      id: networkId,
      isAllNetworks: true,
      backendIndex: undefined,
    };
  }
  const showTokenSelectorFilter =
    !!showDeFiTokenSwitch &&
    isTokenSelectorDappTokenFilterSupportedNetwork({
      network: filterProbeNetwork,
      isDeFiEnabled,
    });
  const showLpTokensOnly = showTokenSelectorFilter
    ? tokenSelectorFilter.sendTokenShowLpTokensOnly
    : false;
  // Cross-network search (main Receive): under a single-network scope, search
  // the backend across all networks and group results by network. Excluded for
  // custom networks (their search goes through RPC contract lookup) and the LP
  // filter (its backend results are network-scoped by design).
  // `network` resolves asynchronously: require it before enabling, otherwise
  // `!network?.isCustomNetwork` reads as true while it is still undefined and a
  // custom network would dispatch an all-network search on a cold start.
  const crossNetworkSearchEnabled =
    !!enableCrossNetworkSearch &&
    !!network &&
    !isSelectorAllNetworks &&
    !network.isCustomNetwork &&
    !showLpTokensOnly;
  // All-Networks twin of the cross-network case: the backend still matches the
  // keyword string as a whole, so a combined query ("usdt trc20") sent to
  // onekeyall verbatim returns nothing. Same stripping applies; only the
  // fallback networkId differs (already onekeyall). LP filter excluded — its
  // backend results are network-scoped by design.
  const allNetworksCrossSearchEnabled =
    !!searchAll && isSelectorAllNetworks && !showLpTokensOnly;
  // Others (imported / watch-only / external) accounts hold one credential on
  // one impl, so cross-network results — single-network cross mode and the
  // onekeyall search in All Networks alike — must be narrowed to the networks
  // that credential can actually derive an address on. Same rule as the
  // All-Networks account fan-out, so every row left is selectable. HD/HW
  // accounts are unfiltered — they can create an account on any network.
  // Keyed on whether the request itself is cross-network, not on the
  // keyword-stripping gates above: the All-Networks selector sends its own
  // onekeyall networkId regardless of the LP filter, so with LP on
  // `allNetworksCrossSearchEnabled` is false while the backend still answers
  // across networks.
  const isCrossNetworkSearchRequest =
    crossNetworkSearchEnabled || (!!searchAll && !!isSelectorAllNetworks);
  const othersAccountForNetworkFilter =
    isCrossNetworkSearchRequest &&
    account &&
    accountId &&
    accountUtils.isOthersAccount({ accountId })
      ? account
      : undefined;
  let tokenSelectorSearchFilterContext: ITokenSelectorSearchFilterContext =
    'all-token';
  if (showTokenSelectorFilter) {
    tokenSelectorSearchFilterContext = showLpTokensOnly
      ? 'dapp-token'
      : 'wallet-token';
  }

  const tokenSelectorFilterParams = useMemo(
    () =>
      showTokenSelectorFilter
        ? buildTokenSelectorDappTokenFilterParams({
            lpToken: showLpTokensOnly,
          })
        : {},
    [showLpTokensOnly, showTokenSelectorFilter],
  );

  const showActiveAccountTokenList = useMemo(() => {
    if (!activeAccountId || !activeNetworkId) {
      return false;
    }

    if (forceShowActiveAccountTokenList) {
      return true;
    }

    return activeAccountId !== accountId && activeNetworkId !== networkId;
  }, [
    activeAccountId,
    activeNetworkId,
    accountId,
    forceShowActiveAccountTokenList,
    networkId,
  ]);

  const mergeDeriveAddressData =
    !!selectorVaultSettings?.mergeDeriveAssetsEnabled &&
    !!indexedAccountId &&
    !accountUtils.isOthersAccount({ accountId });
  const homeTokenListSnapshot = useHomeTokenListSnapshot();
  const useSelectorFilteredTokenList =
    !!showTokenSelectorFilter && showLpTokensOnly;
  const effectiveShowActiveAccountTokenList =
    showActiveAccountTokenList || useSelectorFilteredTokenList;
  const effectiveHideZeroBalanceTokens =
    showTokenSelectorFilter && showLpTokensOnly ? false : hideZeroBalanceTokens;

  const normalTokenSelectorViewSWRKey = useMemo(
    () =>
      !effectiveShowActiveAccountTokenList && accountId && networkId
        ? swrKeys.tokenSelectorView({
            ownerMode: 'normal',
            filterMode: tokenSelectorSearchFilterContext,
            accountId,
            networkId,
            indexedAccountId,
            isAllNetworks: !!isSelectorAllNetworks,
            mergeDeriveAddressData,
          })
        : undefined,
    [
      accountId,
      effectiveShowActiveAccountTokenList,
      indexedAccountId,
      isSelectorAllNetworks,
      mergeDeriveAddressData,
      networkId,
      tokenSelectorSearchFilterContext,
    ],
  );

  const filteredTokenSelectorViewSWRKey = useMemo(
    () =>
      useSelectorFilteredTokenList &&
      !showActiveAccountTokenList &&
      accountId &&
      networkId
        ? swrKeys.tokenSelectorView({
            ownerMode: 'filtered',
            filterMode: tokenSelectorSearchFilterContext,
            accountId,
            networkId,
            indexedAccountId,
            isAllNetworks: !!isSelectorAllNetworks,
            mergeDeriveAddressData,
          })
        : undefined,
    [
      accountId,
      indexedAccountId,
      isSelectorAllNetworks,
      mergeDeriveAddressData,
      networkId,
      showActiveAccountTokenList,
      tokenSelectorSearchFilterContext,
      useSelectorFilteredTokenList,
    ],
  );

  const activeAccountTokenSelectorViewSWRKey = useMemo(
    () =>
      showActiveAccountTokenList && activeAccountId && activeNetworkId
        ? swrKeys.tokenSelectorView({
            ownerMode: 'active-account',
            filterMode: tokenSelectorSearchFilterContext,
            accountId: activeAccountId,
            networkId: activeNetworkId,
            indexedAccountId,
            activeAccountId,
            activeNetworkId,
            isAllNetworks: !!isSelectorAllNetworks,
            mergeDeriveAddressData,
          })
        : undefined,
    [
      activeAccountId,
      activeNetworkId,
      indexedAccountId,
      isSelectorAllNetworks,
      mergeDeriveAddressData,
      showActiveAccountTokenList,
      tokenSelectorSearchFilterContext,
    ],
  );

  const routeTokenSelectorCache = useMemo<ITokenSelectorNormalViewSnapshot>(
    () =>
      buildNormalTokenSelectorViewSnapshot({
        tokenList: {
          tokens: [],
          smallBalanceTokens: [],
        },
        tokenListMap: {},
        aggregateTokenListMap: {},
        aggregateTokenFiatMap: {},
      }),
    [],
  );

  const initialNormalTokenSelectorSnapshot = useMemo(
    () =>
      readNormalTokenSelectorViewSnapshot(normalTokenSelectorViewSWRKey) ??
      routeTokenSelectorCache,
    [normalTokenSelectorViewSWRKey, routeTokenSelectorCache],
  );

  const initialScopedTokenSelectorSnapshot = useMemo(
    () =>
      readScopedTokenSelectorViewSnapshot(
        activeAccountTokenSelectorViewSWRKey,
      ) ?? readScopedTokenSelectorViewSnapshot(filteredTokenSelectorViewSWRKey),
    [activeAccountTokenSelectorViewSWRKey, filteredTokenSelectorViewSWRKey],
  );

  const [scopedActiveTokenList, setScopedActiveTokenList] =
    useState<IScopedActiveTokenList>(
      initialScopedTokenSelectorSnapshot?.tokenList ?? {
        tokens: [],
        keys: '',
      },
    );
  const [scopedActiveTokenListMap, setScopedActiveTokenListMap] = useState<
    Record<string, ITokenFiat>
  >(initialScopedTokenSelectorSnapshot?.tokenListMap ?? {});
  const [scopedActiveTokenListState, setScopedActiveTokenListState] =
    useState<IScopedActiveTokenListState>({
      isRefreshing: false,
      initialized: !!initialScopedTokenSelectorSnapshot,
    });
  const [isLpTokenSwitchLoading, setIsLpTokenSwitchLoading] = useState(false);
  const [searchTokenState, setSearchTokenState] = useState<{
    isSearching: boolean;
    hasError?: boolean;
  }>({
    isSearching: false,
  });
  const [searchTokenList, setSearchTokenList] = useState<
    ITokenSelectorSearchTokenList<ITokenSelectorSearchFilterContext>
  >({ tokens: [], searchKey: '', filterContext: 'all-token' });
  const latestSearchRequestContextRef = useRef('');
  // Mirrors the input text synchronously — written from onChangeText, ahead
  // of the 200 ms `searchKey` debounce — so an in-flight response can only
  // apply while the input still reads the keywords it was fetched for (see
  // shouldApplySearchResponse). Reading the debounced `searchKey` here instead
  // would leave a 200 ms window after each keystroke where a response for the
  // previous query still passes.
  const liveSearchKeyRef = useRef('');
  const lastTokenSelectorErrorToastAtRef = useRef(0);

  const showFetchTokenListErrorToast = useCallback(() => {
    const now = Date.now();
    if (now - lastTokenSelectorErrorToastAtRef.current < 2000) {
      return;
    }
    lastTokenSelectorErrorToastAtRef.current = now;
    Toast.error({
      title: intl.formatMessage({
        id: ETranslations.global_network_error,
      }),
    });
  }, [intl]);

  // PR-3 (tokenList cells full-delete): the selector self-fetches its displayed
  // list + fiat map + owned-aggregate map and threads them as props into
  // TokenListView, so the selector no longer reads the home
  // `tokenListAtom`/`tokenListMapAtom`/`smallBalanceTokenListAtom`/
  // `aggregateTokensListMapAtom`. The active-account branch keeps its own
  // scoped fetch (`scopedActiveTokenList*`).
  const [selectorTokenList, setSelectorTokenList] = useState<{
    tokens: IAccountToken[];
    smallBalanceTokens: IAccountToken[];
  }>(initialNormalTokenSelectorSnapshot.tokenList);
  const [selectorTokenListMap, setSelectorTokenListMap] = useState<
    Record<string, ITokenFiat>
  >(initialNormalTokenSelectorSnapshot.tokenListMap);
  const [selectorAggregateTokenListMap, setSelectorAggregateTokenListMap] =
    useState<Record<string, { tokens: IAccountToken[] }>>(
      initialNormalTokenSelectorSnapshot.aggregateTokenListMap,
    );
  // PR-6: the flattened ($key -> summed ITokenFiat) aggregate fiat map for the
  // selector's all-networks rows. The self-fetch response's `aggregateTokenMap`
  // is FLAT per single-network request; we nest it by networkId and re-flatten
  // with the SAME sum semantics the home `flattenAggregateTokensMapAtom` uses
  // so the aggregate (all-networks) selector rows resolve real balance/value/
  // price (the per-row `tokenSelectorTokenListMap` does NOT carry aggregate
  // `$key` fiat). Threaded into TokenListView as `tokenSelectorAggregateTokenFiatMap`.
  const [selectorAggregateTokenFiatMap, setSelectorAggregateTokenFiatMap] =
    useState<Record<string, ITokenFiat>>(
      initialNormalTokenSelectorSnapshot.aggregateTokenFiatMap,
    );
  // PR-3: `false` until the self-fetch below resolves the first time. Threaded
  // into TokenListView so the selector shows a skeleton (or its per-owner
  // cached list) until the self-fetch lands instead of flashing EmptyToken —
  // the home tokenList mirror keeps `tokenListState.initialized === true`, so
  // TokenListView cannot infer "selector not yet fetched" on its own.
  const [selectorInitialized, setSelectorInitialized] = useState(
    hasNormalTokenSelectorSnapshotData(initialNormalTokenSelectorSnapshot),
  );
  const selectorFloorSeededRef = useRef(false);
  const selectorLiveLandedRef = useRef(false);
  const selectorFloorOwnerKeyRef = useRef('');
  const selectorFloorOwnerKey = [accountId ?? '', networkId ?? ''].join('__');
  if (selectorFloorOwnerKeyRef.current !== selectorFloorOwnerKey) {
    selectorFloorOwnerKeyRef.current = selectorFloorOwnerKey;
    selectorFloorSeededRef.current = false;
    selectorLiveLandedRef.current = false;
  }

  const handleLpTokenFilterChange = useCallback(
    (value: boolean) => {
      if (value === showLpTokensOnly) {
        return;
      }
      setIsLpTokenSwitchLoading(!!value && !!accountId && !!networkId);
      setTokenSelectorFilter((prev) => ({
        ...prev,
        sendTokenShowLpTokensOnly: value,
      }));
    },
    [accountId, networkId, setTokenSelectorFilter, showLpTokensOnly],
  );

  const executeOnSelect = useCallback(
    async (selectedToken: IAccountToken) => {
      if (!onSelect) return;
      if (exchangeFilter) {
        updateProcessingTokenState({
          isProcessing: true,
          token: selectedToken,
        });
        try {
          await onSelect(selectedToken);
        } finally {
          updateProcessingTokenState({
            isProcessing: false,
            token: null,
          });
        }
      } else {
        void onSelect(selectedToken);
      }

      if (enableNetworkAfterSelect && selectedToken.networkId) {
        const { disabledNetworks, enabledNetworks } =
          await backgroundApiProxy.serviceAllNetwork.getAllNetworksState();
        if (
          !isEnabledNetworksInAllNetworks({
            networkId: selectedToken.networkId,
            disabledNetworks,
            enabledNetworks,
            isTestnet: false,
          })
        ) {
          await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
            enabledNetworks: { [selectedToken.networkId]: true },
          });
          appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.network_also_enabled,
            }),
          });
        }
      }
    },
    [
      onSelect,
      updateProcessingTokenState,
      exchangeFilter,
      enableNetworkAfterSelect,
      intl,
    ],
  );

  const handleTokenOnPress = useCallback(
    async (pressedToken: IAccountToken) => {
      let token = pressedToken;
      if (token.isAggregateToken) {
        const allAggregateTokenList =
          allAggregateTokenMap?.[token.$key]?.tokens ?? [];
        const aggregateTokenList =
          selectorAggregateTokenListMap[token.$key]?.tokens ?? [];
        // Merge owned members with global config members before branching:
        // a stale cache filtered by listed networks can leave a single
        // survivor in either list (e.g. one global member with no owned
        // copy), and neither per-list length check would catch it — the tap
        // would fall through and keep the `aggregate--0` descriptor for
        // account lookup and onSelect. Dedupe by networkId with owned tokens
        // first, matching AggregateTokenSelector's merge.
        const mergedAggregateTokenList = uniqBy(
          [...aggregateTokenList, ...allAggregateTokenList],
          (t) => t.networkId,
        );
        if (mergedAggregateTokenList.length === 1) {
          const singleAggregateToken = mergedAggregateTokenList[0];
          // An owned survivor already carries its accountId.
          if (singleAggregateToken.accountId) {
            await executeOnSelect(singleAggregateToken);
            return;
          }
          // A lone survivor sourced from the global wallet config has no
          // owned copy and thus no accountId: selecting it directly would
          // leak an accountId-less token to onSelect (Receive would fall
          // back to the All-Networks account and skip address creation).
          // Fall through to the account-resolution path below with the real
          // member so the target-network account is matched or created
          // first, mirroring AggregateTokenSelector's row behavior.
          token = singleAggregateToken;
        } else {
          const { tokenHasBalance, tokenHasBalanceCount } =
            checkIsOnlyOneTokenHasBalance({
              // The selector self-fetches its per-row fiat map (`r.tokens.map`
              // ∪ `r.smallBalanceTokens.map`), which is keyed by the
              // per-network sub-token `$key` — exactly what
              // `checkIsOnlyOneTokenHasBalance` iterates (red-team C-F2: NOT
              // the summed aggregate map). Replaces the deleted home
              // `allTokenListMapAtom` read.
              tokenMap: selectorTokenListMap,
              aggregateTokenList,
              allAggregateTokenList,
            });

          if (tokenHasBalance && tokenHasBalanceCount === 1) {
            await executeOnSelect(tokenHasBalance);
            return;
          }

          if (mergedAggregateTokenList.length > 1) {
            // Delay navigation to let the current CA transaction finish
            // rendering SVG icons, avoiding EXC_BAD_ACCESS in
            // InstanceHandle::getTag when Reanimated intercepts layout events
            // from unmounting SVG views.
            await timerUtils.wait(0);
            navigation.push(
              aggregateTokenSelectorScreen ??
                EAssetSelectorRoutes.AggregateTokenSelector,
              {
                accountId,
                indexedAccountId,
                aggregateToken: token,
                aggregateSubTokenList: aggregateTokenList,
                onSelect,
                allAggregateTokenList,
                enableNetworkAfterSelect,
                hideZeroBalanceTokens,
                exchangeFilter,
                hideBalanceAndValue,
              },
            );
            return;
          }
        }
      }

      // Cross-network rows (single-network scope, main Receive): the pressed
      // token lives on a different network than the selector scope, so it must
      // go through the same account-matching/creation path as All Networks —
      // executing onSelect directly would fall back to the scope accountId.
      const isCrossNetworkTokenPress =
        crossNetworkSearchEnabled &&
        !!token.networkId &&
        token.networkId !== networkId;

      if (network?.isAllNetworks || isCrossNetworkTokenPress) {
        let vaultSettings: IVaultSettings | undefined;
        if (token.networkId) {
          vaultSettings =
            await backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId: token.networkId,
            });
        }

        let accounts: IAllNetworkAccountInfo[] = [];

        try {
          if (
            (token.accountId || account?.id) &&
            (token.networkId || network?.id)
          ) {
            const params = token.accountId
              ? {
                  accountId: token.accountId ?? '',
                  networkId: token.networkId ?? '',
                }
              : {
                  accountId: account?.id ?? '',
                  networkId: network?.id ?? '',
                };

            // `fetchAllNetworkAccounts` makes the service treat this as an
            // all-network request, and without an indexedAccountId it derives
            // one FROM the accountId — a path built for the all-networks mock
            // id (`hd-1--0000/0`). Handing it a single-chain id parses the
            // coin type as the index (`m/44'/60'/0'/0/0` -> `hd-1--44`), which
            // is a valid-looking id, so it is accepted silently: normally it
            // matches nothing and every cross-network press falls to
            // createAddress, and if that index exists it resolves someone
            // else's account. Pass the scope's own indexedAccountId so the
            // service short-circuits before deriving. Others accounts have
            // none and must keep taking the othersWalletAccountId branch,
            // which passing this would disable.
            const crossNetworkIndexedAccountId =
              isCrossNetworkTokenPress &&
              indexedAccountId &&
              !accountUtils.isOthersAccount({ accountId: params.accountId })
                ? indexedAccountId
                : undefined;

            let deriveType;

            if (token.accountId && token.networkId) {
              const tokenAccount =
                await backgroundApiProxy.serviceAccount.getAccount({
                  accountId: token.accountId ?? '',
                  networkId: token.networkId ?? '',
                });
              deriveType = (
                await backgroundApiProxy.serviceNetwork.getDeriveTypeByTemplate(
                  {
                    accountId: tokenAccount.id,
                    networkId: token.networkId,
                    template: tokenAccount.template,
                  },
                )
              ).deriveType;
            }

            const { accountsInfo } =
              await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
                ...params,
                indexedAccountId: crossNetworkIndexedAccountId,
                includingNonExistingAccount: true,
                deriveType,
                excludeTestNetwork: false,
                // A single-network accountId cannot be expanded to all-network
                // accounts without this flag; without a match the flow would
                // always fall through to createAddress and needlessly wake
                // hardware wallets.
                fetchAllNetworkAccounts: isCrossNetworkTokenPress,
              });
            accounts = accountsInfo;
          }
        } catch {
          // pass
        }

        const matchedAccount = accounts.find((item) =>
          token.accountId
            ? item.accountId === token.accountId
            : true && item.networkId === token.networkId,
        );

        if (matchedAccount?.accountId) {
          await executeOnSelect({
            ...token,
            accountId: matchedAccount.accountId,
          });
        } else if (account) {
          // Key the creating-address indicator to the pressed row: for the
          // aggregate fall-through above, `token` is the member while the
          // rendered row (CreateAccountView matches by $key/networkId) is the
          // aggregate descriptor.
          updateCreateAccountState({
            isCreating: true,
            token: pressedToken,
          });
          const walletId = accountUtils.getWalletIdFromAccountId({
            accountId: account.id,
          });
          try {
            // For multi-derive networks (e.g. BTC/LTC) align the new account's
            // derive type with the network's global default so the downstream
            // ReceiveToken lookup (getAccountsByIndexedAccounts) can find it.
            const deriveType: IAccountDeriveTypes =
              vaultSettings?.mergeDeriveAssetsEnabled && token.networkId
                ? await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                    {
                      networkId: token.networkId,
                    },
                  )
                : 'default';
            const resp = await createAddress({
              num: 0,
              account: {
                walletId,
                networkId: token.networkId,
                indexedAccountId: account.indexedAccountId,
                deriveType,
              },
            });

            updateCreateAccountState({
              isCreatingAccount: false,
              token: null,
            });

            if (resp) {
              await executeOnSelect({
                ...token,
                accountId: resp.accounts[0]?.id,
              });
            }
          } catch (_e) {
            updateCreateAccountState({
              isCreatingAccount: false,
              token: null,
            });
          }
        } else if (vaultSettings?.mergeDeriveAssetsEnabled) {
          await executeOnSelect(token);
        }
      } else {
        await executeOnSelect(token);
      }

      if (closeAfterSelect) {
        navigation.pop();
      }
    },
    [
      network?.isAllNetworks,
      network?.id,
      networkId,
      crossNetworkSearchEnabled,
      closeAfterSelect,
      allAggregateTokenMap,
      selectorAggregateTokenListMap,
      selectorTokenListMap,
      onSelect,
      navigation,
      aggregateTokenSelectorScreen,
      accountId,
      indexedAccountId,
      enableNetworkAfterSelect,
      hideZeroBalanceTokens,
      hideBalanceAndValue,
      exchangeFilter,
      account,
      updateCreateAccountState,
      createAddress,
      executeOnSelect,
    ],
  );

  // Two-stage search debounce. `searchKey` (list + local filter) follows the
  // input at 200 ms; in `searchAll` mode the backend request waits a further
  // 800 ms (`debounceSearchTokensBySearchKey` below), so the onekeyall search
  // still fires 1 s after the last keystroke and its load is unchanged.
  const debounceUpdateSearchKey = useDebouncedCallback(setSearchKey, 200);
  const clearSearchKey = useCallback(() => {
    liveSearchKeyRef.current = '';
    setSearchKey('');
  }, []);

  const headerSearchBarOptions = useMemo(
    () => ({
      placeholder:
        searchPlaceholder ??
        intl.formatMessage({
          id: ETranslations.send_token_selector_search_placeholder,
        }),
      onChangeText: ({
        nativeEvent,
      }: {
        nativeEvent: TextInputFocusEventData;
      }) => {
        liveSearchKeyRef.current = nativeEvent.text;
        debounceUpdateSearchKey(nativeEvent.text);
      },
    }),
    [debounceUpdateSearchKey, intl, searchPlaceholder],
  );

  const headerRight = useMemo(() => {
    const shouldShowNetworkSwitch = !!onSwitchNetwork && !!network?.name;
    if (!showTokenSelectorFilter && !shouldShowNetworkSwitch) return undefined;

    return function RenderTokenSelectorHeaderRight() {
      return (
        <TokenSelectorHeaderRight
          showDeFiTokenSwitch={showTokenSelectorFilter}
          loading={isLpTokenSwitchLoading}
          onLpTokenFilterChange={handleLpTokenFilterChange}
          onSwitchNetwork={onSwitchNetwork}
          networkLogoURI={network?.logoURI}
          networkName={network?.name}
          networkShortName={network?.shortname}
          isCustomNetwork={network?.isCustomNetwork}
        />
      );
    };
  }, [
    handleLpTokenFilterChange,
    isLpTokenSwitchLoading,
    onSwitchNetwork,
    showTokenSelectorFilter,
    network?.name,
    network?.shortname,
    network?.logoURI,
    network?.isCustomNetwork,
  ]);

  const searchTokensBySearchKey = useCallback(
    async (keywords: string) => {
      // Part of the request identity: the gates flip when `network` resolves
      // or the LP filter toggles, and two runs would otherwise share a context
      // — letting the earlier (differently scoped) response pass isLatest()
      // and overwrite the newer one if it lands after the abort.
      let searchScopeMode = 'scoped';
      if (crossNetworkSearchEnabled) {
        searchScopeMode = 'cross';
      } else if (allNetworksCrossSearchEnabled) {
        searchScopeMode = 'all-cross';
      }
      const requestContext = [
        accountId ?? '',
        networkId ?? '',
        tokenSelectorSearchFilterContext,
        searchScopeMode,
        // `account` resolves after `accountId`: the run before it lands is
        // unfiltered, the run after is narrowed, and they must not share an
        // identity or the earlier response could overwrite the later one.
        othersAccountForNetworkFilter ? 'others-filtered' : 'unfiltered',
        keywords,
      ].join('__');
      latestSearchRequestContextRef.current = requestContext;
      const isLatest = () =>
        shouldApplySearchResponse({
          requestContext,
          latestRequestContext: latestSearchRequestContextRef.current,
          keywords,
          liveSearchKey: liveSearchKeyRef.current,
        });
      setSearchTokenState({ isSearching: true });
      setSearchTokenList((prev) =>
        resolveSearchTokenListForKeywords({
          prev,
          keywords,
          filterContext: tokenSelectorSearchFilterContext,
        }),
      );
      await backgroundApiProxy.serviceToken.abortSearchTokens();
      let searchFailed = false;
      try {
        // Cross-network search: the backend matches the keyword string as a
        // whole, so combined queries ("usdt trx", "usdt-trc20") first strip an
        // exact network keyword and scope the request to that network;
        // otherwise query the backend across all networks (the onekeyall
        // response is a superset of the scoped one). Results are grouped by
        // network locally.
        // Separator-free strings of address-like length skip stripping
        // entirely: a pasted contract address must reach the backend verbatim.
        // The network catalog is only needed for multi-word queries, so it is
        // fetched here rather than on mount (getAllNetworks is memoized in the
        // background service).
        const trimmedKeywords = keywords.trim();
        const isAddressLikeKeywords =
          trimmedKeywords.length >= 20 && !/\s/.test(trimmedKeywords);
        const keywordStrippingEnabled =
          (crossNetworkSearchEnabled || allNetworksCrossSearchEnabled) &&
          !isAddressLikeKeywords &&
          tokenizeTokenSearchKeywords(trimmedKeywords).length >= 2;
        const crossNetworkQuery = keywordStrippingEnabled
          ? extractCrossNetworkSearchQuery({
              keywords,
              networks: (
                await backgroundApiProxy.serviceNetwork.getAllNetworks()
              ).networks,
            })
          : undefined;
        // Stripping success scopes to the named network in either mode. On
        // failure, single-network cross mode widens to onekeyall (status quo),
        // while all-networks mode keeps its own networkId (already onekeyall).
        let result = await backgroundApiProxy.serviceToken.searchTokens({
          accountId,
          networkId:
            crossNetworkQuery?.networkId ??
            (crossNetworkSearchEnabled
              ? getNetworkIdsMap().onekeyall
              : networkId),
          keywords: crossNetworkQuery?.keywords ?? keywords,
        });
        if (othersAccountForNetworkFilter) {
          result = filterTokensByAccountNetworkCompatibility({
            tokens: result,
            account: othersAccountForNetworkFilter,
          });
        }
        if (showLpTokensOnly && isSelectorAllNetworks) {
          result =
            await filterTokenSelectorSearchTokensByBackendIndexedNetworks({
              tokens: result,
            });
        }
        if (showTokenSelectorFilter) {
          result = filterTokenSelectorTokensByDappTokenFilterParams({
            tokens: result,
            tokenSelectorFilterParams,
          });
        }
        if (isLatest()) {
          setSearchTokenList({
            tokens: result,
            searchKey: keywords,
            filterContext: tokenSelectorSearchFilterContext,
          });
        }
      } catch (e) {
        if (isLatest()) {
          // Advance searchKey even on failure. showSkeleton keys off the
          // (searchKey mismatch && empty list) condition, so without
          // updating searchKey here a failed search would leave the token
          // selector stuck on the skeleton forever with no self-recovery
          // until the user edits the query.
          setSearchTokenList({
            tokens: [],
            searchKey: keywords,
            filterContext: tokenSelectorSearchFilterContext,
          });
          searchFailed = true;
          console.log(e);
        }
      } finally {
        if (isLatest()) {
          setSearchTokenState({ isSearching: false, hasError: searchFailed });
        }
      }
    },
    [
      accountId,
      allNetworksCrossSearchEnabled,
      crossNetworkSearchEnabled,
      isSelectorAllNetworks,
      networkId,
      othersAccountForNetworkFilter,
      showLpTokensOnly,
      showTokenSelectorFilter,
      tokenSelectorFilterParams,
      tokenSelectorSearchFilterContext,
    ],
  );

  const retrySearchTokens = useCallback(() => {
    if (searchKey.length >= SEARCH_KEY_MIN_LENGTH) {
      void searchTokensBySearchKey(searchKey);
    }
  }, [searchKey, searchTokensBySearchKey]);

  const applyNormalTokenSelectorSnapshot = useCallback(
    (snapshot: ITokenSelectorNormalViewSnapshot) => {
      setSelectorTokenList(snapshot.tokenList);
      setSelectorTokenListMap(snapshot.tokenListMap);
      setSelectorAggregateTokenListMap(snapshot.aggregateTokenListMap);
      setSelectorAggregateTokenFiatMap(snapshot.aggregateTokenFiatMap);
      setSelectorInitialized(true);
    },
    [],
  );

  const applyScopedTokenSelectorSnapshot = useCallback(
    ({
      snapshot,
      state,
    }: {
      snapshot: ITokenSelectorScopedViewSnapshot;
      state: IScopedActiveTokenListState;
    }) => {
      setScopedActiveTokenList(snapshot.tokenList);
      setScopedActiveTokenListMap(snapshot.tokenListMap);
      setScopedActiveTokenListState(state);
    },
    [],
  );

  const restoreCachedNormalTokenSelectorSnapshot = useCallback(() => {
    const cachedSnapshot =
      readNormalTokenSelectorViewSnapshot(normalTokenSelectorViewSWRKey) ??
      routeTokenSelectorCache;
    if (!hasNormalTokenSelectorSnapshotData(cachedSnapshot)) {
      return false;
    }
    applyNormalTokenSelectorSnapshot(cachedSnapshot);
    return true;
  }, [
    applyNormalTokenSelectorSnapshot,
    normalTokenSelectorViewSWRKey,
    routeTokenSelectorCache,
  ]);

  useEffect(() => {
    if (effectiveShowActiveAccountTokenList) {
      return;
    }
    restoreCachedNormalTokenSelectorSnapshot();
  }, [
    effectiveShowActiveAccountTokenList,
    restoreCachedNormalTokenSelectorSnapshot,
  ]);

  useEffect(() => {
    const scopedKey =
      activeAccountTokenSelectorViewSWRKey ?? filteredTokenSelectorViewSWRKey;
    const snapshot = readScopedTokenSelectorViewSnapshot(scopedKey);
    if (!snapshot) {
      return;
    }
    applyScopedTokenSelectorSnapshot({
      snapshot,
      state: {
        initialized: true,
        isRefreshing: false,
      },
    });
  }, [
    activeAccountTokenSelectorViewSWRKey,
    applyScopedTokenSelectorSnapshot,
    filteredTokenSelectorViewSWRKey,
  ]);

  const latestSelectorTokenListRequestContextRef =
    useRef<ISelectorTokenListRequestContext>({
      accountId: accountId ?? '',
      networkId: networkId ?? '',
      indexedAccountId: indexedAccountId ?? '',
      activeAccountId: activeAccountId ?? '',
      activeNetworkId: activeNetworkId ?? '',
      isSelectorAllNetworks: !!isSelectorAllNetworks,
      mergeDeriveAddressData,
      showLpTokensOnly,
      useSelectorFilteredTokenList,
      showActiveAccountTokenList,
    });
  latestSelectorTokenListRequestContextRef.current = {
    accountId: accountId ?? '',
    networkId: networkId ?? '',
    indexedAccountId: indexedAccountId ?? '',
    activeAccountId: activeAccountId ?? '',
    activeNetworkId: activeNetworkId ?? '',
    isSelectorAllNetworks: !!isSelectorAllNetworks,
    mergeDeriveAddressData,
    showLpTokensOnly,
    useSelectorFilteredTokenList,
    showActiveAccountTokenList,
  };

  usePromiseResult(async () => {
    if (!useSelectorFilteredTokenList || showActiveAccountTokenList) {
      if (!useSelectorFilteredTokenList) {
        setIsLpTokenSwitchLoading(false);
      }
      return;
    }

    if (!accountId || !networkId) {
      setIsLpTokenSwitchLoading(false);
      return;
    }

    const requestContext: ISelectorTokenListRequestContext = {
      accountId,
      networkId,
      indexedAccountId: indexedAccountId ?? '',
      activeAccountId: activeAccountId ?? '',
      activeNetworkId: activeNetworkId ?? '',
      isSelectorAllNetworks: !!isSelectorAllNetworks,
      mergeDeriveAddressData,
      showLpTokensOnly,
      useSelectorFilteredTokenList,
      showActiveAccountTokenList,
    };
    const isLatestRequest = () =>
      isSameSelectorTokenListRequestContext(
        latestSelectorTokenListRequestContextRef.current,
        requestContext,
      );

    if (!isLatestRequest()) {
      return;
    }

    const cachedSnapshot = readScopedTokenSelectorViewSnapshot(
      filteredTokenSelectorViewSWRKey,
    );
    const hasRestoredSnapshot = Boolean(cachedSnapshot);
    if (cachedSnapshot) {
      applyScopedTokenSelectorSnapshot({
        snapshot: cachedSnapshot,
        state: {
          initialized: true,
          isRefreshing: true,
        },
      });
    } else {
      setScopedActiveTokenListState({
        initialized: false,
        isRefreshing: true,
      });
      setScopedActiveTokenList({
        tokens: [],
        keys: '',
      });
      setScopedActiveTokenListMap({});
    }

    try {
      const { responses, expectedResponseCount } =
        await fetchFilteredTokenSelectorTokens({
          accountId,
          networkId,
          indexedAccountId,
          isAllNetworks: !!isSelectorAllNetworks,
          mergeDeriveAddressData,
          onlyBackendIndexedNetworks: showLpTokensOnly,
          tokenSelectorFilterParams,
        });

      if (!isLatestRequest()) {
        return;
      }

      const isIncompleteAllNetworksFanOut =
        isSelectorAllNetworks && responses.length < expectedResponseCount;
      if (isIncompleteAllNetworksFanOut) {
        if (hasRestoredSnapshot) {
          setScopedActiveTokenListState({
            initialized: true,
            isRefreshing: false,
          });
        } else {
          setScopedActiveTokenListState({
            initialized: true,
            isRefreshing: false,
          });
          showFetchTokenListErrorToast();
        }
        return;
      }

      const tokenFilterKeySuffix = showLpTokensOnly
        ? 'lp-dapp-token'
        : 'wallet-token';
      const { tokenList, tokenListMap } =
        buildScopedActiveTokenListFromResponses({
          responses,
          keySuffix: tokenFilterKeySuffix,
        });

      const snapshot = buildScopedTokenSelectorViewSnapshot({
        tokenList,
        tokenListMap,
      });
      applyScopedTokenSelectorSnapshot({
        snapshot,
        state: {
          initialized: true,
          isRefreshing: false,
        },
      });
      writeScopedTokenSelectorViewSnapshot({
        key: filteredTokenSelectorViewSWRKey,
        snapshot,
      });
    } catch (e) {
      if (isLatestRequest()) {
        setScopedActiveTokenListState({
          initialized: true,
          isRefreshing: false,
        });
        showFetchTokenListErrorToast();
      }
      console.error(e);
    } finally {
      if (isLatestRequest()) {
        setIsLpTokenSwitchLoading(false);
      }
    }
  }, [
    activeAccountId,
    activeNetworkId,
    accountId,
    applyScopedTokenSelectorSnapshot,
    filteredTokenSelectorViewSWRKey,
    indexedAccountId,
    isSelectorAllNetworks,
    mergeDeriveAddressData,
    networkId,
    showActiveAccountTokenList,
    showLpTokensOnly,
    showFetchTokenListErrorToast,
    tokenSelectorFilterParams,
    useSelectorFilteredTokenList,
  ]);

  usePromiseResult(async () => {
    if (activeAccountId && activeNetworkId && showActiveAccountTokenList) {
      const requestContext: ISelectorTokenListRequestContext = {
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        indexedAccountId: indexedAccountId ?? '',
        activeAccountId,
        activeNetworkId,
        isSelectorAllNetworks: !!isSelectorAllNetworks,
        mergeDeriveAddressData,
        showLpTokensOnly,
        useSelectorFilteredTokenList,
        showActiveAccountTokenList,
      };
      const isLatestRequest = () =>
        isSameSelectorTokenListRequestContext(
          latestSelectorTokenListRequestContextRef.current,
          requestContext,
        );

      if (!isLatestRequest()) {
        return;
      }

      const cachedSnapshot = readScopedTokenSelectorViewSnapshot(
        activeAccountTokenSelectorViewSWRKey,
      );
      if (cachedSnapshot) {
        applyScopedTokenSelectorSnapshot({
          snapshot: cachedSnapshot,
          state: {
            initialized: true,
            isRefreshing: true,
          },
        });
      } else {
        setScopedActiveTokenListState({
          initialized: false,
          isRefreshing: true,
        });
        setScopedActiveTokenList({
          tokens: [],
          keys: '',
        });
        setScopedActiveTokenListMap({});
      }

      try {
        if (showLpTokensOnly) {
          const activeNetwork =
            await backgroundApiProxy.serviceNetwork.getNetwork({
              networkId: activeNetworkId,
            });
          const isActiveNetworkDeFiEnabled = activeNetwork?.isAllNetworks
            ? true
            : await backgroundApiProxy.serviceDeFi.isNetworkDeFiEnabled(
                activeNetwork.id,
              );
          if (
            !isTokenSelectorDappTokenFilterSupportedNetwork({
              network: activeNetwork,
              isDeFiEnabled: isActiveNetworkDeFiEnabled,
            })
          ) {
            if (isLatestRequest()) {
              setScopedActiveTokenListState({
                isRefreshing: false,
                initialized: true,
              });
            }
            return;
          }
        }

        const r = await fetchTokenSelectorAccountTokens({
          accountId: activeAccountId,
          networkId: activeNetworkId,
          indexedAccountId,
          ...tokenSelectorFilterParams,
        });

        if (!isLatestRequest()) {
          return;
        }

        const snapshot = buildScopedTokenSelectorViewSnapshot({
          tokenList: {
            tokens: [...r.tokens.data, ...r.smallBalanceTokens.data],
            keys: `${r.tokens.keys}_${r.smallBalanceTokens.keys}`,
          },
          tokenListMap: {
            ...r.tokens.map,
            ...r.smallBalanceTokens.map,
          },
        });
        applyScopedTokenSelectorSnapshot({
          snapshot,
          state: {
            isRefreshing: false,
            initialized: true,
          },
        });
        writeScopedTokenSelectorViewSnapshot({
          key: activeAccountTokenSelectorViewSWRKey,
          snapshot,
        });

        // Update network value cache so ChainSelector shows fresh values on back
        const totalFiatValue = new BigNumber(r.tokens.fiatValue ?? '0')
          .plus(r.smallBalanceTokens.fiatValue ?? '0')
          .toFixed();
        let valueAccountId = indexedAccountId || '';
        if (!valueAccountId && activeAccountId) {
          if (accountUtils.isOthersAccount({ accountId: activeAccountId })) {
            valueAccountId = activeAccountId;
          }
        }
        if (valueAccountId && activeNetworkId) {
          const valueKey = accountUtils.buildAccountValueKey({
            accountId: activeAccountId,
            networkId: activeNetworkId,
          });
          void backgroundApiProxy.serviceAccountProfile.updateAllNetworkAccountValue(
            {
              accountId: valueAccountId,
              // `r.tokens.fiatValue` is normalized to USD by ServiceToken
              // (or stays in the request currency when rates were missing).
              // Use the response's own tag so the receiver doesn't re-divide a
              // USD value by the active display rate when settings != USD.
              value: { [valueKey]: totalFiatValue },
              currency: r.tokens.currency ?? 'usd',
            },
          );
        }
      } catch {
        if (isLatestRequest()) {
          setScopedActiveTokenListState({
            isRefreshing: false,
            initialized: true,
          });
          showFetchTokenListErrorToast();
        }
      } finally {
        if (isLatestRequest()) {
          setIsLpTokenSwitchLoading(false);
        }
      }
    } else if (showActiveAccountTokenList) {
      setIsLpTokenSwitchLoading(false);
    }
  }, [
    activeAccountId,
    activeAccountTokenSelectorViewSWRKey,
    activeNetworkId,
    accountId,
    applyScopedTokenSelectorSnapshot,
    indexedAccountId,
    isSelectorAllNetworks,
    mergeDeriveAddressData,
    networkId,
    showActiveAccountTokenList,
    showLpTokensOnly,
    showFetchTokenListErrorToast,
    tokenSelectorFilterParams,
    useSelectorFilteredTokenList,
  ]);

  // When opened from home for the same owner, seed the selector from the home
  // ViewModel snapshot instead of waiting for the full selector fetch.
  useEffect(() => {
    if (
      effectiveShowActiveAccountTokenList ||
      selectorFloorSeededRef.current ||
      selectorLiveLandedRef.current ||
      !accountId ||
      !networkId
    ) {
      return;
    }
    const snapshot = homeTokenListSnapshot;
    if (
      snapshot.tokens.length === 0 ||
      snapshot.accountId !== accountId ||
      snapshot.networkId !== networkId
    ) {
      return;
    }
    selectorFloorSeededRef.current = true;
    void (async () => {
      try {
        const [frames, localAggregateTokenListMap] = await Promise.all([
          backgroundApiProxy.serviceTokenViewModel.getTokenListFrames({
            ownerKey: snapshot.ownerKey,
          }),
          backgroundApiProxy.serviceToken.getLocalAggregateTokenListMap({
            accountId,
            networkId,
          }),
        ]);
        if (
          selectorLiveLandedRef.current ||
          latestSelectorTokenListRequestContextRef.current.accountId !==
            accountId ||
          latestSelectorTokenListRequestContextRef.current.networkId !==
            networkId
        ) {
          return;
        }
        const riskyTokenKeys = new Set(
          frames.riskyTokens.map((token) => token.$key),
        );
        const floorSnapshot = buildNormalTokenSelectorViewSnapshot({
          tokenList: {
            tokens: snapshot.tokens.filter(
              (token) => !riskyTokenKeys.has(token.$key),
            ),
            smallBalanceTokens: [],
          },
          tokenListMap: snapshot.map,
          aggregateTokenListMap:
            frames.structure?.ownedAggregateTokenListMap ??
            localAggregateTokenListMap ??
            {},
          aggregateTokenFiatMap: snapshot.map,
        });
        applyNormalTokenSelectorSnapshot(floorSnapshot);
        writeNormalTokenSelectorViewSnapshot({
          key: normalTokenSelectorViewSWRKey,
          snapshot: floorSnapshot,
        });
      } catch (e) {
        console.error(e);
      }
    })();
  }, [
    homeTokenListSnapshot,
    accountId,
    networkId,
    effectiveShowActiveAccountTokenList,
    applyNormalTokenSelectorSnapshot,
    normalTokenSelectorViewSWRKey,
  ]);

  // PR-3 selector self-fetch: on the NORMAL selector path (not the
  // active-account / LP-dapp branch, which already self-fetches into
  // `scopedActiveTokenList*`), fetch the displayable wallet token list + fiat
  // map (same `token-selector` flag/path the active-account branch uses) and
  // the scoped owned-aggregate map. These feed TokenListView via props so the
  // selector no longer reads the home tokenList atoms.
  usePromiseResult(async () => {
    if (effectiveShowActiveAccountTokenList) {
      // Active-account / LP-dapp branch uses `scopedActiveTokenList*`; the
      // normal selector self-fetch is inactive here. Mark initialized so the
      // skeleton gate (which is also guarded by `!showActiveAccountTokenList`)
      // never holds on a stale value.
      setSelectorInitialized(true);
      return;
    }
    if (!accountId || !networkId) {
      if (!restoreCachedNormalTokenSelectorSnapshot()) {
        setSelectorTokenList({ tokens: [], smallBalanceTokens: [] });
        setSelectorTokenListMap({});
        setSelectorAggregateTokenListMap({});
        setSelectorAggregateTokenFiatMap({});
        setSelectorInitialized(true);
      }
      return;
    }

    const requestContext: ISelectorTokenListRequestContext = {
      accountId,
      networkId,
      indexedAccountId: indexedAccountId ?? '',
      activeAccountId: activeAccountId ?? '',
      activeNetworkId: activeNetworkId ?? '',
      isSelectorAllNetworks: !!isSelectorAllNetworks,
      mergeDeriveAddressData,
      showLpTokensOnly,
      useSelectorFilteredTokenList,
      showActiveAccountTokenList,
    };
    const isLatestRequest = () =>
      isSameSelectorTokenListRequestContext(
        latestSelectorTokenListRequestContextRef.current,
        requestContext,
      );

    if (!isLatestRequest()) {
      return;
    }

    const hasRestoredSnapshot = restoreCachedNormalTokenSelectorSnapshot();
    if (!hasRestoredSnapshot && !selectorFloorSeededRef.current) {
      // Reset to `false` while fetching a new owner with no view snapshot so
      // TokenListView skeletons instead of showing the previous owner's rows.
      setSelectorTokenList({ tokens: [], smallBalanceTokens: [] });
      setSelectorTokenListMap({});
      setSelectorAggregateTokenListMap({});
      setSelectorAggregateTokenFiatMap({});
      setSelectorInitialized(false);
    }

    try {
      const [fanOut, localAggregateTokenListMap, aggregateTokenRawData] =
        await Promise.all([
          isSelectorAllNetworks
            ? fetchFilteredTokenSelectorTokens({
                accountId,
                networkId,
                indexedAccountId,
                isAllNetworks: true,
                mergeDeriveAddressData,
                onlyBackendIndexedNetworks: false,
                tokenSelectorFilterParams,
              })
            : fetchTokenSelectorAccountTokens({
                accountId,
                networkId,
                indexedAccountId,
                ...tokenSelectorFilterParams,
              }).then((r) => ({ responses: [r], expectedResponseCount: 1 })),
          backgroundApiProxy.serviceToken.getLocalAggregateTokenListMap({
            accountId,
            networkId,
          }),
          isSelectorAllNetworks
            ? backgroundApiProxy.simpleDb.aggregateToken.getRawData()
            : Promise.resolve(undefined),
        ]);

      if (!isLatestRequest()) {
        return;
      }

      const { responses, expectedResponseCount } = fanOut;
      const isIncompleteAllNetworksFanOut =
        isSelectorAllNetworks && responses.length < expectedResponseCount;

      if (
        isIncompleteAllNetworksFanOut &&
        (selectorFloorSeededRef.current || hasRestoredSnapshot)
      ) {
        selectorFloorSeededRef.current = false;
        return;
      }

      const merged = buildSelectorTokenListFromResponses({
        responses,
        aggregateTokenConfigMapRawData:
          aggregateTokenRawData?.aggregateTokenConfigMap,
      });
      const aggregateTokenListMap =
        isSelectorAllNetworks &&
        Object.keys(merged.aggregateTokenListMap).length > 0
          ? merged.aggregateTokenListMap
          : (localAggregateTokenListMap ?? {});
      const snapshot = buildNormalTokenSelectorViewSnapshot({
        tokenList: {
          tokens: merged.tokens,
          smallBalanceTokens: merged.smallBalanceTokens,
        },
        tokenListMap: {
          ...merged.tokenListMap,
          ...merged.aggregateTokenFiatMap,
        },
        aggregateTokenListMap,
        aggregateTokenFiatMap: merged.aggregateTokenFiatMap,
      });
      applyNormalTokenSelectorSnapshot(snapshot);
      if (!isIncompleteAllNetworksFanOut) {
        writeNormalTokenSelectorViewSnapshot({
          key: normalTokenSelectorViewSWRKey,
          snapshot,
        });
        selectorLiveLandedRef.current = true;
      }
    } catch (e) {
      if (e instanceof CanceledError) {
        console.log('token selector fetchAccountTokens canceled');
      } else {
        console.error(e);
        if (isLatestRequest()) {
          showFetchTokenListErrorToast();
        }
      }
      if (isLatestRequest()) {
        void restoreCachedNormalTokenSelectorSnapshot();
      }
    } finally {
      if (isLatestRequest()) {
        setSelectorInitialized(true);
      }
    }
  }, [
    activeAccountId,
    activeNetworkId,
    accountId,
    effectiveShowActiveAccountTokenList,
    indexedAccountId,
    isSelectorAllNetworks,
    mergeDeriveAddressData,
    networkId,
    normalTokenSelectorViewSWRKey,
    applyNormalTokenSelectorSnapshot,
    restoreCachedNormalTokenSelectorSnapshot,
    showActiveAccountTokenList,
    showFetchTokenListErrorToast,
    showLpTokensOnly,
    tokenSelectorFilterParams,
    useSelectorFilteredTokenList,
  ]);

  // Backend stage of the two-stage search debounce (see
  // debounceUpdateSearchKey). Scheduled on every live-key change, so editing
  // back to the previous keywords within the wait still re-runs the request;
  // use-debounce invokes the latest callback, so the closure never goes stale.
  const debounceSearchTokensBySearchKey = useDebouncedCallback(
    (keywords: string) => {
      void searchTokensBySearchKey(keywords);
    },
    800,
  );
  // Key the backend stage was last scheduled for. The effect below also
  // re-runs when a scope gate or the filter context flips (`network` /
  // `account` resolving, the LP toggle); those are not keystrokes and must
  // not sit out the typing debounce — the pre-split effect fired at once.
  const scheduledSearchKeyRef = useRef('');

  useEffect(() => {
    if (searchAll && searchKey && searchKey.length >= SEARCH_KEY_MIN_LENGTH) {
      // The list re-filters on the live key right away: drop results that
      // belong to another query and show the trailing loader until the
      // request for this key lands. Without this, a slower response for an
      // intermediate query ("usd" while editing "usdt" into "sol") used to
      // land after the input had moved on and show the wrong list until the
      // next debounce fired (OK-61484).
      setSearchTokenList((prev) =>
        resolveSearchTokenListForKeywords({
          prev,
          keywords: searchKey,
          filterContext: tokenSelectorSearchFilterContext,
        }),
      );
      setSearchTokenState((prev) =>
        prev.isSearching ? prev : { isSearching: true },
      );
      if (scheduledSearchKeyRef.current === searchKey) {
        debounceSearchTokensBySearchKey.cancel();
        void searchTokensBySearchKey(searchKey);
      } else {
        scheduledSearchKeyRef.current = searchKey;
        debounceSearchTokensBySearchKey(searchKey);
      }
    } else {
      scheduledSearchKeyRef.current = '';
      debounceSearchTokensBySearchKey.cancel();
      latestSearchRequestContextRef.current = '';
      setSearchTokenState({ isSearching: false });
      setSearchTokenList({
        tokens: [],
        searchKey: '',
        filterContext: tokenSelectorSearchFilterContext,
      });
      void backgroundApiProxy.serviceToken.abortSearchTokens();
    }
  }, [
    debounceSearchTokensBySearchKey,
    searchAll,
    searchKey,
    // Identity changes when the scope gates flip (e.g. `network` resolves
    // after the first keystrokes); re-run so the request carries the right
    // scope, as the pre-split effect did.
    searchTokensBySearchKey,
    tokenSelectorSearchFilterContext,
  ]);

  return (
    <Page
      lazyLoad
      safeAreaEnabled={false}
      onClose={clearSearchKey}
      onUnmounted={clearSearchKey}
    >
      <Page.Header
        title={
          title ??
          intl.formatMessage({
            id: ETranslations.global_select_crypto,
          })
        }
        headerSearchBarOptions={headerSearchBarOptions}
        headerRight={headerRight}
        headerRightNoGlass
      />
      <Page.Body>
        <TokenListView
          testID={AssetSelectorTestIDs.tokenSelectorList}
          tokenItemTestIDPrefix={
            AssetSelectorTestIDs.tokenSelectorItemTestIDPrefix
          }
          accountId={accountId}
          networkId={networkId}
          indexedAccountId={indexedAccountId}
          showActiveAccountTokenList={effectiveShowActiveAccountTokenList}
          scopedActiveAccountTokenList={scopedActiveTokenList}
          scopedActiveAccountTokenListState={scopedActiveTokenListState}
          scopedActiveAccountTokenListMap={scopedActiveTokenListMap}
          tokenSelectorTokenList={selectorTokenList}
          tokenSelectorTokenListMap={selectorTokenListMap}
          tokenSelectorAggregateTokenListMap={selectorAggregateTokenListMap}
          tokenSelectorAggregateTokenFiatMap={selectorAggregateTokenFiatMap}
          tokenSelectorInitialized={selectorInitialized}
          onPressToken={handleTokenOnPress}
          isAllNetworks={isSelectorAllNetworks}
          withNetwork={isSelectorAllNetworks}
          searchAll={searchAll}
          footerTipText={footerTipText}
          isTokenSelector
          tokenSelectorSearchKey={searchKey}
          tokenSelectorSearchTokenState={searchTokenState}
          tokenSelectorSearchTokenList={searchTokenList}
          crossNetworkSearchEnabled={crossNetworkSearchEnabled}
          onSearchTokensRetry={retrySearchTokens}
          browseEmptyTitle={browseEmptyTitle}
          allAggregateTokenMap={allAggregateTokenMap}
          hideZeroBalanceTokens={effectiveHideZeroBalanceTokens}
          hideDeFiMarkedTokens={
            showTokenSelectorFilter ? !showLpTokensOnly : undefined
          }
          keepDefaultZeroBalanceTokens={keepDefaultZeroBalanceTokens}
          showNetworkIcon={isSelectorAllNetworks}
          exchangeFilter={exchangeFilter}
          hideBalanceAndValue={hideBalanceAndValue}
          emptyProps={{
            mt: '18%',
          }}
        />
      </Page.Body>
    </Page>
  );
}

export default function TokenSelectorModal() {
  const route =
    useRoute<
      RouteProp<IAssetSelectorParamList, EAssetSelectorRoutes.TokenSelector>
    >();

  const { accountId } = route.params;

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[num]}
    >
      <HomeTokenListProviderMirrorWrapper accountId={accountId}>
        <TokenSelector />
      </HomeTokenListProviderMirrorWrapper>
    </AccountSelectorProviderMirror>
  );
}
