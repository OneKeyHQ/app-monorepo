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
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  type ITradingViewDisabledFeature,
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
  type ISwapKLineStableToken,
  getResolvableDefaultSwapKLineSide,
  isKnownSwapKLineUnsupportedToken,
} from './swapKLineTokenUtils';

const SWAP_KLINE_TRADING_VIEW_STORAGE_NAMESPACE = 'swap-kline';
const SWAP_KLINE_DESKTOP_DISABLED_TRADING_VIEW_FEATURES = [
  TRADING_VIEW_DISABLED_FEATURES.TIME_SCALE,
  TRADING_VIEW_DISABLED_FEATURES.PRICE_SCALE,
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

type ISwapKLineWalletMarketInfo = {
  coinGeckoId?: string;
  price?: string;
  priceChange24hPercent?: string;
};

function getSwapKLineTokenKey(token?: ISwapToken) {
  if (!token?.networkId) {
    return '';
  }

  return `${token.networkId}:${token.contractAddress ?? ''}`;
}

function getNormalizedValueText(value?: number | string | null) {
  const normalized = typeof value === 'number' ? String(value) : value?.trim();
  if (!normalized) {
    return undefined;
  }
  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }
  return normalized;
}

function getNormalizedPrice(value?: number | string | null) {
  const normalized = getNormalizedValueText(value);
  if (!normalized) {
    return undefined;
  }
  const numericValue = Number(normalized);
  if (numericValue === 0) {
    return undefined;
  }
  return normalized;
}

function getNormalizedPercent(value?: number | string | null) {
  return getNormalizedValueText(value);
}

function useSwapKLineTokenMarketInfo(token?: ISwapToken, enabled = true) {
  const tokenAddress = token?.contractAddress?.trim() ?? '';
  const networkId = token?.networkId ?? '';
  const { result } = usePromiseResult<IMarketTokenDetail | undefined>(
    async () => {
      if (!enabled || !networkId || !tokenAddress) {
        return undefined;
      }
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
          tokenAddress,
          networkId,
          {
            autoHandleError: false,
          },
        );
      return response?.data?.token;
    },
    [enabled, networkId, tokenAddress],
    {
      checkIsFocused: false,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      undefinedResultIfError: true,
      undefinedResultIfReRun: true,
    },
  );

  return result;
}

