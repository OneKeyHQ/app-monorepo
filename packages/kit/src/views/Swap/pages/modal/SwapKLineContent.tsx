import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  NumberSizeableText,
  Page,
  SegmentControl,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  type ITradingViewNativeDataState,
  type ITradingViewNativeIntervalChangeData,
  type ITradingViewNativePriceUpdateData,
  type ITradingViewNativeSource,
  TradingViewNative,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ProviderJotaiContextMarketV2 } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import {
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IMarketPerpsInfo,
  IMarketTokenDetail,
  IMarketTokenDetailWebsocket,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';
import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';

import { SwapTestIDs } from '../../testIDs';
import { SwapProviderMirror } from '../SwapProviderMirror';

import {
  type ISwapKLineChartPrice,
  getNormalizedSwapKLinePercent,
  getNormalizedSwapKLinePrice,
  getSwapKLineDisplayPrice,
  normalizeSwapKLineChartUpdateTimestamp,
} from './swapKLinePriceUtils';
import {
  fetchSwapKLineTokenAddressesStableStatus,
  getResolvableDefaultSwapKLineSide,
  getSwapKLineStableTokenKey,
  getSwapKLineStableTokenStatusFromMap,
  haveSameSwapKLineTokenSymbol,
  isKnownSwapKLineUnsupportedToken,
} from './swapKLineTokenUtils';
import {
  type ISwapKLineTokenMarketInfoRequestResult,
  type ISwapKLineTokenMarketInfoSuccess,
  getSwapKLineTradingViewNativeSource,
  getSwapKLineTradingViewNativeSourceKey,
  isSwapKLineIdentityRequestPending,
  isSwapKLineStockToken,
  resolveSwapKLineTokenMarketInfo,
} from './swapKLineTradingViewNativeUtils';

const SWAP_KLINE_DEFAULT_PERIOD = '60';
const SWAP_KLINE_TOKEN_DETAIL_POLLING_INTERVAL = 6000;

type ISwapKLineWalletMarketInfo = {
  coinGeckoId?: string;
  priceChange24hPercent?: string;
};

type ISwapKLineWalletMarketInfoResult = {
  isLoading: boolean;
  walletMarketInfo?: ISwapKLineWalletMarketInfo;
};

type ISwapKLineWalletMarketInfoRequestResult =
  | {
      status: 'success';
      tokenInfo?: IFetchTokenDetailItem;
      tokenKey: string;
    }
  | {
      status: 'error';
      tokenKey: string;
    };

type ISwapKLineTokenMarketInfoResult = {
  isLoading: boolean;
  perpsInfo?: IMarketPerpsInfo;
  tokenMarketDetail?: IMarketTokenDetail;
  updatedAt?: number;
  websocketConfig?: IMarketTokenDetailWebsocket;
};

type ISwapKLineTokenUsdFallbackPriceResult = {
  tokenUsdFallbackPrice?: string;
  updatedAt?: number;
};

function getSwapKLineTokenKey(token?: ISwapToken) {
  if (!token?.networkId) {
    return '';
  }
  const contractAddress = token.contractAddress?.trim();
  const normalizedContractAddress = contractAddress?.startsWith('0x')
    ? contractAddress.toLowerCase()
    : (contractAddress ?? '');

  return `${token.networkId}:${normalizedContractAddress}:${
    token.isNative ? 'native' : 'contract'
  }`;
}

function useSwapKLineTokenMarketInfo(
  token?: ISwapToken,
  enabled = true,
): ISwapKLineTokenMarketInfoResult {
  const tokenAddress = token?.contractAddress?.trim() ?? '';
  const networkId = token?.networkId ?? '';
  const tokenKey = getSwapKLineTokenKey(token);
  const lastGoodResultsRef = useRef(
    new Map<string, ISwapKLineTokenMarketInfoSuccess>(),
  );
  const { result } = usePromiseResult<
    ISwapKLineTokenMarketInfoRequestResult | undefined
  >(
    async () => {
      if (!enabled || !networkId) {
        return undefined;
      }
      try {
        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
            tokenAddress,
            networkId,
            {
              autoHandleError: false,
              skipConvertCurrency: true,
            },
          );
        return {
          status: 'success',
          perpsInfo: response?.data?.perpsInfo,
          tokenKey,
          tokenMarketDetail: response?.data?.token,
          updatedAt: Date.now(),
          websocketConfig: response?.data?.websocket,
        };
      } catch {
        return { status: 'error', tokenKey };
      }
    },
    [enabled, networkId, tokenAddress, tokenKey],
    {
      checkIsFocused: false,
      pollingInterval: enabled
        ? SWAP_KLINE_TOKEN_DETAIL_POLLING_INTERVAL
        : undefined,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  if (result?.status === 'success') {
    lastGoodResultsRef.current.set(result.tokenKey, result);
  }
  const lastGoodResult = lastGoodResultsRef.current.get(tokenKey);
  return useMemo(() => {
    return resolveSwapKLineTokenMarketInfo({
      enabled,
      lastGoodResult,
      networkId,
      result,
      tokenKey,
    });
  }, [enabled, lastGoodResult, networkId, result, tokenKey]);
}

function useSwapKLineTokenUsdFallbackPrice(
  token?: ISwapToken,
  enabled = true,
): ISwapKLineTokenUsdFallbackPriceResult {
  const tokenAddress = token?.contractAddress?.trim() ?? '';
  const networkId = token?.networkId ?? '';
  const tokenKey = getSwapKLineTokenKey(token);
  const { result } = usePromiseResult<
    | {
        tokenKey: string;
        tokenUsdFallbackPrice?: string;
        updatedAt: number;
      }
    | undefined
  >(
    async () => {
      if (!enabled || !networkId) {
        return undefined;
      }

      const [tokenDetail] =
        (await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId,
          contractAddress: tokenAddress,
          currency: 'usd',
        })) ?? [];
      return {
        tokenKey,
        tokenUsdFallbackPrice: tokenDetail?.price,
        updatedAt: Date.now(),
      };
    },
    [enabled, networkId, tokenAddress, tokenKey],
    {
      checkIsFocused: false,
      pollingInterval: enabled
        ? SWAP_KLINE_TOKEN_DETAIL_POLLING_INTERVAL
        : undefined,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      undefinedResultIfError: true,
    },
  );

  return useMemo(() => {
    if (!enabled || !result || result.tokenKey !== tokenKey) {
      return {};
    }

    return {
      tokenUsdFallbackPrice: result.tokenUsdFallbackPrice,
      updatedAt: result.updatedAt,
    };
  }, [enabled, result, tokenKey]);
}

