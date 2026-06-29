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
  type ITradingViewDisabledFeature,
  type ITradingViewKLineDataReadyData,
  type ITradingViewKLineLoadErrorData,
  type ITradingViewKLinePeriodChangeData,
  type ITradingViewPriceUpdateData,
  TRADING_VIEW_DISABLED_FEATURES,
  TradingViewV2,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import type { ITradingViewV2KLineDataFallback } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2/hooks/useTradingViewV2';
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
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';
import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';

import { SwapTestIDs } from '../../testIDs';
import { SwapProviderMirror } from '../SwapProviderMirror';

import {
  convertSwapKLineWalletChartToKLineResponse,
  getSwapKLineWalletChartDays,
} from './swapKLineChartUtils';
import {
  type ISwapKLineChartRealtimePrice,
  getNormalizedSwapKLinePercent,
  getNormalizedSwapKLinePrice,
  getSwapKLineDisplayPrice,
  isSwapKLineChartPriceUpdateForToken,
  normalizeSwapKLineChartUpdateTimestamp,
} from './swapKLinePriceUtils';
import {
  fetchSwapKLineTokenAddressesStableStatus,
  getResolvableDefaultSwapKLineSide,
  getSwapKLineStableTokenKey,
  getSwapKLineStableTokenStatusFromMap,
  isKnownSwapKLineUnsupportedToken,
} from './swapKLineTokenUtils';

const SWAP_KLINE_TRADING_VIEW_STORAGE_NAMESPACE = 'swap-kline';
const SWAP_KLINE_DESKTOP_DISABLED_TRADING_VIEW_FEATURES = [
  TRADING_VIEW_DISABLED_FEATURES.TIME_SCALE,
  TRADING_VIEW_DISABLED_FEATURES.PRICE_SCALE,
  TRADING_VIEW_DISABLED_FEATURES.PRICE_MARKET_CAP_TOGGLE,
  TRADING_VIEW_DISABLED_FEATURES.INDICATORS,
  TRADING_VIEW_DISABLED_FEATURES.SETTINGS,
  TRADING_VIEW_DISABLED_FEATURES.CHART_TYPE,
  TRADING_VIEW_DISABLED_FEATURES.FULLSCREEN,
  TRADING_VIEW_DISABLED_FEATURES.LAYOUT_TOGGLE,
  TRADING_VIEW_DISABLED_FEATURES.DRAWING_TOOLBAR,
] as const satisfies readonly ITradingViewDisabledFeature[];

const SWAP_KLINE_MOBILE_DISABLED_TRADING_VIEW_FEATURES = [
  TRADING_VIEW_DISABLED_FEATURES.TIMEFRAME_SELECTOR,
  ...SWAP_KLINE_DESKTOP_DISABLED_TRADING_VIEW_FEATURES,
] as const satisfies readonly ITradingViewDisabledFeature[];
const SWAP_KLINE_TOKEN_DETAIL_POLLING_INTERVAL = 6000;

type ISwapKLineWalletMarketInfo = {
  coinGeckoId?: string;
  priceChange24hPercent?: string;
};

type ISwapKLineTokenMarketInfoResult = {
  tokenMarketDetail?: IMarketTokenDetail;
  updatedAt?: number;
};

type ISwapKLineTokenUsdFallbackPriceResult = {
  tokenUsdFallbackPrice?: string;
  updatedAt?: number;
};

function isSwapKLineStockToken({
  token,
  tokenMarketDetail,
}: {
  token?: ISwapToken;
  tokenMarketDetail?: IMarketTokenDetail;
}) {
  return Boolean(
    token?.isStock || tokenMarketDetail?.stock?.underlyingAssetTicker,
  );
}

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
  const { result } = usePromiseResult<
    | {
        tokenKey: string;
        tokenMarketDetail?: IMarketTokenDetail;
        updatedAt: number;
      }
    | undefined
  >(
    async () => {
      if (!enabled || !networkId) {
        return undefined;
      }
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
        tokenKey,
        tokenMarketDetail: response?.data?.token,
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
    if (!result || result.tokenKey !== tokenKey) {
      return {};
    }

    return {
      tokenMarketDetail: result.tokenMarketDetail,
      updatedAt: result.updatedAt,
    };
  }, [result, tokenKey]);
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
): ISwapKLineWalletMarketInfo | undefined {
  const tokenAddress = token?.contractAddress ?? '';
  const networkId = token?.networkId ?? '';
  const { result: tokenInfo } = usePromiseResult<
    IFetchTokenDetailItem | undefined
  >(
    async () => {
      if (!networkId) {
        return undefined;
      }

      const fetchedTokenInfo =
        await backgroundApiProxy.serviceToken.fetchTokenInfoOnly({
          networkId,
          tokenAddress,
        });
      return fetchedTokenInfo;
    },
    [networkId, tokenAddress],
    {
      checkIsFocused: false,
      undefinedResultIfError: true,
      undefinedResultIfReRun: true,
    },
  );

  return useMemo(() => buildSwapKLineWalletMarketInfo(tokenInfo), [tokenInfo]);
}