function buildSwapKLineWalletMarketInfo(
  tokenInfo?: IFetchTokenDetailItem,
): ISwapKLineWalletMarketInfo | undefined {
  const coinGeckoId = tokenInfo?.info?.coingeckoId?.trim();
  const price = getNormalizedPrice(tokenInfo?.price);
  const priceChange24hPercent = getNormalizedPercent(tokenInfo?.price24h);

  if (!coinGeckoId && !price && !priceChange24hPercent) {
    return undefined;
  }

  return {
    coinGeckoId,
    price,
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
}: {
  token?: ISwapToken;
  coinGeckoId?: string;
}) {
  const tokenKey = getSwapKLineTokenKey(token);
  const chartDataCacheRef = useRef(
    new Map<string, Promise<IMarketTokenChart>>(),
  );
  const [primaryUnavailableTokenKeys, setPrimaryUnavailableTokenKeys] =
    useState<ReadonlySet<string>>(() => new Set());
  const kLineDataFallback = useMemo<
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
    tokenKey && primaryUnavailableTokenKeys.has(tokenKey),
  );
  const handlePrimaryKLineDataUnavailable = useCallback(() => {
    if (!tokenKey) {
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
  }, [tokenKey]);

  return useMemo(
    () => ({
      kLineDataFallback,
      primaryKLineDataUnavailable,
      handlePrimaryKLineDataUnavailable,
    }),
    [
      handlePrimaryKLineDataUnavailable,
      kLineDataFallback,
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

function useSwapKLineStableTokens({
  fromToken,
  toToken,
}: {
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  const fromNetworkId = fromToken?.networkId ?? '';
  const toNetworkId = toToken?.networkId ?? '';
  const { result, isLoading } = usePromiseResult<ISwapKLineStableToken[]>(
    async () => {
      const networkIds = Array.from(
        new Set([fromNetworkId, toNetworkId].filter(Boolean)),
      );
      if (!networkIds.length) {
        return [];
      }

      const speedConfigs = await Promise.all(
        networkIds.map((networkId) =>
          backgroundApiProxy.serviceSwap.fetchSpeedSwapConfig({ networkId }),
        ),
      );
      return speedConfigs.flatMap((config) =>
        (config.speedConfig.defaultLimitTokens ?? []).map((token) => ({
          networkId: token.networkId,
          contractAddress: token.contractAddress,
        })),
      );
    },
    [fromNetworkId, toNetworkId],
    {
      checkIsFocused: false,
      watchLoading: true,
      undefinedResultIfError: true,
      undefinedResultIfReRun: true,
    },
  );

  return {
    stableTokens: result,
    isLoading: result === undefined && isLoading !== false,
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
  const selectedToken =
    selectedSide === ESwapDirectionType.FROM ? fromToken : toToken;
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

  if (options.length > 1) {
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

  if (!selectedToken) {
    return null;
  }

  return (
    <XStack
      ai="center"
      gap="$1"
      px={compact ? '$1.5' : '$2'}
      py="$1"
      bg="$neutral3"
      borderRadius="$full"
      maxWidth={compact ? '$24' : '$32'}
    >
      <Token
        size={tokenSize}
        tokenImageUri={selectedToken.logoURI}
        networkId={selectedToken.networkId}
        showNetworkIcon
      />
      <SizableText size={labelSize} numberOfLines={1}>
        {selectedToken.symbol}
      </SizableText>
    </XStack>
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
  kLineDataFallback?: ITradingViewV2KLineDataFallback;
  primaryKLineDataUnavailable: boolean;
  resolvedSelectedSide?: ESwapDirectionType;
  shouldForceEmptyKLineData: boolean;
  tokenMarketDetail?: IMarketTokenDetail;
  handlePrimaryKLineDataUnavailable: () => void;
  handleSelectedSideChange: (side: ESwapDirectionType) => void;
};

function useSwapKLineContentState(): ISwapKLineContentState {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const { stableTokens, isLoading: isStableTokensLoading } =
    useSwapKLineStableTokens({ fromToken, toToken });
  const stableTokensForDefaultSide = useMemo(
    () => stableTokens ?? (isStableTokensLoading ? undefined : []),
    [isStableTokensLoading, stableTokens],
  );
  const defaultSide = useMemo(
    () =>
      getResolvableDefaultSwapKLineSide({
        fromToken,
        stableTokens: stableTokensForDefaultSide,
        toToken,
      }),
    [fromToken, stableTokensForDefaultSide, toToken],
  );
  const [selectedSide, setSelectedSide] = useState<ESwapDirectionType>();
  const hasTrackedOpenRef = useRef(false);

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
  const walletMarketInfo = useSwapKLineWalletMarketInfo(selectedToken);
  const tokenMarketDetail = useSwapKLineTokenMarketInfo(selectedToken);
  const {
    kLineDataFallback,
    primaryKLineDataUnavailable,
    handlePrimaryKLineDataUnavailable,
  } = useSwapKLineChartDataSource({
    token: selectedToken,
    coinGeckoId: walletMarketInfo?.coinGeckoId,
  });
  const shouldForceEmptyKLineData =
    isKnownSwapKLineUnsupportedToken(selectedToken);

  useEffect(() => {
    if (hasTrackedOpenRef.current || !selectedToken || !resolvedSelectedSide) {
      return;
    }

    hasTrackedOpenRef.current = true;
    defaultLogger.swap.swapKline.swapKlineOpen({
      defaultSide: resolvedSelectedSide,
      tokenSymbol: selectedToken.symbol,
      network: selectedToken.networkId,
      fromTokenSymbol: fromToken?.symbol,
      toTokenSymbol: toToken?.symbol,
    });
  }, [fromToken?.symbol, resolvedSelectedSide, selectedToken, toToken?.symbol]);

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
      kLineDataFallback,
      primaryKLineDataUnavailable,
      resolvedSelectedSide,
      shouldForceEmptyKLineData,
      tokenMarketDetail,
      handlePrimaryKLineDataUnavailable,
      handleSelectedSideChange,
    }),
    [
      fromToken,
      handlePrimaryKLineDataUnavailable,
      handleSelectedSideChange,
      kLineDataFallback,
      primaryKLineDataUnavailable,
      resolvedSelectedSide,
      selectedToken,
      shouldForceEmptyKLineData,
      toToken,
      tokenMarketDetail,
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
  token,
  tokenMarketDetail,
  walletMarketInfo,
  compact,
}: {
  token: ISwapToken;
  tokenMarketDetail?: IMarketTokenDetail;
  walletMarketInfo?: ISwapKLineWalletMarketInfo;
  compact?: boolean;
}) {
  const price =
    getNormalizedPrice(tokenMarketDetail?.price) ??
    walletMarketInfo?.price ??
    getNormalizedPrice(token.price);
  const priceChange =
    getNormalizedPercent(tokenMarketDetail?.priceChange24hPercent) ??
    walletMarketInfo?.priceChange24hPercent;

  return (
    <YStack
      ai="flex-end"
      gap={compact ? '$0' : '$0.5'}
      minWidth={compact ? '$24' : '$16'}
      maxWidth={compact ? '$30' : '$28'}
    >
      {price ? (
        <NumberSizeableText
          size="$bodyMdMedium"
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
          size="$bodyMdMedium"
          color="$textSubdued"
          fontFamily="$monoMedium"
          numberOfLines={1}
        >
          --
        </SizableText>
      )}
      <XStack ai="center" gap={compact ? '$0' : '$1'}>
        {compact ? null : (
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            24h
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
      </XStack>
    </YStack>
  );
}

function SwapKLineTokenInfoRow({
  token,
  tokenMarketDetail,
  walletMarketInfo,
  headerRight,
  compact,
}: {
  token: ISwapToken;
  tokenMarketDetail?: IMarketTokenDetail;
  walletMarketInfo?: ISwapKLineWalletMarketInfo;
  headerRight?: ReactNode;
  compact?: boolean;
}) {
  const networkName = useSwapKLineNetworkName(token.networkId);

  return (
    <XStack
      ai="center"
      jc="space-between"
      gap={compact ? '$2.5' : '$3'}
      minHeight={compact ? '$11' : '$12'}
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
          <SizableText
            size={compact ? '$bodyLgMedium' : '$headingMd'}
            numberOfLines={1}
          >
            {token.symbol}
          </SizableText>
          {networkName ? (
            <SizableText
              size={compact ? '$bodyMd' : '$bodySm'}
              color="$textSubdued"
              numberOfLines={1}
            >
              {networkName}
            </SizableText>
          ) : null}
        </YStack>
        <SwapKLineTokenPriceInfo
          token={token}
          tokenMarketDetail={tokenMarketDetail}
          walletMarketInfo={walletMarketInfo}
          compact={compact}
        />
      </XStack>
      {headerRight ? <Stack flexShrink={0}>{headerRight}</Stack> : null}
    </XStack>
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
}: {
  state: ISwapKLineContentState;
  chartMinHeight?: number;
  headerRight?: ReactNode;
} & ISwapKLineContentSpacingProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const selectedToken = state.selectedToken;
  const chartNetworkId = selectedToken?.networkId ?? '';
  const chartTokenAddress = selectedToken?.contractAddress ?? '';
  const disabledTradingViewFeatures = gtMd
    ? SWAP_KLINE_DESKTOP_DISABLED_TRADING_VIEW_FEATURES
    : SWAP_KLINE_MOBILE_DISABLED_TRADING_VIEW_FEATURES;

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
            compact
          />
        </YStack>
      ) : (
        <SwapKLineTokenInfoRow
          token={selectedToken}
          tokenMarketDetail={state.tokenMarketDetail}
          walletMarketInfo={state.walletMarketInfo}
          headerRight={headerRight}
        />
      );
  }

  const chartContent = (
    <Stack
      flex={1}
      minHeight={chartMinHeight}
      overflow="hidden"
      borderTopWidth="$px"
      borderTopColor="$borderSubdued"
    >
      <TradingViewV2
        key={`${chartNetworkId}:${chartTokenAddress}:${
          selectedToken?.symbol ?? ''
        }`}
        symbol={selectedToken?.symbol ?? ''}
        tokenAddress={chartTokenAddress}
        networkId={chartNetworkId}
        decimal={selectedToken?.decimals ?? 0}
        dataSource="polling"
        disabledFeatures={disabledTradingViewFeatures}
        storageNamespace={SWAP_KLINE_TRADING_VIEW_STORAGE_NAMESPACE}
        forceEmptyKLineData={state.shouldForceEmptyKLineData}
        emptyKLineDataOnError
        kLineDataFallback={state.kLineDataFallback}
        primaryKLineDataUnavailable={state.primaryKLineDataUnavailable}
        onPrimaryKLineDataUnavailable={state.handlePrimaryKLineDataUnavailable}
        w="100%"
        h="100%"
      />
    </Stack>
  );

  return (
    <>
      {selectedToken ? (
        <YStack flex={1} px={px} pt={pt} pb={pb} gap={gap}>
          {tokenInfoContent}
          {chartContent}
        </YStack>
      ) : (
        <YStack flex={1} ai="center" jc="center" px="$5">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.token_selector_title })}
          </SizableText>
        </YStack>
      )}
    </>
  );
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

  return (
    <Page lazyLoad testID={SwapTestIDs.kLineModal}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.market_chart })}
      />
      <Page.Body>
        <SwapKLineContentBody state={state} headerRight={headerRight} />
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
