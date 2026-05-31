import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Page,
  SegmentControl,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  TRADING_VIEW_DISABLED_FEATURES,
  TradingViewV2,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import { ProviderJotaiContextMarketV2 } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import {
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';
import { ETokenDappType } from '@onekeyhq/shared/types/token';
import type { ITokenDappType } from '@onekeyhq/shared/types/token';

import { SwapTestIDs } from '../../testIDs';
import { SwapProviderMirror } from '../SwapProviderMirror';

import type { RouteProp } from '@react-navigation/core';

const SWAP_KLINE_TRADING_VIEW_STORAGE_NAMESPACE = 'swap-kline';
const SWAP_KLINE_DISABLED_TRADING_VIEW_FEATURES = [
  TRADING_VIEW_DISABLED_FEATURES.FOOTER,
  TRADING_VIEW_DISABLED_FEATURES.PRICE_MARKET_CAP_TOGGLE,
  TRADING_VIEW_DISABLED_FEATURES.INDICATORS,
  TRADING_VIEW_DISABLED_FEATURES.SETTINGS,
  TRADING_VIEW_DISABLED_FEATURES.CHART_TYPE,
  TRADING_VIEW_DISABLED_FEATURES.RESET_LAYOUT,
  TRADING_VIEW_DISABLED_FEATURES.FULLSCREEN,
  TRADING_VIEW_DISABLED_FEATURES.LAYOUT_TOGGLE,
  TRADING_VIEW_DISABLED_FEATURES.DRAWING_TOOLBAR,
] as const;

type ISwapKLineToken = ISwapToken & {
  defiMarked?: boolean;
  dappName?: string | null;
  dappType?: ITokenDappType;
};

const STABLE_TOKEN_SYMBOLS = new Set([
  'DAI',
  'FDUSD',
  'FRAX',
  'GUSD',
  'LUSD',
  'PYUSD',
  'TUSD',
  'USDB',
  'USDBC',
  'USDC',
  'USDD',
  'USDE',
  'USDH',
  'USD0',
  'USDP',
  'USDS',
  'USDT',
  'USDT0',
]);

function normalizeTokenSymbol(symbol?: string) {
  return (
    symbol
      ?.trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/\u20ae/gu, 'T') ?? ''
  );
}

function isStableToken(token?: ISwapToken) {
  if (!token) {
    return false;
  }

  const symbol = normalizeTokenSymbol(token.symbol);
  const baseSymbol = symbol.replace(/\.(E|B)$/u, '');
  if (
    STABLE_TOKEN_SYMBOLS.has(symbol) ||
    STABLE_TOKEN_SYMBOLS.has(baseSymbol)
  ) {
    return true;
  }

  return false;
}

function isKnownSwapKLineUnsupportedToken(token?: ISwapKLineToken) {
  if (!token) {
    return false;
  }
  if (token.dappType === ETokenDappType.WalletToken) {
    return false;
  }
  return Boolean(token.defiMarked || token.dappName?.trim() || token.dappType);
}

function getDefaultKLineSide({
  fromToken,
  toToken,
}: {
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}): ESwapDirectionType {
  if (!fromToken && toToken) {
    return ESwapDirectionType.TO;
  }
  if (!fromToken || !toToken) {
    return ESwapDirectionType.FROM;
  }

  const fromIsKnownUnsupported = isKnownSwapKLineUnsupportedToken(fromToken);
  const toIsKnownUnsupported = isKnownSwapKLineUnsupportedToken(toToken);
  if (fromIsKnownUnsupported && !toIsKnownUnsupported) {
    return ESwapDirectionType.TO;
  }
  if (!fromIsKnownUnsupported && toIsKnownUnsupported) {
    return ESwapDirectionType.FROM;
  }

  const fromIsStable = isStableToken(fromToken);
  const toIsStable = isStableToken(toToken);
  if (fromIsStable && !toIsStable) {
    return ESwapDirectionType.TO;
  }

  return ESwapDirectionType.FROM;
}

