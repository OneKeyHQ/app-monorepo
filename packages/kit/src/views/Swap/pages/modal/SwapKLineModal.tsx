import { useCallback, useMemo, useState } from 'react';

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
import { TradingViewV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import { ProviderJotaiContextMarketV2 } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import {
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';
import { ETokenDappType } from '@onekeyhq/shared/types/token';

import { SwapTestIDs } from '../../testIDs';
import { SwapProviderMirror } from '../SwapProviderMirror';

import type { RouteProp } from '@react-navigation/core';

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

function isSwapKLineUnsupportedToken(token?: ISwapToken) {
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
  const resolvedSelectedSide = useMemo(() => {
    const requestedSide = selectedSide ?? defaultSide;
    const selectedToken =
      requestedSide === ESwapDirectionType.FROM ? fromToken : toToken;
    return selectedToken ? requestedSide : defaultSide;
  }, [defaultSide, fromToken, selectedSide, toToken]);

  const selectedToken =
    resolvedSelectedSide === ESwapDirectionType.FROM ? fromToken : toToken;
  const isSelectedTokenDappToken = selectedToken
    ? isSwapKLineUnsupportedToken(selectedToken)
    : false;
  const chartNetworkId = isSelectedTokenDappToken
    ? ''
    : (selectedToken?.networkId ?? '');
  const chartTokenAddress = isSelectedTokenDappToken
    ? ''
    : (selectedToken?.contractAddress ?? '');

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
                onChange={setSelectedSide}
                fromToken={fromToken}
                toToken={toToken}
              />
            </XStack>

            <Stack
              flex={1}
              minHeight={360}
              overflow="hidden"
              borderTopWidth="$px"
              borderTopColor="$borderSubdued"
            >
              <TradingViewV2
                key={`${chartNetworkId}:${chartTokenAddress}:${selectedToken.symbol}`}
                symbol={selectedToken.symbol}
                tokenAddress={chartTokenAddress}
                networkId={chartNetworkId}
                decimal={selectedToken.decimals}
                dataSource="polling"
                w="100%"
                h="100%"
              />
            </Stack>
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
