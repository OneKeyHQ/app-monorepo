import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  ActionList,
  Alert,
  Divider,
  Empty,
  ListView,
  Page,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  XStack,
  YStack,
  useClipboard,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { ITokenListItemProps } from '@onekeyhq/kit/src/components/TokenListItem';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';
import { TokenSelectorLpTokenSwitch } from '@onekeyhq/kit/src/components/TokenSelectorFilter';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import {
  useSwapActions,
  useSwapNetworksAtom,
  useSwapNetworksIncludeAllNetworkAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectTokenNetworkAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { StockSourceLogo } from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import {
  useSettingsPersistAtom,
  useTokenSelectorFilterPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import {
  SWAP_LP_TOKEN_FILTER_SERVER_SUPPORTED,
  isTokenSelectorDappTokenFilterSupportedNetwork,
} from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';
import {
  swapNetworksCommonCount,
  swapNetworksCommonCountMD,
  swapPopularTokens,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapDirectionType,
  ESwapSelectTokenSource,
  ESwapTabSwitchType,
  ETokenRiskLevel,
  type ISwapNetwork,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import useConfigurableChainSelector from '../../../ChainSelector/hooks/useChainSelector';
import NetworkToggleGroup from '../../components/SwapNetworkToggleGroup';
import SwapPopularTokenGroup from '../../components/SwapPopularTokenGroup';
import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { useSwapTokenList } from '../../hooks/useSwapTokens';
import {
  SWAP_STOCK_ANALYTICS_TOKEN_LIST_TYPE_STOCK,
  SWAP_STOCK_ANALYTICS_TOKEN_ROLE_STOCK,
  getSwapAnalyticsTokenListType,
  getSwapAnalyticsTokenRole,
} from '../../utils/swapStockAnalytics';
import { SwapProviderMirror } from '../SwapProviderMirror';

import {
  buildSwapStockMetadataKey,
  buildSwapStockSelectableNetworks,
  buildSwapTokenSelectorDisableNetworks,
  buildSwapTokenSelectorNetworkView,
  getSwapStockTokenDisplayName,
  isSwapStockMetadataPending,
  isSwapStockTokenSearchMatch,
  isSwapTokenSelectorFromNetworkBridgeOnly,
  normalizeSwapStockSelectableToken,
} from './SwapTokenSelectModal.utils';

import type { RouteProp } from '@react-navigation/core';
import type { FlatList } from 'react-native';

type ISwapTokenWithStock = ISwapToken & {
  stock?: IMarketStockInfo;
};

type IStockMetadataRequest = {
  tokenAddressEntries: [
    string,
    {
      contractAddress: string;
      chainId: string;
      isNative: boolean;
    },
  ][];
  tokenKey: string;
};

type IStockMetadataResult = {
  metadataMap: Record<string, IMarketStockInfo>;
  tokenKey: string;
};

const getRawSwapToken = (item: ISwapToken | IFuseResult<ISwapToken>) =>
  (item as IFuseResult<ISwapToken>).item
    ? (item as IFuseResult<ISwapToken>).item
    : (item as ISwapToken);

const EMPTY_SWAP_TOKEN_LIST: (ISwapToken | IFuseResult<ISwapToken>)[] = [];
const EMPTY_STOCK_METADATA_REQUEST: IStockMetadataRequest = {
  tokenAddressEntries: [],
  tokenKey: '',
};
const TOKEN_SELECTOR_LOADING_ROW_COUNT = 5;

function buildStockMetadataRequest({
  excludedTokenKeys,
  tokens,
}: {
  excludedTokenKeys?: ReadonlySet<string>;
  tokens: (ISwapToken | IFuseResult<ISwapToken>)[];
}): IStockMetadataRequest {
  const tokenAddressMap = new Map<
    string,
    IStockMetadataRequest['tokenAddressEntries'][number][1]
  >();
  for (const item of tokens) {
    const rawItem = getRawSwapToken(item);
    const key = buildSwapStockMetadataKey({
      contractAddress: rawItem.contractAddress,
      networkId: rawItem.networkId,
    });
    if (key && !excludedTokenKeys?.has(key) && !tokenAddressMap.has(key)) {
      tokenAddressMap.set(key, {
        chainId: rawItem.networkId,
        contractAddress: rawItem.contractAddress,
        isNative: rawItem.isNative ?? false,
      });
    }
  }
  const tokenAddressEntries = Array.from(tokenAddressMap.entries());
  return {
    tokenAddressEntries,
    tokenKey: tokenAddressEntries.map(([key]) => key).join(','),
  };
}

function useStockMetadata({
  enabled,
  requestLocale,
  requestSnapshot,
}: {
  enabled: boolean;
  requestLocale: string;
  requestSnapshot: IStockMetadataRequest;
}) {
  const requestRef = useRef<IStockMetadataRequest>(requestSnapshot);
  if (requestRef.current.tokenKey !== requestSnapshot.tokenKey) {
    requestRef.current = requestSnapshot;
  }
  const request = requestRef.current;
  const tokenKey = request.tokenKey;
  const { result, isLoading } = usePromiseResult<IStockMetadataResult>(
    async () => {
      if (!enabled || !tokenKey) {
        return {
          metadataMap: {},
          tokenKey,
        };
      }
      const response = await (async () => {
        try {
          return await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch(
            {
              requestLocale,
              tokenAddressList: request.tokenAddressEntries.map(
                ([, token]) => token,
              ),
            },
          );
        } catch {
          return { list: [] };
        }
      })();
      const metadataMap: Record<string, IMarketStockInfo> = {};
      response.list.forEach((token, index) => {
        const requestKey = request.tokenAddressEntries[index]?.[0];
        if (requestKey && token?.stock) {
          metadataMap[requestKey] = token.stock;
        }
      });
      return {
        metadataMap,
        tokenKey,
      };
    },
    [enabled, request, requestLocale, tokenKey],
    {
      initResult: {
        metadataMap: {},
        tokenKey: '',
      },
      watchLoading: enabled,
    },
  );

  return {
    metadataMap: result.metadataMap,
    pending: isSwapStockMetadataPending({
      isSwapStockSelectTarget: enabled,
      resolvedStockMetadataTokenKey: result.tokenKey,
      stockMetadataLoading: isLoading,
      stockMetadataTokenKey: tokenKey,
    }),
  };
}

function SwapTokenSelectListSkeletonItem() {
  return (
    <ListItem>
      <Skeleton w="$10" h="$10" radius="round" />
      <YStack>
        <YStack py="$1">
          <Skeleton h="$4" w="$32" />
        </YStack>
        <YStack py="$1">
          <Skeleton h="$3" w="$24" />
        </YStack>
      </YStack>
    </ListItem>
  );
}

function SwapTokenSelectListSkeleton() {
  return (
    <>
      {Array.from({ length: TOKEN_SELECTOR_LOADING_ROW_COUNT }).map(
        (_, index) => (
          <SwapTokenSelectListSkeletonItem
            key={`swap-token-select-skeleton-${index}`}
          />
        ),
      )}
    </>
  );
}

const SwapTokenSelectPage = ({
  autoSearch = false,
}: {
  autoSearch?: boolean;
}) => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapTokenSelect>
    >();
  const type = useMemo(
    () => route.params?.type ?? ESwapDirectionType.FROM,
    [route.params?.type],
  );
  const isSwapStockSelectTarget = route.params?.selectTarget === 'swapStock';
  const stockSelectDefaultNetworkId = isSwapStockSelectTarget
    ? route.params?.defaultNetworkId
    : undefined;
  const intl = useIntl();
  const [searchInputValue, setSearchInputValue] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const searchKeywordDebounce = useDebounce(searchKeyword, 500);
  // Reset to the default token list immediately when the input is cleared.
  const requestedSearchKeyword = searchKeyword
    ? searchKeywordDebounce
    : searchKeyword;
  const isSearchKeywordSettling = searchKeyword !== requestedSearchKeyword;
  const [rawSwapNetworks] = useSwapNetworksAtom();
  const [swapNetworksIncludeAllNetworkBase] =
    useSwapNetworksIncludeAllNetworkAtom();
  const swapNetworksIncludeAllNetwork = useMemo(() => {
    return buildSwapStockSelectableNetworks({
      isSwapStockSelectTarget,
      rawSwapNetworks,
      stockSelectDefaultNetworkId,
      swapNetworksIncludeAllNetworkBase,
    });
  }, [
    isSwapStockSelectTarget,
    rawSwapNetworks,
    stockSelectDefaultNetworkId,
    swapNetworksIncludeAllNetworkBase,
  ]);
  const swapAllSupportNetworks = swapNetworksIncludeAllNetwork;
  const [fromToken, setSwapSelectFromToken] = useSwapSelectFromTokenAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [toToken, setSwapSelectToToken] = useSwapSelectToTokenAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [tokenSelectorFilter, setTokenSelectorFilter] =
    useTokenSelectorFilterPersistAtom();
  const [currentSelectNetwork, setCurrentSelectNetwork] =
    useSwapSelectTokenNetworkAtom();
  const showLpTokenFilterSwitch = useMemo(() => {
    if (isSwapStockSelectTarget) {
      return false;
    }
    if (!SWAP_LP_TOKEN_FILTER_SERVER_SUPPORTED || !currentSelectNetwork) {
      return false;
    }

    return isTokenSelectorDappTokenFilterSupportedNetwork({
      network: {
        id: currentSelectNetwork.networkId,
        isAllNetworks: currentSelectNetwork.isAllNetworks,
        backendIndex: currentSelectNetwork.backendIndex,
      },
      isDeFiEnabled: currentSelectNetwork.isAllNetworks
        ? true
        : currentSelectNetwork.isDeFiEnabled,
    });
  }, [currentSelectNetwork, isSwapStockSelectTarget]);
  const showLpTokensOnly = showLpTokenFilterSwitch
    ? tokenSelectorFilter.swapShowLpTokensOnly
    : false;
  const requestLpToken = useMemo(() => {
    if (isSwapStockSelectTarget) {
      return false;
    }
    if (showLpTokenFilterSwitch) {
      return showLpTokensOnly;
    }
    return undefined;
  }, [isSwapStockSelectTarget, showLpTokenFilterSwitch, showLpTokensOnly]);
  const fromTokenRef = useRef<ISwapToken | undefined>(fromToken);
  const toTokenRef = useRef<ISwapToken | undefined>(toToken);
  const hasUserSelectedNetworkRef = useRef(false);
  if (fromTokenRef.current !== fromToken) {
    fromTokenRef.current = fromToken;
  }
  if (toTokenRef.current !== toToken) {
    toTokenRef.current = toToken;
  }
  const { selectFromTokenByUser, selectToTokenByUser, syncNetworksSort } =
    useSwapActions().current;
  const { updateSelectedAccountNetwork } = useAccountSelectorActions().current;
  const getSelectableDefaultNetwork = useCallback(
    (networkId?: string) => {
      const preferredNetwork = networkId
        ? swapNetworksIncludeAllNetwork.find(
            (item: ISwapNetwork) => item.networkId === networkId,
          )
        : undefined;

      if (preferredNetwork) {
        return preferredNetwork;
      }

      return (
        swapNetworksIncludeAllNetwork.find(
          (network) => network.isAllNetworks,
        ) ?? swapNetworksIncludeAllNetwork[0]
      );
    },
    [swapNetworksIncludeAllNetwork],
  );
  const isFromTokenNetworkBridgeOnly = useMemo(
    () =>
      isSwapTokenSelectorFromNetworkBridgeOnly({
        fromTokenNetworkId: fromToken?.networkId,
        swapNetworksIncludeAllNetwork,
      }),
    [fromToken?.networkId, swapNetworksIncludeAllNetwork],
  );
  const syncDefaultNetworkSelect = useCallback(() => {
    if (stockSelectDefaultNetworkId) {
      return getSelectableDefaultNetwork(stockSelectDefaultNetworkId);
    }
    if (type === ESwapDirectionType.FROM) {
      if (fromToken?.networkId) {
        return getSelectableDefaultNetwork(fromToken.networkId);
      }
      if (toToken?.networkId && swapTypeSwitch === ESwapTabSwitchType.SWAP) {
        return getSelectableDefaultNetwork(toToken.networkId);
      }
    } else {
      if (toToken?.networkId) {
        return getSelectableDefaultNetwork(toToken.networkId);
      }
      if (
        fromToken?.networkId &&
        (swapTypeSwitch === ESwapTabSwitchType.SWAP ||
          swapTypeSwitch === ESwapTabSwitchType.LIMIT)
      ) {
        if (
          swapTypeSwitch === ESwapTabSwitchType.SWAP &&
          isFromTokenNetworkBridgeOnly
        ) {
          return getSelectableDefaultNetwork();
        }
        return getSelectableDefaultNetwork(fromToken.networkId);
      }
    }
    return getSelectableDefaultNetwork();
  }, [
    fromToken?.networkId,
    getSelectableDefaultNetwork,
    isFromTokenNetworkBridgeOnly,
    stockSelectDefaultNetworkId,
    swapTypeSwitch,
    toToken?.networkId,
    type,
  ]);
  const listViewRef = useRef<FlatList>(null);
  const handleLpTokenFilterChange = useCallback(
    (value: boolean) => {
      setTokenSelectorFilter((prev) => ({
        ...prev,
        swapShowLpTokensOnly: value,
      }));
      listViewRef.current?.scrollToOffset({
        offset: 0,
        animated: false,
      });
    },
    [setTokenSelectorFilter],
  );

  useEffect(() => {
    if (hasUserSelectedNetworkRef.current) {
      return;
    }
    const nextNetwork = syncDefaultNetworkSelect();
    if (!nextNetwork) {
      return;
    }
    setCurrentSelectNetwork((prev) => {
      if (
        !prev ||
        prev.isAllNetworks ||
        prev.networkId === nextNetwork.networkId
      ) {
        return nextNetwork;
      }
      return prev;
    });
  }, [setCurrentSelectNetwork, syncDefaultNetworkSelect]);

  useEffect(() => {
    if (!currentSelectNetwork?.networkId) {
      return;
    }

    const latestNetwork = swapNetworksIncludeAllNetwork.find(
      (network) => network.networkId === currentSelectNetwork.networkId,
    );
    if (!latestNetwork || latestNetwork === currentSelectNetwork) {
      return;
    }

    setCurrentSelectNetwork((prev) => {
      if (!prev || prev.networkId !== latestNetwork.networkId) {
        return prev;
      }
      return latestNetwork;
    });
  }, [
    currentSelectNetwork,
    setCurrentSelectNetwork,
    swapNetworksIncludeAllNetwork,
  ]);

  useEffect(
    () => () => {
      setCurrentSelectNetwork(undefined);
    },
    [setCurrentSelectNetwork],
  );

  useEffect(() => {
    const accountNet =
      type === ESwapDirectionType.FROM
        ? swapFromAddressInfo.networkId
        : swapToAddressInfo.networkId;
    if (
      currentSelectNetwork?.networkId &&
      currentSelectNetwork?.networkId !== accountNet
    ) {
      void updateSelectedAccountNetwork({
        num: type === ESwapDirectionType.FROM ? 0 : 1,
        networkId: currentSelectNetwork?.networkId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSelectNetwork?.networkId]);

  const searchAnalyticsOverride = useMemo(
    () =>
      isSwapStockSelectTarget
        ? {
            tokenRole: SWAP_STOCK_ANALYTICS_TOKEN_ROLE_STOCK,
            tokenListType: SWAP_STOCK_ANALYTICS_TOKEN_LIST_TYPE_STOCK,
          }
        : undefined,
    [isSwapStockSelectTarget],
  );
  const { fetchLoading, currentTokens } = useSwapTokenList(
    type,
    currentSelectNetwork?.networkId,
    requestedSearchKeyword,
    swapTypeSwitch,
    requestLpToken,
    searchAnalyticsOverride,
    swapNetworksIncludeAllNetwork,
  );
  const stockSearchBaseNetworkId = currentSelectNetwork?.networkId;
  const stockSearchBaseTokensRef = useRef<{
    networkId?: string;
    tokens: (ISwapToken | IFuseResult<ISwapToken>)[];
  }>({
    tokens: [],
  });
  useEffect(() => {
    if (
      isSwapStockSelectTarget &&
      !requestedSearchKeyword &&
      currentTokens.length > 0
    ) {
      stockSearchBaseTokensRef.current = {
        networkId: stockSearchBaseNetworkId,
        tokens: currentTokens,
      };
    }
  }, [
    currentTokens,
    isSwapStockSelectTarget,
    requestedSearchKeyword,
    stockSearchBaseNetworkId,
  ]);
  const stockSearchBaseTokens =
    stockSearchBaseTokensRef.current.networkId === stockSearchBaseNetworkId
      ? stockSearchBaseTokensRef.current.tokens
      : EMPTY_SWAP_TOKEN_LIST;
  const stockBaseMetadataRequestSnapshot =
    useMemo<IStockMetadataRequest>(() => {
      if (!isSwapStockSelectTarget) {
        return EMPTY_STOCK_METADATA_REQUEST;
      }
      return buildStockMetadataRequest({
        tokens: requestedSearchKeyword ? stockSearchBaseTokens : currentTokens,
      });
    }, [
      currentTokens,
      isSwapStockSelectTarget,
      requestedSearchKeyword,
      stockSearchBaseTokens,
    ]);
  const stockBaseMetadataTokenKeys = useMemo(
    () =>
      new Set(
        stockBaseMetadataRequestSnapshot.tokenAddressEntries.map(
          ([key]) => key,
        ),
      ),
    [stockBaseMetadataRequestSnapshot],
  );
  const stockSearchMetadataRequestSnapshot =
    useMemo<IStockMetadataRequest>(() => {
      if (!isSwapStockSelectTarget || !requestedSearchKeyword) {
        return EMPTY_STOCK_METADATA_REQUEST;
      }
      return buildStockMetadataRequest({
        excludedTokenKeys: stockBaseMetadataTokenKeys,
        tokens: currentTokens,
      });
    }, [
      currentTokens,
      isSwapStockSelectTarget,
      requestedSearchKeyword,
      stockBaseMetadataTokenKeys,
    ]);
  const stockBaseMetadata = useStockMetadata({
    enabled: isSwapStockSelectTarget,
    requestLocale: settingsPersistAtom.locale,
    requestSnapshot: stockBaseMetadataRequestSnapshot,
  });
  const stockSearchMetadata = useStockMetadata({
    enabled: isSwapStockSelectTarget && Boolean(requestedSearchKeyword),
    requestLocale: settingsPersistAtom.locale,
    requestSnapshot: stockSearchMetadataRequestSnapshot,
  });
  const stockMetadataMap = useMemo(
    () => ({
      ...stockBaseMetadata.metadataMap,
      ...stockSearchMetadata.metadataMap,
    }),
    [stockBaseMetadata.metadataMap, stockSearchMetadata.metadataMap],
  );
  const stockMetadataPending =
    stockBaseMetadata.pending || stockSearchMetadata.pending;
  const stockSearchFallbackTokens = useMemo(() => {
    if (
      !isSwapStockSelectTarget ||
      !requestedSearchKeyword ||
      currentTokens.length > 0 ||
      stockMetadataPending
    ) {
      return EMPTY_SWAP_TOKEN_LIST;
    }

    return stockSearchBaseTokens.filter((item) => {
      const rawItem = getRawSwapToken(item);
      const stock =
        rawItem.contractAddress && rawItem.networkId
          ? stockMetadataMap?.[
              buildSwapStockMetadataKey({
                contractAddress: rawItem.contractAddress,
                networkId: rawItem.networkId,
              })
            ]
          : undefined;
      return isSwapStockTokenSearchMatch({
        keyword: requestedSearchKeyword,
        stock,
        token: rawItem,
      });
    });
  }, [
    currentTokens.length,
    isSwapStockSelectTarget,
    requestedSearchKeyword,
    stockMetadataMap,
    stockMetadataPending,
    stockSearchBaseTokens,
  ]);
  const tokensForDisplay =
    stockSearchFallbackTokens.length > 0
      ? stockSearchFallbackTokens
      : currentTokens;
  const displayTokens = stockMetadataPending
    ? EMPTY_SWAP_TOKEN_LIST
    : tokensForDisplay;
  const tokenListLoading =
    fetchLoading || stockMetadataPending || isSearchKeywordSettling;
  const alertIndex = useMemo(
    () =>
      displayTokens.findIndex((item) => {
        const rawItem = getRawSwapToken(item);
        return !rawItem.price || new BigNumber(rawItem.price).isZero();
      }),
    [displayTokens],
  );

  const checkRiskToken = useCallback(
    async (token: ISwapToken) => {
      const isRiskLevel =
        !token.isPopular &&
        (!token.price ||
          new BigNumber(token.price).isZero() ||
          token.riskLevel === ETokenRiskLevel.SPAM ||
          token.riskLevel === ETokenRiskLevel.MALICIOUS);
      if (isRiskLevel) {
        if (!settingsPersistAtom.tokenRiskReminder) return false;
        const checkConfirmRiskToken =
          await backgroundApiProxy.serviceSetting.checkConfirmedRiskToken(
            `${token.networkId}_${token.contractAddress}`,
          );
        return !checkConfirmRiskToken;
      }
      return isRiskLevel;
    },
    [settingsPersistAtom.tokenRiskReminder],
  );

  const selectTokenHandler = useCallback(
    (token: ISwapToken) => {
      if (isSwapStockSelectTarget) {
        appEventBus.emit(EAppEventBusNames.SwapStockTokenSelected, token);
        navigation.popStack();
        return;
      }
      navigation.popStack();
      if (type === ESwapDirectionType.FROM) {
        if (
          equalTokenNoCaseSensitive({
            token1: toTokenRef.current,
            token2: token,
          })
        ) {
          setSwapSelectToToken(fromTokenRef.current);
        }
        void selectFromTokenByUser(token);
      } else {
        if (
          equalTokenNoCaseSensitive({
            token1: fromTokenRef.current,
            token2: token,
          })
        ) {
          setSwapSelectFromToken(toTokenRef.current);
        }
        void selectToTokenByUser(token);
      }
    },
    [
      navigation,
      selectFromTokenByUser,
      selectToTokenByUser,
      setSwapSelectFromToken,
      setSwapSelectToToken,
      isSwapStockSelectTarget,
      type,
    ],
  );

  const onSelectToken = useCallback(
    async (item: ISwapToken) => {
      // Scaled-UI (rebase) tokens: fail-closed with feedback — the silent
      // actions-level gate would otherwise make the tap feel dead. Copy is
      // the generic unsupported-token string pending product wording.
      if (tokenRebaseUtils.isScalingBalanceMultiplier(item.balanceMultiplier)) {
        Toast.message({
          title: intl.formatMessage({
            id: ETranslations.earn_unsupported_token,
          }),
        });
        return;
      }
      if (await checkRiskToken(item)) {
        navigation.push(EModalSwapRoutes.TokenRiskReminder, {
          storeName: route.params.storeName,
          token: item,
          onConfirm: () => {
            selectTokenHandler(item);
          },
        });
      } else {
        selectTokenHandler(item);
      }
      if (!isSwapStockSelectTarget) {
        defaultLogger.swap.selectToken.selectToken({
          selectFrom: item.isPopular
            ? ESwapSelectTokenSource.POPULAR_SELECT
            : ESwapSelectTokenSource.NORMAL_SELECT,
          tokenRole: getSwapAnalyticsTokenRole(type),
          tokenListType: getSwapAnalyticsTokenListType({
            swapType: swapTypeSwitch,
          }),
        });
      }
    },
    [
      checkRiskToken,
      intl,
      isSwapStockSelectTarget,
      navigation,
      route.params.storeName,
      selectTokenHandler,
      swapTypeSwitch,
      type,
    ],
  );

  const onSelectCurrentNetwork = useCallback(
    (network: ISwapNetwork) => {
      hasUserSelectedNetworkRef.current = true;
      setCurrentSelectNetwork(network);
      listViewRef.current?.scrollToOffset({
        offset: 0,
        animated: false,
      });
    },
    [setCurrentSelectNetwork],
  );

  const { md } = useMedia();
  const { copyText, getClipboard } = useClipboard();

  const handlePaste = useCallback(async () => {
    const text = await getClipboard();
    if (text) {
      const trimmedText = text.trim();
      setSearchInputValue(trimmedText);
      setSearchKeyword(trimmedText);
    }
  }, [getClipboard]);

  const disableNetworksOnClick = useCallback(() => {
    // STOCK keeps the legacy copy until stock-specific copy is defined
    let disabledNetworkTipId = ETranslations.swap_toast_bridge_tip;
    if (swapTypeSwitch === ESwapTabSwitchType.SWAP) {
      disabledNetworkTipId = ETranslations.trade_swap_network_only_cross;
    } else if (swapTypeSwitch === ESwapTabSwitchType.LIMIT) {
      disabledNetworkTipId = ETranslations.trade_limit_network_only_swap;
    }
    Toast.message({
      title: intl.formatMessage({
        id: disabledNetworkTipId,
      }),
    });
  }, [intl, swapTypeSwitch]);

  const disableNetworks = useMemo(() => {
    return buildSwapTokenSelectorDisableNetworks({
      type,
      swapTypeSwitch,
      fromToken,
      swapNetworksIncludeAllNetwork,
    });
  }, [fromToken, swapNetworksIncludeAllNetwork, swapTypeSwitch, type]);
  const renderItem = useCallback(
    ({
      item,
      index,
    }: {
      item: ISwapToken | IFuseResult<ISwapToken>;
      index: number;
    }) => {
      const rawItem = getRawSwapToken(item);
      const stock =
        isSwapStockSelectTarget && rawItem.contractAddress
          ? ((rawItem as ISwapTokenWithStock).stock ??
            stockMetadataMap?.[
              buildSwapStockMetadataKey({
                contractAddress: rawItem.contractAddress,
                networkId: rawItem.networkId,
              })
            ])
          : undefined;
      const displayItem: ISwapTokenWithStock =
        normalizeSwapStockSelectableToken({
          stock,
          token: rawItem,
        });
      const balanceBN = new BigNumber(rawItem.balanceParsed ?? 0);
      const fiatValueBN = new BigNumber(rawItem.fiatValue ?? 0);
      const contractAddressDisplay = md
        ? accountUtils.shortenAddress({
            address: rawItem.contractAddress,
          })
        : rawItem.contractAddress;

      let badgeText: string | undefined;
      if (rawItem.freeFeeObject && rawItem.freeFeeObject.tokenList) {
        const targetToken =
          type === ESwapDirectionType.FROM
            ? toTokenRef.current
            : fromTokenRef.current;
        if (targetToken) {
          const hasMatch = rawItem.freeFeeObject.tokenList.some((feeToken) =>
            equalTokenNoCaseSensitive({
              token1: targetToken,
              token2: {
                networkId: feeToken.networkId,
                contractAddress: feeToken.contractAddress,
              },
            }),
          );
          if (hasMatch) {
            badgeText = rawItem.freeFeeObject.tag;
          }
        }
      }

      const tokenItem: ITokenListItemProps = {
        isSearch: isSwapStockSelectTarget ? false : !!requestedSearchKeyword,
        tokenImageSrc: rawItem.logoURI,
        tokenName: isSwapStockSelectTarget
          ? getSwapStockTokenDisplayName({
              stock,
              tokenName: rawItem.name,
            })
          : rawItem.name,
        tokenSymbol: rawItem.symbol,
        networkImageSrc: rawItem.networkLogoURI,
        tokenSymbolAccessory:
          isSwapStockSelectTarget && stock?.sourceLogoUri ? (
            <StockSourceLogo stock={stock} />
          ) : undefined,
        tokenContrastAddress:
          requestedSearchKeyword && !isSwapStockSelectTarget
            ? contractAddressDisplay
            : undefined,
        balance: !balanceBN.isZero() ? rawItem.balanceParsed : undefined,
        valueProps:
          rawItem.fiatValue && !fiatValueBN.isZero()
            ? {
                value: rawItem.fiatValue,
                currency: settingsPersistAtom.currencyInfo.symbol,
              }
            : undefined,
        onPress: !disableNetworks.includes(rawItem.networkId)
          ? () => onSelectToken(displayItem)
          : () => disableNetworksOnClick(),
        disabled: disableNetworks.includes(rawItem.networkId),
        titleMatchStr: (item as IFuseResult<ISwapToken>).matches?.find(
          (v) => v.key === 'symbol',
        ),
        badgeText,
      };
      return (
        <>
          {alertIndex === index ? (
            <Stack pt="$3" pb="$2">
              <Alert
                fullBleed
                type="default"
                title={intl.formatMessage({
                  id: ETranslations.token_selector_unverified_token_warning,
                })}
                icon="InfoCircleOutline"
              />
            </Stack>
          ) : null}
          <TokenListItem
            {...tokenItem}
            moreComponent={
              <Stack alignSelf="center">
                <ActionList
                  title={tokenItem.tokenSymbol ?? ''}
                  disabled={rawItem.isNative}
                  renderTrigger={
                    <ListItem.IconButton
                      icon="DotVerSolid"
                      variant="tertiary"
                    />
                  }
                  items={[
                    {
                      icon: 'Copy3Outline',
                      label: intl.formatMessage({
                        id: ETranslations.global_copy_token_contract,
                      }),
                      onPress: () => {
                        copyText(rawItem.contractAddress);
                      },
                      disabled: rawItem.isNative,
                    },
                    {
                      icon: 'OpenOutline',
                      label: intl.formatMessage({
                        id: ETranslations.swap_token_selector_contract_info,
                      }),
                      onPress: async () => {
                        const url =
                          await backgroundApiProxy.serviceExplorer.buildExplorerUrl(
                            {
                              networkId: rawItem.networkId,
                              type: 'token',
                              param: rawItem.contractAddress,
                            },
                          );
                        openUrlExternal(url);
                      },
                      disabled: rawItem.isNative,
                    },
                  ]}
                />
              </Stack>
            }
          />
        </>
      );
    },
    [
      alertIndex,
      copyText,
      disableNetworks,
      intl,
      disableNetworksOnClick,
      md,
      onSelectToken,
      requestedSearchKeyword,
      settingsPersistAtom.currencyInfo.symbol,
      isSwapStockSelectTarget,
      stockMetadataMap,
      type,
    ],
  );

  const networkFilterData = useMemo(() => {
    return buildSwapTokenSelectorNetworkView({
      type,
      swapTypeSwitch,
      isSwapStockSelectTarget,
      fromToken,
      toToken,
      swapNetworksIncludeAllNetwork,
    });
  }, [
    fromToken,
    isSwapStockSelectTarget,
    swapNetworksIncludeAllNetwork,
    swapTypeSwitch,
    toToken,
    type,
  ]);
  const sameChainBadgeText = intl.formatMessage({
    id: ETranslations.trade_token_same_chain,
  });

  const openChainSelector = useConfigurableChainSelector();
  const { bottom } = useSafeAreaInsets();
  const currentNetworkPopularTokens = useMemo(() => {
    let popularTokens =
      swapPopularTokens[currentSelectNetwork?.networkId ?? ''] ?? [];
    if (swapTypeSwitch === ESwapTabSwitchType.LIMIT) {
      const wrappedToken = popularTokens.find((item) => item.isWrapped);
      if (wrappedToken) {
        popularTokens = [
          wrappedToken,
          ...popularTokens.filter((item) => !item.isWrapped),
        ];
      }
    }
    return popularTokens;
  }, [currentSelectNetwork?.networkId, swapTypeSwitch]);
  const shouldShowPopularTokens =
    !isSwapStockSelectTarget &&
    currentNetworkPopularTokens.length > 0 &&
    !requestedSearchKeyword;
  const tokenListEmptyComponent = useMemo(() => {
    if (tokenListLoading) {
      return <SwapTokenSelectListSkeleton />;
    }

    return (
      <Empty
        illustration="TwoBlocks"
        title={intl.formatMessage({
          id: ETranslations.global_no_results,
        })}
        description={intl.formatMessage({
          id: ETranslations.token_no_search_results_desc,
        })}
      />
    );
  }, [intl, tokenListLoading]);
  return (
    <Page lazyLoad={!platformEnv.isNativeIOS} safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.token_selector_title })}
        headerSearchBarOptions={{
          placeholder: intl.formatMessage({
            id: ETranslations.token_selector_search_placeholder,
          }),
          onChangeText: ({ nativeEvent }) => {
            setSearchInputValue(nativeEvent.text);
          },
          onSearchTextChange: (text) => {
            setSearchKeyword(text.trim());
          },
          ...(autoSearch ? { autoFocus: true } : {}),
          searchBarInputValue: searchInputValue,
          ...(searchKeyword?.length === 0 && !platformEnv.isExtension
            ? {
                addOns: [
                  {
                    iconName: 'ClipboardOutline',
                    onPress: handlePaste,
                  },
                ],
              }
            : {}),
        }}
      />
      <Page.Body>
        <XStack
          px="$5"
          pb="$2"
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
        >
          <XStack alignItems="center" flexShrink={1} h="$8" minWidth={0}>
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              pr="$2"
              lineHeight={32}
            >
              {intl.formatMessage({
                id: ETranslations.token_selector_network,
              })}
            </SizableText>
            <XStack alignItems="center" flexShrink={1} h="$8" minWidth={0}>
              <SizableText size="$bodyMd" numberOfLines={1} lineHeight={32}>
                {currentSelectNetwork?.isAllNetworks
                  ? intl.formatMessage({
                      id: ETranslations.global_all_networks,
                    })
                  : currentSelectNetwork?.name}
              </SizableText>
            </XStack>
          </XStack>
          {showLpTokenFilterSwitch ? (
            <TokenSelectorLpTokenSwitch
              value={showLpTokensOnly}
              onChange={handleLpTokenFilterChange}
              disabled={!SWAP_LP_TOKEN_FILTER_SERVER_SUPPORTED}
            />
          ) : null}
        </XStack>
        <NetworkToggleGroup
          onMoreNetwork={() => {
            openChainSelector({
              defaultNetworkId: currentSelectNetwork?.networkId,
              networkIds: [
                ...(networkFilterData.sameChainNetwork
                  ? [networkFilterData.sameChainNetwork]
                  : []),
                ...networkFilterData.networks,
              ]
                .filter((item) => !item.isAllNetworks)
                .map((item) => item.networkId),
              disableNetworkIds: disableNetworks,
              featuredNetwork: networkFilterData.sameChainNetwork
                ? {
                    networkId: networkFilterData.sameChainNetwork.networkId,
                    badgeText: sameChainBadgeText,
                    disabled: disableNetworks.includes(
                      networkFilterData.sameChainNetwork.networkId,
                    ),
                  }
                : undefined,
              grouped: false,
              onSelect: (network) => {
                if (!network) return;
                const findSwapNetwork = swapAllSupportNetworks.find(
                  (net) => net.networkId === network.id,
                );
                if (!findSwapNetwork) return;
                onSelectCurrentNetwork(findSwapNetwork);
                void syncNetworksSort(findSwapNetwork.networkId);
              },
            });
          }}
          networks={networkFilterData.networks}
          sameChainNetwork={networkFilterData.sameChainNetwork}
          sameChainBadgeText={sameChainBadgeText}
          maxVisibleNetworks={
            md
              ? swapNetworksCommonCountMD -
                (networkFilterData.sameChainNetwork ? 1 : 0)
              : swapNetworksCommonCount
          }
          selectedNetwork={currentSelectNetwork}
          disableNetworks={disableNetworks}
          onSelectNetwork={onSelectCurrentNetwork}
          onDisableNetworksClick={disableNetworksOnClick}
        />
        {shouldShowPopularTokens ? <Divider mt="$2" /> : null}
        <YStack flex={1}>
          <ListView
            useFlashList={platformEnv.isNative}
            ref={listViewRef}
            data={displayTokens}
            renderItem={renderItem}
            estimatedItemSize={60}
            ListHeaderComponent={
              shouldShowPopularTokens ? (
                <YStack px="$5" pt="$3" gap="$2">
                  <SizableText size="$bodyMd" color="$textSubdued" pr="$2">
                    {intl.formatMessage({
                      id: ETranslations.swap_token_selector_popular_token,
                    })}
                  </SizableText>
                  <SwapPopularTokenGroup
                    onSelectToken={onSelectToken}
                    tokens={currentNetworkPopularTokens}
                  />
                </YStack>
              ) : null
            }
            ListFooterComponent={<Stack h={bottom || '$2'} />}
            ListEmptyComponent={tokenListEmptyComponent}
          />
        </YStack>
      </Page.Body>
    </Page>
  );
};

const SwapTokenSelectPageWithProvider = () => {
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapTokenSelect>
    >();
  const { storeName, autoSearch = false } = route.params;
  return (
    <SwapProviderMirror storeName={storeName}>
      <SwapTokenSelectPage autoSearch={autoSearch} />
    </SwapProviderMirror>
  );
};
export default function SwapTokenSelectModal() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.swap,
      }}
      enabledNum={[0, 1]}
    >
      <SwapTokenSelectPageWithProvider />
    </AccountSelectorProviderMirror>
  );
}