function SwapKLineTokenSwitch({
  selectedSide,
  onChange,
  fromToken,
  toToken,
}: {
  selectedSide: ESwapDirectionType;
  onChange: (side: ESwapDirectionType) => void;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  const selectedToken =
    selectedSide === ESwapDirectionType.FROM ? fromToken : toToken;
  const options = useMemo(
    () =>
      [
        fromToken
          ? {
              label: (
                <XStack ai="center" gap="$1" maxWidth="$20">
                  <Token size="xxs" tokenImageUri={fromToken.logoURI} />
                  <SizableText size="$bodySmMedium" numberOfLines={1}>
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
                <XStack ai="center" gap="$1" maxWidth="$20">
                  <Token size="xxs" tokenImageUri={toToken.logoURI} />
                  <SizableText size="$bodySmMedium" numberOfLines={1}>
                    {toToken.symbol}
                  </SizableText>
                </XStack>
              ),
              value: ESwapDirectionType.TO,
            }
          : undefined,
      ].filter(Boolean),
    [fromToken, toToken],
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
        slotBackgroundColor="$bgSubdued"
        activeBackgroundColor="$bg"
        borderRadius="$full"
        p="$0.5"
        h="auto"
        segmentControlItemStyleProps={{
          py: '$1',
          px: '$2',
          borderRadius: '$full',
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
      px="$2"
      py="$1"
      bg="$bgSubdued"
      borderRadius="$full"
      maxWidth="$32"
    >
      <Token size="xxs" tokenImageUri={selectedToken.logoURI} />
      <SizableText size="$bodySmMedium" numberOfLines={1}>
        {selectedToken.symbol}
      </SizableText>
    </XStack>
  );
}

function SwapKLineModalContent() {
  const intl = useIntl();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const defaultSide = useMemo(
    () =>
      getDefaultKLineSide({
        fromToken,
        toToken,
      }),
    [fromToken, toToken],
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

  const selectedToken =
    resolvedSelectedSide === ESwapDirectionType.FROM ? fromToken : toToken;
  const chartNetworkId = selectedToken?.networkId ?? '';
  const chartTokenAddress = selectedToken?.contractAddress ?? '';
  const shouldForceEmptyKLineData =
    isKnownSwapKLineUnsupportedToken(selectedToken);

  useEffect(() => {
    if (hasTrackedOpenRef.current || !selectedToken) {
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
          fromSide: resolvedSelectedSide,
          toSide: side,
          tokenSymbol: nextToken.symbol,
          network: nextToken.networkId,
        });
      }
      setSelectedSide(side);
    },
    [fromToken, resolvedSelectedSide, toToken],
  );

  const chartContent = (
    <Stack
      flex={1}
      minHeight={360}
      overflow="hidden"
      borderTopWidth="$px"
      borderTopColor="$borderSubdued"
    >
      <TradingViewV2
        key={`${chartNetworkId}:${chartTokenAddress}:${selectedToken?.symbol ?? ''}`}
        symbol={selectedToken?.symbol ?? ''}
        tokenAddress={chartTokenAddress}
        networkId={chartNetworkId}
        decimal={selectedToken?.decimals ?? 0}
        dataSource="polling"
        disabledFeatures={SWAP_KLINE_DISABLED_TRADING_VIEW_FEATURES}
        storageNamespace={SWAP_KLINE_TRADING_VIEW_STORAGE_NAMESPACE}
        forceEmptyKLineData={shouldForceEmptyKLineData}
        emptyKLineDataOnError
        w="100%"
        h="100%"
      />
    </Stack>
  );

  return (
    <Page lazyLoad testID={SwapTestIDs.kLineModal}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.market_chart })}
      />
      <Page.Body>
        {selectedToken ? (
          <YStack flex={1} px="$5" pt="$3" pb="$5" gap="$3">
            <XStack ai="center" jc="space-between" gap="$3" minHeight="$10">
              <XStack ai="center" gap="$3" flex={1} minWidth={0}>
                <Token
                  size="md"
                  tokenImageUri={selectedToken.logoURI}
                  networkId={selectedToken.networkId}
                  showNetworkIcon
                />
                <YStack flex={1} minWidth={0} gap="$0.5">
                  <SizableText size="$headingMd" numberOfLines={1}>
                    {selectedToken.symbol}
                  </SizableText>
                </YStack>
              </XStack>
              <SwapKLineTokenSwitch
                selectedSide={resolvedSelectedSide}
                onChange={handleSelectedSideChange}
                fromToken={fromToken}
                toToken={toToken}
              />
            </XStack>

            {chartContent}
          </YStack>
        ) : (
          <YStack flex={1} ai="center" jc="center" px="$5">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.token_selector_title })}
            </SizableText>
          </YStack>
        )}
      </Page.Body>
    </Page>
  );
}

export default function SwapKLineModal() {
  const route =
    useRoute<RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapKLine>>();
  const { storeName } = route.params;

  return (
    <SwapProviderMirror storeName={storeName}>
      <ProviderJotaiContextMarketV2>
        <SwapKLineModalContent />
      </ProviderJotaiContextMarketV2>
    </SwapProviderMirror>
  );
}