function buildSwapKLineWalletMarketInfo(
  tokenInfo?: IFetchTokenDetailItem,
): ISwapKLineWalletMarketInfo | undefined {
  const coinGeckoId = tokenInfo?.info?.coingeckoId?.trim();
  const priceChange24hPercent = getNormalizedSwapKLinePercent(
    tokenInfo?.price24h,
  );

  if (!coinGeckoId && !priceChange24hPercent) {
    return undefined;
  }

  return {
    coinGeckoId,
    priceChange24hPercent,
  };
}

function useSwapKLineWalletMarketInfo(
  token?: ISwapToken,
): ISwapKLineWalletMarketInfoResult {
  const tokenAddress = token?.contractAddress ?? '';
  const networkId = token?.networkId ?? '';
  const tokenKey = getSwapKLineTokenKey(token);
  const { result } = usePromiseResult<
    ISwapKLineWalletMarketInfoRequestResult | undefined
  >(
    async () => {
      if (!networkId) {
        return undefined;
      }
      try {
        const tokenInfo =
          await backgroundApiProxy.serviceToken.fetchTokenInfoOnly({
            networkId,
            tokenAddress,
          });
        return { status: 'success', tokenInfo, tokenKey };
      } catch {
        return { status: 'error', tokenKey };
      }
    },
    [networkId, tokenAddress, tokenKey],
    {
      checkIsFocused: false,
    },
  );

  return useMemo(() => {
    const currentResult = result?.tokenKey === tokenKey ? result : undefined;
    return {
      isLoading: isSwapKLineIdentityRequestPending({
        enabled: true,
        networkId,
        requestTokenKey: currentResult?.tokenKey,
        tokenKey,
      }),
      walletMarketInfo:
        currentResult?.status === 'success'
          ? buildSwapKLineWalletMarketInfo(currentResult.tokenInfo)
          : undefined,
    };
  }, [networkId, result, tokenKey]);
}

function useSwapKLineNetworkName(networkId?: string) {
  const { result } = usePromiseResult<string | undefined>(
    async () => {
      if (!networkId) {
        return undefined;
      }
      const network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId,
      });
      return network?.name || network?.shortname || network?.symbol;
    },
    [networkId],
    {
      checkIsFocused: false,
      undefinedResultIfError: true,
      undefinedResultIfReRun: true,
    },
  );

  return result;
}