function useSwapKLineChartDataSource({
  token,
  coinGeckoId,
  useCoinGeckoOnly,
}: {
  token?: ISwapToken;
  coinGeckoId?: string;
  useCoinGeckoOnly?: boolean;
}) {
  const tokenKey = getSwapKLineTokenKey(token);
  const shouldUseCoinGeckoOnly = Boolean(useCoinGeckoOnly);
  const chartDataCacheRef = useRef(
    new Map<string, Promise<IMarketTokenChart>>(),
  );
  const [primaryUnavailableTokenKeys, setPrimaryUnavailableTokenKeys] =
    useState<ReadonlySet<string>>(() => new Set());
  const coinGeckoKLineDataSource = useMemo<
    ITradingViewV2KLineDataFallback | undefined
  >(() => {
    if (!coinGeckoId) {
      return undefined;
    }

    return async ({ timeFrom, timeTo }) => {
      const days = getSwapKLineWalletChartDays({ timeFrom, timeTo });
      const cacheKey = `${coinGeckoId}:${days}`;
      let chartDataPromise = chartDataCacheRef.current.get(cacheKey);
      if (!chartDataPromise) {
        chartDataPromise = backgroundApiProxy.serviceMarket.fetchTokenChart(
          coinGeckoId,
          days,
          { requestCurrency: 'usd' },
        );
        chartDataCacheRef.current.set(cacheKey, chartDataPromise);
      }

      const chartData = await chartDataPromise.catch((error) => {
        chartDataCacheRef.current.delete(cacheKey);
        throw error;
      });
      return convertSwapKLineWalletChartToKLineResponse({
        chartData,
        timeFrom,
        timeTo,
      });
    };
  }, [coinGeckoId]);
  const primaryKLineDataUnavailable = Boolean(
    (shouldUseCoinGeckoOnly && coinGeckoId) ||
    (tokenKey && primaryUnavailableTokenKeys.has(tokenKey)),
  );
  const isCoinGeckoDataSourcePending = Boolean(
    shouldUseCoinGeckoOnly && !coinGeckoId,
  );
  const chartDataSourceKey = shouldUseCoinGeckoOnly
    ? `coingecko:${coinGeckoId ?? 'pending'}`
    : `market:${tokenKey}`;
  const handlePrimaryKLineDataUnavailable = useCallback(() => {
    if (!tokenKey || shouldUseCoinGeckoOnly) {
      return;
    }

    setPrimaryUnavailableTokenKeys((prev) => {
      if (prev.has(tokenKey)) {
        return prev;
      }

      const next = new Set(prev);
      next.add(tokenKey);
      return next;
    });
  }, [shouldUseCoinGeckoOnly, tokenKey]);

  return useMemo(
    () => ({
      chartDataSourceKey,
      coinGeckoKLineDataSource,
      isCoinGeckoDataSourcePending,
      primaryKLineDataUnavailable,
      handlePrimaryKLineDataUnavailable,
    }),
    [
      chartDataSourceKey,
      coinGeckoKLineDataSource,
      handlePrimaryKLineDataUnavailable,
      isCoinGeckoDataSourcePending,
      primaryKLineDataUnavailable,
    ],
  );
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

  if (options.length <= 1) {
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
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  selectedToken?: ISwapToken;
  walletMarketInfo?: ISwapKLineWalletMarketInfo;
  chartDataSourceKey: string;
  coinGeckoKLineDataSource?: ITradingViewV2KLineDataFallback;
  primaryKLineDataUnavailable: boolean;
  resolvedSelectedSide?: ESwapDirectionType;
  shouldForceEmptyKLineData: boolean;
  isResolvingSelectedToken: boolean;
  tokenMarketDetail?: IMarketTokenDetail;
  displayPrice?: string;
  tokenUsdFallbackPrice?: string;
  handlePrimaryKLineDataUnavailable: () => void;
  handleChartPriceUpdate: (data: ITradingViewPriceUpdateData) => void;
  handleKLineDataReady: (data: ITradingViewKLineDataReadyData) => void;
  handleKLineLoadError: (data: ITradingViewKLineLoadErrorData) => void;
  handleKLinePeriodChange: (data: ITradingViewKLinePeriodChangeData) => void;
  handleSelectedSideChange: (side: ESwapDirectionType) => void;
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
  const [chartRealtimePrice, setChartRealtimePrice] =
    useState<ISwapKLineChartRealtimePrice>();
  const hasTrackedOpenRef = useRef(false);
  const lastKLineUserPeriodRef = useRef<string | undefined>(undefined);
  const reportedKLineLoadErrorKeysRef = useRef(new Set<string>());
  const kLineFallbackChainRef = useRef<string[]>([]);

  const resolvedSelectedSide = useMemo(() => {
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
  const walletMarketInfo = useSwapKLineWalletMarketInfo(selectedToken);
  const { tokenMarketDetail, updatedAt: tokenMarketDetailUpdatedAt } =
    useSwapKLineTokenMarketInfo(selectedToken);
  const preferCoinGeckoKLineData = isSwapKLineStockToken({
    token: selectedToken,
    tokenMarketDetail,
  });
  const {
    chartDataSourceKey,
    coinGeckoKLineDataSource,
    isCoinGeckoDataSourcePending,
    primaryKLineDataUnavailable,
    handlePrimaryKLineDataUnavailable,
  } = useSwapKLineChartDataSource({
    token: selectedToken,
    coinGeckoId: walletMarketInfo?.coinGeckoId,
    useCoinGeckoOnly: preferCoinGeckoKLineData,
  });
  const shouldForceEmptyKLineData =
    isKnownSwapKLineUnsupportedToken(selectedToken) ||
    isCoinGeckoDataSourcePending;
  const { tokenUsdFallbackPrice, updatedAt: tokenUsdFallbackPriceUpdatedAt } =
    useSwapKLineTokenUsdFallbackPrice(
      selectedToken,
      !getNormalizedSwapKLinePrice(tokenMarketDetail?.price),
    );
  const validChartRealtimePrice =
    chartRealtimePrice?.tokenKey === selectedTokenKey
      ? chartRealtimePrice
      : undefined;
  const displayPrice = getSwapKLineDisplayPrice({
    tokenMarketDetail,
    tokenMarketDetailUpdatedAt,
    tokenUsdFallbackPrice,
    tokenUsdFallbackPriceUpdatedAt,
    chartRealtimePrice: validChartRealtimePrice,
  });
  const isResolvingSelectedToken = Boolean(
    !selectedToken && (fromToken || toToken) && isStableTokenCheckLoading,
  );

  useEffect(() => {
    setChartRealtimePrice((prev) =>
      prev?.tokenKey === selectedTokenKey ? prev : undefined,
    );
    lastKLineUserPeriodRef.current = undefined;
    reportedKLineLoadErrorKeysRef.current.clear();
    kLineFallbackChainRef.current = [];
  }, [selectedTokenKey]);

  const handleChartPriceUpdate = useCallback(
    (data: ITradingViewPriceUpdateData) => {
      if (data.source === 'history' || !selectedToken || !selectedTokenKey) {
        return;
      }

      if (
        !isSwapKLineChartPriceUpdateForToken({
          data,
          token: selectedToken,
        })
      ) {
        return;
      }

      const price = getNormalizedSwapKLinePrice(data.price);
      if (!price) {
        return;
      }

      const receivedAt = Date.now();
      setChartRealtimePrice({
        tokenKey: selectedTokenKey,
        price,
        updatedAt: normalizeSwapKLineChartUpdateTimestamp(
          data.timestamp,
          receivedAt,
        ),
        receivedAt,
      });
    },
    [selectedToken, selectedTokenKey],
  );

  const trackKLineOpenOnce = useCallback(
    ({
      initialPeriod,
      fallbackTriggered,
    }: {
      initialPeriod?: string;
      fallbackTriggered?: 'yes' | 'no';
    }) => {
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
        fallbackTriggered,
      });
    },
    [fromToken?.symbol, resolvedSelectedSide, selectedToken, toToken?.symbol],
  );

  const handleKLineDataReady = useCallback(
    (data: ITradingViewKLineDataReadyData) => {
      lastKLineUserPeriodRef.current = data.period;
      trackKLineOpenOnce({
        initialPeriod: data.period,
        fallbackTriggered:
          kLineFallbackChainRef.current.length > 0 ? 'yes' : 'no',
      });
    },
    [trackKLineOpenOnce],
  );

  const handleKLineLoadError = useCallback(
    (data: ITradingViewKLineLoadErrorData) => {
      if (!selectedToken) {
        return;
      }
      const fallbackSegment = `${data.period}->${data.status}`;
      if (
        kLineFallbackChainRef.current[
          kLineFallbackChainRef.current.length - 1
        ] !== fallbackSegment
      ) {
        kLineFallbackChainRef.current.push(fallbackSegment);
      }
      trackKLineOpenOnce({
        initialPeriod: data.period,
        fallbackTriggered:
          data.status === 'empty' || kLineFallbackChainRef.current.length > 1
            ? 'yes'
            : 'no',
      });
      const errorKey = `${selectedTokenKey}:${data.period}`;
      if (reportedKLineLoadErrorKeysRef.current.has(errorKey)) {
        return;
      }
      reportedKLineLoadErrorKeysRef.current.add(errorKey);
      defaultLogger.swap.swapKline.swapKlineLoadError({
        status: data.status,
        tokenSymbol: selectedToken.symbol,
        network: selectedToken.networkId,
        period: data.period,
        message: data.status === 'failed' ? data.message : undefined,
      });
    },
    [selectedToken, selectedTokenKey, trackKLineOpenOnce],
  );

  const handleKLinePeriodChange = useCallback(
    (data: ITradingViewKLinePeriodChangeData) => {
      if (!selectedToken) {
        return;
      }
      const fromPeriod =
        data.fromPeriod === data.toPeriod
          ? (lastKLineUserPeriodRef.current ?? data.fromPeriod)
          : data.fromPeriod;
      if (fromPeriod === data.toPeriod) {
        return;
      }
      lastKLineUserPeriodRef.current = data.toPeriod;
      defaultLogger.swap.swapKline.swapKlinePeriodChange({
        fromPeriod,
        toPeriod: data.toPeriod,
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
      chartDataSourceKey,
      coinGeckoKLineDataSource,
      isResolvingSelectedToken,
      primaryKLineDataUnavailable,
      resolvedSelectedSide,
      shouldForceEmptyKLineData,
      tokenMarketDetail,
      displayPrice,
      tokenUsdFallbackPrice,
      handlePrimaryKLineDataUnavailable,
      handleChartPriceUpdate,
      handleKLineDataReady,
      handleKLineLoadError,
      handleKLinePeriodChange,
      handleSelectedSideChange,
    }),
    [
      displayPrice,
      fromToken,
      chartDataSourceKey,
      handleChartPriceUpdate,
      handleKLineDataReady,
      handleKLineLoadError,
      handleKLinePeriodChange,
      handlePrimaryKLineDataUnavailable,
      handleSelectedSideChange,
      isResolvingSelectedToken,
      coinGeckoKLineDataSource,
      primaryKLineDataUnavailable,
      resolvedSelectedSide,
      selectedToken,
      shouldForceEmptyKLineData,
      toToken,
      tokenMarketDetail,
      tokenUsdFallbackPrice,
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
          fontFamily="$monoMedium"
          formatter="price"
          formatterOptions={{ currency: '$' }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {price}
        </NumberSizeableText>
      ) : (
        <SizableText
          size={compact ? '$bodyMdMedium' : '$bodyLgMedium'}
          color="$textSubdued"
          fontFamily="$monoMedium"
          numberOfLines={1}
        >
          --
        </SizableText>
      )}
      {priceChange ? (
        <PriceChangePercentage
          size={compact ? '$bodyXsMedium' : '$bodySmMedium'}
          fontFamily="$monoMedium"
          numberOfLines={1}
        >
          {priceChange}
        </PriceChangePercentage>
      ) : (
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          fontFamily="$monoMedium"
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
          {networkName ? (
            <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
              {networkName}
            </SizableText>
          ) : null}
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

function SwapKLineResolvingTokenContent({
  chartMinHeight,
  showSeparateChartDivider,
}: {
  chartMinHeight: number;
  showSeparateChartDivider?: boolean;
}) {
  const chartSkeleton = (
    <Skeleton
      flex={1}
      minHeight={chartMinHeight}
      borderRadius="$2"
      borderTopWidth={showSeparateChartDivider ? undefined : '$px'}
      borderTopColor={showSeparateChartDivider ? undefined : '$borderSubdued'}
    />
  );
  const chartSectionSkeleton = showSeparateChartDivider ? (
    <YStack flex={1} gap="$5">
      <Stack h="$px" bg="$borderSubdued" />
      {chartSkeleton}
    </YStack>
  ) : (
    chartSkeleton
  );

  return (
    <>
      <XStack
        ai="center"
        jc="space-between"
        gap="$3"
        minHeight="$10"
        width="100%"
      >
        <XStack ai="center" gap="$3" flexShrink={1} minWidth={0}>
          <Skeleton w="$10" h="$10" radius="round" />
          <YStack gap="$1">
            <Skeleton h="$4" w="$16" />
            <Skeleton h="$3" w="$24" />
          </YStack>
        </XStack>
        <Skeleton h="$8" w="$32" borderRadius="$full" />
      </XStack>
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
  const chartNetworkId = selectedToken?.networkId ?? '';
  const chartTokenAddress = selectedToken?.contractAddress ?? '';
  const disabledTradingViewFeatures = gtMd
    ? SWAP_KLINE_DESKTOP_DISABLED_TRADING_VIEW_FEATURES
    : SWAP_KLINE_MOBILE_DISABLED_TRADING_VIEW_FEATURES;
  const showSeparateChartDivider = separateChartDivider && gtMd;

  let tokenInfoContent: ReactNode = null;
  if (selectedToken) {
    tokenInfoContent =
      !gtMd && headerRight ? (
        <YStack gap="$4">
          <XStack jc="flex-end" width="100%">
            {headerRight}
          </XStack>
          <SwapKLineTokenInfoRow
            token={selectedToken}
            tokenMarketDetail={state.tokenMarketDetail}
            walletMarketInfo={state.walletMarketInfo}
            displayPrice={state.displayPrice}
            fallbackUsdPrice={state.tokenUsdFallbackPrice}
            compact
          />
        </YStack>
      ) : (
        <SwapKLineTokenInfoRow
          token={selectedToken}
          tokenMarketDetail={state.tokenMarketDetail}
          walletMarketInfo={state.walletMarketInfo}
          displayPrice={state.displayPrice}
          fallbackUsdPrice={state.tokenUsdFallbackPrice}
          headerRight={headerRight}
        />
      );
  }

  const chartContent = (
    <Stack
      flex={1}
      minHeight={chartMinHeight}
      overflow="hidden"
      borderTopWidth={showSeparateChartDivider ? undefined : '$px'}
      borderTopColor={showSeparateChartDivider ? undefined : '$borderSubdued'}
    >
      <TradingViewV2
        key={`${chartNetworkId}:${chartTokenAddress}:${
          selectedToken?.symbol ?? ''
        }:${state.chartDataSourceKey}`}
        symbol={selectedToken?.symbol ?? ''}
        tokenAddress={chartTokenAddress}
        networkId={chartNetworkId}
        decimal={selectedToken?.decimals ?? 0}
        dataSource="polling"
        disabledFeatures={disabledTradingViewFeatures}
        storageNamespace={SWAP_KLINE_TRADING_VIEW_STORAGE_NAMESPACE}
        forceEmptyKLineData={state.shouldForceEmptyKLineData}
        emptyKLineDataOnError
        kLineDataFallback={state.coinGeckoKLineDataSource}
        primaryKLineDataUnavailable={state.primaryKLineDataUnavailable}
        onPrimaryKLineDataUnavailable={state.handlePrimaryKLineDataUnavailable}
        onPriceUpdate={state.handleChartPriceUpdate}
        onKLineDataReady={state.handleKLineDataReady}
        onKLineLoadError={state.handleKLineLoadError}
        onKLinePeriodChange={state.handleKLinePeriodChange}
        w="100%"
        h="100%"
      />
    </Stack>
  );
  const chartSectionContent = showSeparateChartDivider ? (
    <YStack flex={1} gap="$5">
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
