import {
  type ComponentProps,
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
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';
import { ETokenDappType } from '@onekeyhq/shared/types/token';
import type { ITokenDappType } from '@onekeyhq/shared/types/token';

import { SwapTestIDs } from '../../testIDs';
import { SwapProviderMirror } from '../SwapProviderMirror';

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

type ISwapKLineToken = ISwapToken & {
  defiMarked?: boolean;
  dappName?: string | null;
  dappType?: ITokenDappType;
};

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
  if (!toToken) {
    return ESwapDirectionType.FROM;
  }

  const toIsKnownUnsupported = isKnownSwapKLineUnsupportedToken(toToken);
  if (toIsKnownUnsupported && fromToken) {
    const fromIsKnownUnsupported = isKnownSwapKLineUnsupportedToken(fromToken);
    if (!fromIsKnownUnsupported) {
      return ESwapDirectionType.FROM;
    }
  }

  return ESwapDirectionType.TO;
}

function getNormalizedPrice(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue) || numericValue === 0) {
    return undefined;
  }
  return normalized;
}

function getNormalizedPercent(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }
  return normalized;
}

function useSwapKLineTokenMarketInfo(token?: ISwapToken) {
  const tokenAddress = token?.contractAddress ?? '';
  const networkId = token?.networkId ?? '';
  const { result } = usePromiseResult<IMarketTokenDetail | undefined>(
    async () => {
      if (!networkId) {
        return undefined;
      }
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
          tokenAddress,
          networkId,
        );
      return response?.data?.token;
    },
    [networkId, tokenAddress],
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

function useSwapKLineNetworkName(networkId?: string) {
  const { result } = usePromiseResult<string | undefined>(
    async () => {
      if (!networkId) {
        return undefined;
      }
      const network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId,
      });
      return network?.shortname || network?.name || network?.symbol;
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
                  <Token size="xs" tokenImageUri={fromToken.logoURI} />
                  <SizableText
                    size="$bodyMdMedium"
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
                <XStack ai="center" gap="$1" maxWidth="$20">
                  <Token size="xs" tokenImageUri={toToken.logoURI} />
                  <SizableText
                    size="$bodyMdMedium"
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
    [fromToken, selectedSide, toToken],
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
          py: '$1.5',
          px: '$3',
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
      px="$2"
      py="$1"
      bg="$neutral3"
      borderRadius="$full"
      maxWidth="$32"
    >
      <Token size="xs" tokenImageUri={selectedToken.logoURI} />
      <SizableText size="$bodyMdMedium" numberOfLines={1}>
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
  resolvedSelectedSide: ESwapDirectionType;
  shouldForceEmptyKLineData: boolean;
  tokenMarketDetail?: IMarketTokenDetail;
  handleSelectedSideChange: (side: ESwapDirectionType) => void;
};

function useSwapKLineContentState(): ISwapKLineContentState {
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
  const shouldForceEmptyKLineData =
    isKnownSwapKLineUnsupportedToken(selectedToken);
  const tokenMarketDetail = useSwapKLineTokenMarketInfo(selectedToken);

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

  return useMemo(
    () => ({
      fromToken,
      toToken,
      selectedToken,
      resolvedSelectedSide,
      shouldForceEmptyKLineData,
      tokenMarketDetail,
      handleSelectedSideChange,
    }),
    [
      fromToken,
      handleSelectedSideChange,
      resolvedSelectedSide,
      selectedToken,
      shouldForceEmptyKLineData,
      toToken,
      tokenMarketDetail,
    ],
  );
}

function SwapKLineHeaderRight({ state }: { state: ISwapKLineContentState }) {
  if (!state.selectedToken) {
    return null;
  }

  return (
    <SwapKLineTokenSwitch
      selectedSide={state.resolvedSelectedSide}
      onChange={state.handleSelectedSideChange}
      fromToken={state.fromToken}
      toToken={state.toToken}
    />
  );
}

function SwapKLineTokenPriceInfo({
  token,
  tokenMarketDetail,
}: {
  token: ISwapToken;
  tokenMarketDetail?: IMarketTokenDetail;
}) {
  const price =
    getNormalizedPrice(tokenMarketDetail?.price) ??
    getNormalizedPrice(token.price);
  const priceChange = getNormalizedPercent(
    tokenMarketDetail?.priceChange24hPercent,
  );

  return (
    <YStack ai="flex-end" gap="$0.5" minWidth="$20" maxWidth="$32">
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
      <XStack ai="center" gap="$1">
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          24h
        </SizableText>
        {priceChange ? (
          <PriceChangePercentage
            size="$bodySmMedium"
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
}: {
  token: ISwapToken;
  tokenMarketDetail?: IMarketTokenDetail;
}) {
  const tokenName = tokenMarketDetail?.name || token.name;
  const networkName = useSwapKLineNetworkName(token.networkId);
  const subtitle = useMemo(() => {
    const shouldShowTokenName =
      tokenName && tokenName.toLowerCase() !== token.symbol.toLowerCase();
    return [shouldShowTokenName ? tokenName : undefined, networkName]
      .filter(Boolean)
      .join(' · ');
  }, [networkName, token.symbol, tokenName]);

  return (
    <XStack ai="center" jc="space-between" gap="$3" minHeight="$12">
      <XStack ai="center" gap="$3" flex={1} minWidth={0}>
        <Token
          size="lg"
          tokenImageUri={token.logoURI}
          networkId={token.networkId}
          showNetworkIcon
        />
        <YStack flex={1} minWidth={0} gap="$0.5">
          <SizableText size="$headingMd" numberOfLines={1}>
            {token.symbol}
          </SizableText>
          {subtitle ? (
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {subtitle}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
      <SwapKLineTokenPriceInfo
        token={token}
        tokenMarketDetail={tokenMarketDetail}
      />
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
}: {
  state: ISwapKLineContentState;
  chartMinHeight?: number;
} & ISwapKLineContentSpacingProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const selectedToken = state.selectedToken;
  const chartNetworkId = selectedToken?.networkId ?? '';
  const chartTokenAddress = selectedToken?.contractAddress ?? '';
  const disabledTradingViewFeatures = gtMd
    ? SWAP_KLINE_DESKTOP_DISABLED_TRADING_VIEW_FEATURES
    : SWAP_KLINE_MOBILE_DISABLED_TRADING_VIEW_FEATURES;

  const chartContent = (
    <Stack
      flex={1}
      minHeight={chartMinHeight}
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
        disabledFeatures={disabledTradingViewFeatures}
        storageNamespace={SWAP_KLINE_TRADING_VIEW_STORAGE_NAMESPACE}
        forceEmptyKLineData={state.shouldForceEmptyKLineData}
        emptyKLineDataOnError
        w="100%"
        h="100%"
      />
    </Stack>
  );

  return (
    <>
      {selectedToken ? (
        <YStack flex={1} px={px} pt={pt} pb={pb} gap={gap}>
          <SwapKLineTokenInfoRow
            token={selectedToken}
            tokenMarketDetail={state.tokenMarketDetail}
          />

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
  const state = useSwapKLineContentState();

  return (
    <>
      <Dialog.Header>
        <XStack ai="center" jc="space-between" gap="$3" width="100%">
          <SizableText size="$headingXl" numberOfLines={1}>
            {intl.formatMessage({ id: ETranslations.market_chart })}
          </SizableText>
          <SwapKLineHeaderRight state={state} />
        </XStack>
      </Dialog.Header>
      <YStack h={460}>
        <SwapKLineContentBody
          state={state}
          chartMinHeight={320}
          pt="$0"
          pb="$0"
          gap="$2.5"
        />
      </YStack>
    </>
  );
}

function SwapKLineModalContent() {
  const intl = useIntl();
  const state = useSwapKLineContentState();
  const headerRight = useCallback(
    () => <SwapKLineHeaderRight state={state} />,
    [state],
  );

  return (
    <Page lazyLoad testID={SwapTestIDs.kLineModal}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.market_chart })}
        headerRight={headerRight}
      />
      <Page.Body>
        <SwapKLineContentBody state={state} />
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