function useSwapKLineStableTokenChecks({
  fromToken,
  toToken,
}: {
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  const fromStableTokenKey = getSwapKLineStableTokenKey(fromToken);
  const toStableTokenKey = getSwapKLineStableTokenKey(toToken);
  const fromStableTokenIdentity = useMemo(
    () =>
      fromStableTokenKey
        ? {
            networkId: fromToken?.networkId,
            contractAddress: fromToken?.contractAddress,
            isNative: fromToken?.isNative,
          }
        : undefined,
    [
      fromStableTokenKey,
      fromToken?.contractAddress,
      fromToken?.isNative,
      fromToken?.networkId,
    ],
  );
  const toStableTokenIdentity = useMemo(
    () =>
      toStableTokenKey
        ? {
            networkId: toToken?.networkId,
            contractAddress: toToken?.contractAddress,
            isNative: toToken?.isNative,
          }
        : undefined,
    [
      toStableTokenKey,
      toToken?.contractAddress,
      toToken?.isNative,
      toToken?.networkId,
    ],
  );
  const { result, isLoading } = usePromiseResult<
    | {
        fromTokenIsStable: boolean;
        toTokenIsStable: boolean;
      }
    | undefined
  >(
    async () => {
      const stableStatusMap = await fetchSwapKLineTokenAddressesStableStatus([
        fromStableTokenIdentity,
        toStableTokenIdentity,
      ]);
      return {
        fromTokenIsStable: getSwapKLineStableTokenStatusFromMap({
          stableStatusMap,
          stableTokenKey: fromStableTokenKey,
        }),
        toTokenIsStable: getSwapKLineStableTokenStatusFromMap({
          stableStatusMap,
          stableTokenKey: toStableTokenKey,
        }),
      };
    },
    [
      fromStableTokenIdentity,
      fromStableTokenKey,
      toStableTokenIdentity,
      toStableTokenKey,
    ],
    {
      checkIsFocused: false,
      watchLoading: true,
      undefinedResultIfError: true,
      undefinedResultIfReRun: true,
    },
  );

  return {
    stableTokenChecks: result,
    isLoading: Boolean(
      (fromToken || toToken) && result === undefined && isLoading !== false,
    ),
  };
}

function SwapKLineTokenSwitch({
  selectedSide,
  onChange,
  fromToken,
  toToken,
  compact,
}: {
  selectedSide: ESwapDirectionType;
  onChange: (side: ESwapDirectionType) => void;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  compact?: boolean;
}) {
  const tokensHaveSameSymbol = haveSameSwapKLineTokenSymbol({
    fromToken,
    toToken,
  });
  const tokenSize = compact ? 'xxs' : 'xs';
  const labelSize = compact ? '$bodySmMedium' : '$bodyMdMedium';
  const labelGap = compact ? '$1' : '$1.5';
  const labelMaxWidth = compact ? '$20' : '$24';
  const options = useMemo(
    () =>
      [
        fromToken
          ? {
              label: (
                <XStack ai="center" gap={labelGap} maxWidth={labelMaxWidth}>
                  <Token
                    size={tokenSize}
                    tokenImageUri={fromToken.logoURI}
                    networkId={fromToken.networkId}
                    showNetworkIcon
                  />
                  <SizableText
                    size={labelSize}
                    numberOfLines={1}
                    color={
                      selectedSide === ESwapDirectionType.FROM
                        ? '$text'
                        : '$textSubdued'
                    }
                  >
                    {fromToken.symbol}
                  </SizableText>
                </XStack>
              ),
              value: ESwapDirectionType.FROM,
            }
          : undefined,
        toToken
          ? {
              label: (
                <XStack ai="center" gap={labelGap} maxWidth={labelMaxWidth}>
                  <Token
                    size={tokenSize}
                    tokenImageUri={toToken.logoURI}
                    networkId={toToken.networkId}
                    showNetworkIcon
                  />
                  <SizableText
                    size={labelSize}
                    numberOfLines={1}
                    color={
                      selectedSide === ESwapDirectionType.TO
                        ? '$text'
                        : '$textSubdued'
                    }
                  >
                    {toToken.symbol}
                  </SizableText>
                </XStack>
              ),
              value: ESwapDirectionType.TO,
            }
          : undefined,
      ].filter(Boolean),
    [
      fromToken,
      labelGap,
      labelMaxWidth,
      labelSize,
      selectedSide,
      toToken,
      tokenSize,
    ],
  );

  const handleChange = useCallback(
    (value: string | number) => {
      onChange(value as ESwapDirectionType);
    },
    [onChange],
  );

  if (tokensHaveSameSymbol || options.length <= 1) {
    return null;
  }

  return (
    <SegmentControl
      value={selectedSide}
      options={options}
      onChange={handleChange}
      slotBackgroundColor="$neutral3"
      activeBackgroundColor="$bg"
      borderRadius="$full"
      p="$0.5"
      h="auto"
      segmentControlItemStyleProps={{
        py: compact ? '$1' : '$1.5',
        px: compact ? '$2' : '$3',
        borderRadius: '$full',
        '$platform-web': {
          boxShadow: 'none',
        },
      }}
    />
  );
}

type ISwapKLineContentSpacingProps = Pick<
  ComponentProps<typeof YStack>,
  'gap' | 'pb' | 'pt' | 'px'
>;

type ISwapKLineContentState = {
  displayPrice?: string;
  fromToken?: ISwapToken;
  handleChartDataStateChange: (data: ITradingViewNativeDataState) => void;
  handleChartIntervalChange: (
    data: ITradingViewNativeIntervalChangeData,
  ) => void;
  handleChartPriceUpdate: (data: ITradingViewNativePriceUpdateData) => void;
  handleSelectedSideChange: (side: ESwapDirectionType) => void;
  isResolvingChartSource: boolean;
  isResolvingSelectedToken: boolean;
  resolvedSelectedSide?: ESwapDirectionType;
  selectedToken?: ISwapToken;
  toToken?: ISwapToken;
  tokenMarketDetail?: IMarketTokenDetail;
  tokenUsdFallbackPrice?: string;
  tradingViewNativeSource?: ITradingViewNativeSource;
  walletMarketInfo?: ISwapKLineWalletMarketInfo;
};

function useSwapKLineContentState(): ISwapKLineContentState {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const { stableTokenChecks, isLoading: isStableTokenCheckLoading } =
    useSwapKLineStableTokenChecks({ fromToken, toToken });
  const defaultSide = useMemo(
    () =>
      getResolvableDefaultSwapKLineSide({
        fromToken,
        fromTokenIsStable: stableTokenChecks?.fromTokenIsStable,
        isStableTokenCheckLoading,
        toToken,
        toTokenIsStable: stableTokenChecks?.toTokenIsStable,
      }),
    [fromToken, isStableTokenCheckLoading, stableTokenChecks, toToken],
  );
  const [selectedSide, setSelectedSide] = useState<ESwapDirectionType>();
  const [chartPrice, setChartPrice] = useState<ISwapKLineChartPrice>();
  const hasTrackedOpenRef = useRef(false);
  const lastKLineUserPeriodRef = useRef(SWAP_KLINE_DEFAULT_PERIOD);
  const reportedKLineLoadErrorKeysRef = useRef(new Set<string>());

  const resolvedSelectedSide = useMemo(() => {
    if (haveSameSwapKLineTokenSymbol({ fromToken, toToken })) {
      return defaultSide;
    }
    if (selectedSide) {
      const selectedToken =
        selectedSide === ESwapDirectionType.FROM ? fromToken : toToken;
      if (selectedToken) {
        return selectedSide;
      }
    }

    return defaultSide;
  }, [defaultSide, fromToken, selectedSide, toToken]);

  const selectedToken = useMemo(() => {
    if (!resolvedSelectedSide) {
      return undefined;
    }
    return resolvedSelectedSide === ESwapDirectionType.FROM
      ? fromToken
      : toToken;
  }, [fromToken, resolvedSelectedSide, toToken]);
  const selectedTokenKey = getSwapKLineTokenKey(selectedToken);
  const { isLoading: isWalletMarketInfoLoading, walletMarketInfo } =
    useSwapKLineWalletMarketInfo(selectedToken);
  const {
    isLoading: isTokenMarketInfoLoading,
    perpsInfo,
    tokenMarketDetail,
    updatedAt: tokenMarketDetailUpdatedAt,
    websocketConfig,
  } = useSwapKLineTokenMarketInfo(selectedToken);
  const preferCoinGeckoKLineData = isSwapKLineStockToken({
    token: selectedToken,
    tokenMarketDetail,
  });
  const shouldForceEmptyKLineData =
    isKnownSwapKLineUnsupportedToken(selectedToken);
  const tradingViewNativeSource = useMemo(
    () =>
      isTokenMarketInfoLoading ||
      (preferCoinGeckoKLineData && isWalletMarketInfoLoading) ||
      shouldForceEmptyKLineData
        ? undefined
        : getSwapKLineTradingViewNativeSource({
            coinGeckoId: walletMarketInfo?.coinGeckoId,
            perpsInfo,
            preferCoinGecko: preferCoinGeckoKLineData,
            token: selectedToken,
            websocketConfig,
          }),
    [
      isTokenMarketInfoLoading,
      isWalletMarketInfoLoading,
      perpsInfo,
      preferCoinGeckoKLineData,
      selectedToken,
      shouldForceEmptyKLineData,
      walletMarketInfo?.coinGeckoId,
      websocketConfig,
    ],
  );
  const tradingViewNativeSourceKey = getSwapKLineTradingViewNativeSourceKey(
    tradingViewNativeSource,
  );
  const { tokenUsdFallbackPrice, updatedAt: tokenUsdFallbackPriceUpdatedAt } =
    useSwapKLineTokenUsdFallbackPrice(
      selectedToken,
      !getNormalizedSwapKLinePrice(tokenMarketDetail?.price),
    );
  const displayPrice = getSwapKLineDisplayPrice({
    tokenMarketDetail,
    tokenMarketDetailUpdatedAt,
    tokenUsdFallbackPrice,
    tokenUsdFallbackPriceUpdatedAt,
    chartPrice,
    chartSourceKey: tradingViewNativeSourceKey,
    chartTokenKey: selectedTokenKey,
  });
  const isResolvingSelectedToken = Boolean(
    !selectedToken && (fromToken || toToken) && isStableTokenCheckLoading,
  );
  const isResolvingChartSource = Boolean(
    selectedToken &&
    (isTokenMarketInfoLoading ||
      (preferCoinGeckoKLineData && isWalletMarketInfoLoading)) &&
    !shouldForceEmptyKLineData,
  );

  useEffect(() => {
    setChartPrice((prev) =>
      prev?.tokenKey === selectedTokenKey &&
      prev.sourceKey === tradingViewNativeSourceKey
        ? prev
        : undefined,
    );
    lastKLineUserPeriodRef.current = SWAP_KLINE_DEFAULT_PERIOD;
    reportedKLineLoadErrorKeysRef.current.clear();
  }, [selectedTokenKey, tradingViewNativeSourceKey]);

  const handleChartPriceUpdate = useCallback(
    (data: ITradingViewNativePriceUpdateData) => {
      if (!selectedTokenKey) {
        return;
      }

      const price = getNormalizedSwapKLinePrice(data.price);
      if (!price) {
        return;
      }

      setChartPrice({
        source: data.source,
        sourceKey: tradingViewNativeSourceKey,
        tokenKey: selectedTokenKey,
        price,
        receivedAt: normalizeSwapKLineChartUpdateTimestamp(
          data.receivedAt,
          Date.now(),
        ),
        updatedAt: normalizeSwapKLineChartUpdateTimestamp(
          data.timestamp,
          Date.now(),
        ),
      });
    },
    [selectedTokenKey, tradingViewNativeSourceKey],
  );

  const trackKLineOpenOnce = useCallback(
    (initialPeriod: string) => {
      if (
        hasTrackedOpenRef.current ||
        !selectedToken ||
        !resolvedSelectedSide
      ) {
        return;
      }

      hasTrackedOpenRef.current = true;
      defaultLogger.swap.swapKline.swapKlineOpen({
        defaultSide: resolvedSelectedSide,
        tokenSymbol: selectedToken.symbol,
        network: selectedToken.networkId,
        fromTokenSymbol: fromToken?.symbol,
        toTokenSymbol: toToken?.symbol,
        initialPeriod,
        fallbackTriggered: 'no',
      });
    },
    [fromToken?.symbol, resolvedSelectedSide, selectedToken, toToken?.symbol],
  );

  const handleChartDataStateChange = useCallback(
    (data: ITradingViewNativeDataState) => {
      if (!selectedToken) {
        return;
      }

      const period = lastKLineUserPeriodRef.current;
      if (data.lastUpdatedAt) {
        trackKLineOpenOnce(period);
      }
      if (data.status !== 'error') {
        return;
      }

      trackKLineOpenOnce(period);
      const errorKey = `${selectedTokenKey}:${period}`;
      if (reportedKLineLoadErrorKeysRef.current.has(errorKey)) {
        return;
      }
      reportedKLineLoadErrorKeysRef.current.add(errorKey);
      defaultLogger.swap.swapKline.swapKlineLoadError({
        status: 'failed',
        tokenSymbol: selectedToken.symbol,
        network: selectedToken.networkId,
        period,
        message: data.error instanceof Error ? data.error.message : undefined,
      });
    },
    [selectedToken, selectedTokenKey, trackKLineOpenOnce],
  );

  const handleChartIntervalChange = useCallback(
    (data: ITradingViewNativeIntervalChangeData) => {
      if (!selectedToken) {
        return;
      }
      lastKLineUserPeriodRef.current = data.toInterval;
      defaultLogger.swap.swapKline.swapKlinePeriodChange({
        fromPeriod: data.fromInterval,
        toPeriod: data.toInterval,
        tokenSymbol: selectedToken.symbol,
      });
    },
    [selectedToken],
  );

  const handleSelectedSideChange = useCallback(
    (side: ESwapDirectionType) => {
      if (side === resolvedSelectedSide) {
        return;
      }

      const nextToken = side === ESwapDirectionType.FROM ? fromToken : toToken;
      if (nextToken) {
        defaultLogger.swap.swapKline.swapKlineTokenSwitch({
          fromSide: resolvedSelectedSide ?? side,
          toSide: side,
          tokenSymbol: nextToken.symbol,
          network: nextToken.networkId,
        });
      }
      setSelectedSide(side);
    },
    [fromToken, resolvedSelectedSide, toToken],
  );

  return useMemo(
    () => ({
      fromToken,
      toToken,
      selectedToken,
      walletMarketInfo,
      tradingViewNativeSource,
      isResolvingChartSource,
      isResolvingSelectedToken,
      resolvedSelectedSide,
      tokenMarketDetail,
      displayPrice,
      tokenUsdFallbackPrice,
      handleChartDataStateChange,
      handleChartIntervalChange,
      handleChartPriceUpdate,
      handleSelectedSideChange,
    }),
    [
      displayPrice,
      fromToken,
      handleChartDataStateChange,
      handleChartIntervalChange,
      handleChartPriceUpdate,
      handleSelectedSideChange,
      isResolvingChartSource,
      isResolvingSelectedToken,
      resolvedSelectedSide,
      selectedToken,
      toToken,
      tokenMarketDetail,
      tokenUsdFallbackPrice,
      tradingViewNativeSource,
      walletMarketInfo,
    ],
  );
}

function SwapKLineHeaderRight({
  state,
  compact,
}: {
  state: ISwapKLineContentState;
  compact?: boolean;
}) {
  if (!state.selectedToken || !state.resolvedSelectedSide) {
    return null;
  }

  return (
    <SwapKLineTokenSwitch
      selectedSide={state.resolvedSelectedSide}
      onChange={state.handleSelectedSideChange}
      fromToken={state.fromToken}
      toToken={state.toToken}
      compact={compact}
    />
  );
}

function SwapKLineTokenPriceInfo({
  tokenMarketDetail,
  walletMarketInfo,
  displayPrice,
  fallbackUsdPrice,
  compact,
}: {
  tokenMarketDetail?: IMarketTokenDetail;
  walletMarketInfo?: ISwapKLineWalletMarketInfo;
  displayPrice?: string;
  fallbackUsdPrice?: string;
  compact?: boolean;
}) {
  const price =
    getNormalizedSwapKLinePrice(displayPrice) ??
    getNormalizedSwapKLinePrice(tokenMarketDetail?.price) ??
    getNormalizedSwapKLinePrice(fallbackUsdPrice);
  const priceChange =
    getNormalizedSwapKLinePercent(tokenMarketDetail?.priceChange24hPercent) ??
    walletMarketInfo?.priceChange24hPercent;

  return (
    <YStack
      ai="flex-end"
      gap={compact ? '$0' : '$0.5'}
      minWidth={compact ? '$24' : '$14'}
      maxWidth={compact ? '$30' : '$28'}
    >
      {price ? (
        <NumberSizeableText
          size={compact ? '$bodyMdMedium' : '$bodyLgMedium'}
          formatter="price"
          formatterOptions={{ currency: '$' }}
          numberOfLines={1}
          adjustsFontSizeToFit
          testID={`${SwapTestIDs.kLineChart}-price`}
        >
          {price}
        </NumberSizeableText>
      ) : (
        <SizableText
          size={compact ? '$bodyMdMedium' : '$bodyLgMedium'}
          color="$textSubdued"
          numberOfLines={1}
          testID={`${SwapTestIDs.kLineChart}-price`}
        >
          --
        </SizableText>
      )}
      {priceChange ? (
        <PriceChangePercentage
          size={compact ? '$bodyXsMedium' : '$bodySmMedium'}
          numberOfLines={1}
        >
          {priceChange}
        </PriceChangePercentage>
      ) : (
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          numberOfLines={1}
        >
          --
        </SizableText>
      )}
    </YStack>
  );
}

function SwapKLineTokenInfoRow({
  token,
  tokenMarketDetail,
  walletMarketInfo,
  displayPrice,
  fallbackUsdPrice,
  headerRight,
  compact,
}: {
  token: ISwapToken;
  tokenMarketDetail?: IMarketTokenDetail;
  walletMarketInfo?: ISwapKLineWalletMarketInfo;
  displayPrice?: string;
  fallbackUsdPrice?: string;
  headerRight?: ReactNode;
  compact?: boolean;
}) {
  const networkName = useSwapKLineNetworkName(token.networkId);

  return (
    <XStack
      ai="center"
      jc="space-between"
      gap={compact ? '$2.5' : '$3'}
      minHeight={compact ? '$11' : '$10'}
      width="100%"
    >
      <XStack
        ai="center"
        gap={compact ? '$2.5' : '$3'}
        flex={compact ? 1 : undefined}
        flexShrink={1}
        minWidth={0}
      >
        <Token
          size={compact ? 'md' : 'lg'}
          tokenImageUri={token.logoURI}
          networkId={token.networkId}
          showNetworkIcon
        />
        <YStack
          minWidth={0}
          flex={compact ? 1 : undefined}
          maxWidth={compact ? undefined : '$28'}
          gap="$0.5"
        >
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {token.symbol}
          </SizableText>
          <Stack minHeight="$5">
            {networkName ? (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                numberOfLines={1}
              >
                {networkName}
              </SizableText>
            ) : null}
          </Stack>
        </YStack>
        <SwapKLineTokenPriceInfo
          tokenMarketDetail={tokenMarketDetail}
          walletMarketInfo={walletMarketInfo}
          displayPrice={displayPrice}
          fallbackUsdPrice={fallbackUsdPrice}
          compact={compact}
        />
      </XStack>
      {headerRight ? <Stack flexShrink={0}>{headerRight}</Stack> : null}
    </XStack>
  );
}

function SwapKLineTokenInfoRowSkeleton({
  compact,
  headerRight,
}: {
  compact?: boolean;
  headerRight?: ReactNode;
}) {
  return (
    <XStack
      ai="center"
      jc="space-between"
      gap={compact ? '$2.5' : '$3'}
      minHeight={compact ? '$11' : '$10'}
      width="100%"
    >
      <XStack
        ai="center"
        gap={compact ? '$2.5' : '$3'}
        flex={compact ? 1 : undefined}
        flexShrink={1}
        minWidth={0}
      >
        <Skeleton
          w={compact ? '$8' : '$10'}
          h={compact ? '$8' : '$10'}
          radius="round"
          flexShrink={0}
        />
        <YStack
          minWidth={0}
          flex={compact ? 1 : undefined}
          maxWidth={compact ? undefined : '$28'}
          gap="$0.5"
        >
          <Skeleton h="$6" w="$16" />
          <Skeleton h="$5" w="$24" />
        </YStack>
        <YStack
          ai="flex-end"
          gap={compact ? '$0' : '$0.5'}
          minWidth={compact ? '$24' : '$14'}
          maxWidth={compact ? '$30' : '$28'}
        >
          <Skeleton h={compact ? '$5' : '$6'} w="$16" />
          <Skeleton h="$4" w="$10" />
        </YStack>
      </XStack>
      {headerRight ? <Stack flexShrink={0}>{headerRight}</Stack> : null}
    </XStack>
  );
}

function SwapKLineResolvingTokenContent({
  chartMinHeight,
  compact,
  showHeaderRight,
  showSeparateChartDivider,
}: {
  chartMinHeight: number;
  compact?: boolean;
  showHeaderRight?: boolean;
  showSeparateChartDivider?: boolean;
}) {
  const headerRightSkeleton = showHeaderRight ? (
    <Skeleton h={compact ? '$7' : '$9'} w="$32" borderRadius="$full" />
  ) : undefined;
  const tokenInfoRowSkeleton = (
    <SwapKLineTokenInfoRowSkeleton
      compact={compact}
      headerRight={compact ? undefined : headerRightSkeleton}
    />
  );
  const tokenInfoSkeleton = compact ? (
    <YStack gap={headerRightSkeleton ? '$4' : undefined}>
      {headerRightSkeleton ? (
        <XStack jc="flex-end" width="100%">
          {headerRightSkeleton}
        </XStack>
      ) : null}
      {tokenInfoRowSkeleton}
    </YStack>
  ) : (
    tokenInfoRowSkeleton
  );
  const chartSectionSkeleton = (
    <YStack
      flex={1}
      minHeight={showSeparateChartDivider ? undefined : chartMinHeight}
    >
      <Stack h="$px" bg="$borderSubdued" />
      <YStack
        flex={1}
        minHeight={showSeparateChartDivider ? chartMinHeight : undefined}
        pt="$2"
      >
        <Skeleton flex={1} borderRadius="$2" />
      </YStack>
    </YStack>
  );

  return (
    <>
      {tokenInfoSkeleton}
      {chartSectionSkeleton}
    </>
  );
}

function SwapKLineContentBody({
  state,
  chartMinHeight = 360,
  gap = '$3',
  pb = '$5',
  pt = '$3',
  px = '$5',
  headerRight,
  separateChartDivider,
}: {
  state: ISwapKLineContentState;
  chartMinHeight?: number;
  headerRight?: ReactNode;
  separateChartDivider?: boolean;
} & ISwapKLineContentSpacingProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const selectedToken = state.selectedToken;
  const tradingViewNativeSource = state.tradingViewNativeSource;
  const tradingViewNativeSourceKey = getSwapKLineTradingViewNativeSourceKey(
    tradingViewNativeSource,
  );
  const showSeparateChartDivider = separateChartDivider && gtMd;
  const showHeaderRight = Boolean(
    headerRight &&
    state.fromToken &&
    state.toToken &&
    !haveSameSwapKLineTokenSymbol({
      fromToken: state.fromToken,
      toToken: state.toToken,
    }),
  );

  let tokenInfoContent: ReactNode = null;
  if (selectedToken) {
    const tokenInfoRow = (
      <SwapKLineTokenInfoRow
        token={selectedToken}
        tokenMarketDetail={state.tokenMarketDetail}
        walletMarketInfo={state.walletMarketInfo}
        displayPrice={state.displayPrice}
        fallbackUsdPrice={state.tokenUsdFallbackPrice}
        headerRight={gtMd && showHeaderRight ? headerRight : undefined}
        compact={!gtMd}
      />
    );
    tokenInfoContent = gtMd ? (
      tokenInfoRow
    ) : (
      <YStack gap={showHeaderRight ? '$4' : undefined}>
        {showHeaderRight ? (
          <XStack jc="flex-end" width="100%">
            {headerRight}
          </XStack>
        ) : null}
        {tokenInfoRow}
      </YStack>
    );
  }

  let tradingViewNativeContent: ReactNode = null;
  if (state.isResolvingChartSource) {
    tradingViewNativeContent = <Skeleton flex={1} borderRadius="$2" />;
  } else if (tradingViewNativeSource) {
    tradingViewNativeContent = (
      <TradingViewNative
        key={tradingViewNativeSourceKey}
        testID={`${SwapTestIDs.kLineChart}-native`}
        source={tradingViewNativeSource}
        nativeControlsLayoutMode={gtMd ? 'desktop' : 'mobile'}
        onDataStateChange={state.handleChartDataStateChange}
        onIntervalChange={state.handleChartIntervalChange}
        onPriceUpdate={state.handleChartPriceUpdate}
      />
    );
  } else if (selectedToken) {
    tradingViewNativeContent = (
      <YStack
        flex={1}
        ai="center"
        jc="center"
        testID={`${SwapTestIDs.kLineChart}-empty`}
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </YStack>
    );
  }

  const chartContent = (
    <Stack
      flex={1}
      minHeight={chartMinHeight}
      overflow="hidden"
      bg="$bgApp"
      borderTopWidth={showSeparateChartDivider ? undefined : '$px'}
      borderTopColor={showSeparateChartDivider ? undefined : '$borderSubdued'}
      testID={SwapTestIDs.kLineChart}
    >
      {tradingViewNativeContent}
    </Stack>
  );
  const chartSectionContent = showSeparateChartDivider ? (
    <YStack flex={1}>
      <Stack h="$px" bg="$borderSubdued" />
      {chartContent}
    </YStack>
  ) : (
    chartContent
  );
  let content: ReactNode;
  if (selectedToken) {
    content = (
      <YStack flex={1} px={px} pt={pt} pb={pb} gap={gap}>
        {tokenInfoContent}
        {chartSectionContent}
      </YStack>
    );
  } else if (state.isResolvingSelectedToken) {
    content = (
      <YStack flex={1} px={px} pt={pt} pb={pb} gap={gap}>
        <SwapKLineResolvingTokenContent
          chartMinHeight={chartMinHeight}
          compact={!gtMd}
          showHeaderRight={showHeaderRight}
          showSeparateChartDivider={showSeparateChartDivider}
        />
      </YStack>
    );
  } else {
    content = (
      <YStack flex={1} ai="center" jc="center" px="$5">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.token_selector_title })}
        </SizableText>
      </YStack>
    );
  }

  return <>{content}</>;
}

function SwapKLineDialogContent() {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const state = useSwapKLineContentState();
  const headerRight = <SwapKLineHeaderRight state={state} compact={!gtMd} />;

  return (
    <>
      <Dialog.Header>
        <SizableText size="$headingXl" numberOfLines={1}>
          {intl.formatMessage({ id: ETranslations.market_chart })}
        </SizableText>
      </Dialog.Header>
      <YStack h={460}>
        <SwapKLineContentBody
          state={state}
          chartMinHeight={320}
          pt="$0"
          pb="$0"
          gap="$2.5"
          headerRight={headerRight}
        />
      </YStack>
    </>
  );
}

function SwapKLineModalContent() {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const state = useSwapKLineContentState();
  const headerRight = <SwapKLineHeaderRight state={state} compact={!gtMd} />;
  const desktopContentProps = gtMd
    ? ({
        chartMinHeight: 353,
        px: '$9',
        pb: '$8',
        gap: '$8',
        separateChartDivider: true,
      } as const)
    : undefined;

  return (
    <Page lazyLoad testID={SwapTestIDs.kLineModal}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.market_chart })}
      />
      <Page.Body>
        <SwapKLineContentBody
          state={state}
          headerRight={headerRight}
          {...desktopContentProps}
        />
      </Page.Body>
    </Page>
  );
}

export function SwapKLineContentWithProvider({
  storeName,
  variant = 'modal',
}: {
  storeName: EJotaiContextStoreNames;
  variant?: 'dialog' | 'modal';
}) {
  return (
    <SwapProviderMirror storeName={storeName}>
      <ProviderJotaiContextMarketV2>
        {variant === 'dialog' ? (
          <SwapKLineDialogContent />
        ) : (
          <SwapKLineModalContent />
        )}
      </ProviderJotaiContextMarketV2>
    </SwapProviderMirror>
  );
}
