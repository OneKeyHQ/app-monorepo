import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  DashText,
  DebugRenderTracker,
  Divider,
  Popover,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useActiveTradeInstrumentAtom,
  useConnectionStateAtom,
  useHyperliquidActions,
  useOrderBookTickOptionsAtom,
  useTradingFormAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsShouldShowEnableTradingButtonAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { markPerpsColdStartPerfOnce } from '@onekeyhq/shared/src/performance/perpsColdStartPerf';

import { useFundingCountdown } from '../hooks/useFundingCountdown';
import { useL2Book } from '../hooks/usePerpMarketData';
import { usePerpsActiveAssetCtxDisplay } from '../hooks/usePerpsActiveAssetCtxDisplay';
import { useTradingPrice } from '../hooks/useTradingPrice';
import {
  type IPerpsMobileLayoutTraceRect,
  getPerpsMobileLayoutTraceRect,
  isPerpsMobileLayoutTraceRectChanged,
  tracePerpsMobileLayout,
} from '../utils/mobileLayoutTrace';

import {
  type IOrderBookSelection,
  OrderBook,
  OrderBookMobile,
} from './OrderBook';
import { DefaultLoadingNode } from './OrderBook/DefaultLoadingNode';
import { useTickOptions } from './OrderBook/useTickOptions';

import type { ITickParam } from './OrderBook/tickSizeUtils';
import type { IOrderBookVariant } from './OrderBook/types';
import type { LayoutChangeEvent } from 'react-native';

function MobileHeader({
  showPlaceholder = false,
}: {
  showPlaceholder?: boolean;
}) {
  const intl = useIntl();
  const layoutRef = useRef<IPerpsMobileLayoutTraceRect | undefined>(undefined);
  const countdown = useFundingCountdown();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [connectionState] = useConnectionStateAtom();
  const {
    assetCtx,
    source: assetCtxSource,
    cacheAgeMs,
  } = usePerpsActiveAssetCtxDisplay(activeTradeInstrument.coin);
  const hasError = connectionState.reconnectCount > 3;
  const isReady = connectionState.isConnected && !hasError;
  const isSpot = activeTradeInstrument.mode === 'spot';

  const { fundingRate, markPrice } = assetCtx?.ctx || {
    fundingRate: '0',
    markPrice: '0',
  };
  const fundingRateNumber = parseFloat(fundingRate);
  const hasFundingValue = Number.isFinite(fundingRateNumber);
  const hourlyFundingRate = (fundingRateNumber * 100).toFixed(4);
  const dailyFundingRate = (fundingRateNumber * 100 * 24).toFixed(2);
  const weeklyFundingRate = (fundingRateNumber * 100 * 24 * 7).toFixed(2);
  const monthlyFundingRate = (fundingRateNumber * 100 * 24 * 30).toFixed(2);
  const annualizedFundingRate = (fundingRateNumber * 100 * 24 * 365).toFixed(2);
  const fundingColor = useMemo(() => {
    if (!hasFundingValue) {
      return '$textSubdued';
    }
    return fundingRateNumber >= 0 ? '$green11' : '$red11';
  }, [fundingRateNumber, hasFundingValue]);

  const fundingDisplay = hasFundingValue
    ? `${(fundingRateNumber * 100).toFixed(4)}%`
    : '--';
  const markPriceNumber = parseFloat(markPrice);
  const showSkeleton =
    hasError || !Number.isFinite(markPriceNumber) || markPriceNumber === 0;

  useEffect(() => {
    tracePerpsMobileLayout('orderBook.mobileHeader.state', {
      coin: activeTradeInstrument.coin,
      showPlaceholder,
      showSkeleton,
      isReady,
      hasError,
      markPrice,
      fundingRate,
      assetCtxSource,
      cacheAgeMs,
    });
  }, [
    activeTradeInstrument.coin,
    assetCtxSource,
    cacheAgeMs,
    fundingRate,
    hasError,
    isReady,
    markPrice,
    showPlaceholder,
    showSkeleton,
  ]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const rect = getPerpsMobileLayoutTraceRect(event);
      if (isPerpsMobileLayoutTraceRectChanged(layoutRef.current, rect)) {
        tracePerpsMobileLayout('orderBook.mobileHeader.layout', {
          rect,
          showPlaceholder,
          showSkeleton,
          coin: activeTradeInstrument.coin,
        });
        layoutRef.current = rect;
      }
    },
    [activeTradeInstrument.coin, showPlaceholder, showSkeleton],
  );

  if (isSpot) {
    return null;
  }

  return (
    <Popover
      title={intl.formatMessage({
        id: ETranslations.perp_position_funding,
      })}
      renderTrigger={
        <YStack
          alignItems="flex-start"
          mb="$2"
          h={32}
          justifyContent="center"
          onLayout={handleLayout}
        >
          <DashText
            fontSize={10}
            color="$textSubdued"
            dashColor="$textSubdued"
            dashThickness={0.5}
            lineHeight={16}
          >
            {intl.formatMessage({
              id: ETranslations.perp_token_bar_Funding,
            })}
          </DashText>

          {showPlaceholder || showSkeleton ? (
            <SizableText size="$bodySmMedium" color="$textSubdued">
              --
            </SizableText>
          ) : (
            <XStack alignItems="center" gap={6}>
              <SizableText size="$bodySmMedium" color={fundingColor}>
                {fundingDisplay}
              </SizableText>
              <SizableText size="$bodySmMedium" color="$text">
                {countdown}
              </SizableText>
            </XStack>
          )}
        </YStack>
      }
      renderContent={
        <YStack
          bg="$bg"
          justifyContent="center"
          w="100%"
          px="$5"
          pt="$2"
          pb="$5"
          gap="$6"
        >
          <YStack gap="$2">
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perps_fee_rate_projection,
                })}
              </SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_position_funding,
                })}
              </SizableText>
            </XStack>
            <YStack gap="$3">
              <XStack justifyContent="space-between" alignItems="center">
                <XStack gap="$1" alignItems="center">
                  <SizableText
                    size="$headingXs"
                    fontFamily="$monoRegular"
                    fontVariant={['tabular-nums']}
                  >
                    {intl.formatMessage({
                      id: ETranslations.perps_hourly,
                    })}
                  </SizableText>
                  <SizableText
                    size="$headingXs"
                    fontFamily="$monoRegular"
                    fontVariant={['tabular-nums']}
                    color="$textSubdued"
                  >
                    ({countdown})
                  </SizableText>
                </XStack>
                <SizableText
                  size="$headingXs"
                  fontFamily="$monoRegular"
                  fontVariant={['tabular-nums']}
                  color={fundingRateNumber >= 0 ? '$green11' : '$red11'}
                >
                  {hourlyFundingRate}%
                </SizableText>
              </XStack>
              <XStack justifyContent="space-between" alignItems="center">
                <SizableText
                  size="$headingXs"
                  fontFamily="$monoRegular"
                  fontVariant={['tabular-nums']}
                >
                  {intl.formatMessage({
                    id: ETranslations.earn_daily,
                  })}
                </SizableText>
                <SizableText
                  size="$headingXs"
                  fontFamily="$monoRegular"
                  fontVariant={['tabular-nums']}
                  color={fundingRateNumber >= 0 ? '$green11' : '$red11'}
                >
                  {dailyFundingRate}%
                </SizableText>
              </XStack>
              <XStack justifyContent="space-between" alignItems="center">
                <SizableText
                  size="$headingXs"
                  fontFamily="$monoRegular"
                  fontVariant={['tabular-nums']}
                >
                  {intl.formatMessage({
                    id: ETranslations.earn_weekly,
                  })}
                </SizableText>
                <SizableText
                  size="$headingXs"
                  fontFamily="$monoRegular"
                  fontVariant={['tabular-nums']}
                  color={fundingRateNumber >= 0 ? '$green11' : '$red11'}
                >
                  {weeklyFundingRate}%
                </SizableText>
              </XStack>
              <XStack justifyContent="space-between" alignItems="center">
                <SizableText
                  size="$headingXs"
                  fontFamily="$monoRegular"
                  fontVariant={['tabular-nums']}
                >
                  {intl.formatMessage({
                    id: ETranslations.earn_monthly,
                  })}
                </SizableText>
                <SizableText
                  size="$headingXs"
                  fontFamily="$monoRegular"
                  fontVariant={['tabular-nums']}
                  color={fundingRateNumber >= 0 ? '$green11' : '$red11'}
                >
                  {monthlyFundingRate}%
                </SizableText>
              </XStack>
              <XStack justifyContent="space-between" alignItems="center">
                <SizableText
                  size="$headingXs"
                  fontFamily="$monoRegular"
                  fontVariant={['tabular-nums']}
                >
                  {intl.formatMessage({
                    id: ETranslations.earn_annually,
                  })}
                </SizableText>
                <SizableText
                  size="$headingXs"
                  fontFamily="$monoRegular"
                  fontVariant={['tabular-nums']}
                  color={fundingRateNumber >= 0 ? '$green11' : '$red11'}
                >
                  {annualizedFundingRate}%
                </SizableText>
              </XStack>
            </YStack>
          </YStack>
          <Divider />

          <YStack gap="$2">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_trades_history_direction,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium" color={fundingColor}>
              {parseFloat(fundingRate) >= 0 ? (
                <SizableText size="$bodySmMedium" color="$text">
                  <SizableText size="$bodySmMedium" color="$green11">
                    {intl.formatMessage({
                      id: ETranslations.perp_ticker_direction_funding_tooltip_long,
                    })}
                  </SizableText>{' '}
                  {intl.formatMessage({
                    id: ETranslations.perp_ticker_direction_funding_tooltip_pays,
                  })}{' '}
                  <SizableText size="$bodySmMedium" color="$red11">
                    {intl.formatMessage({
                      id: ETranslations.perp_ticker_direction_funding_tooltip_short,
                    })}
                  </SizableText>
                </SizableText>
              ) : (
                <SizableText size="$bodySmMedium" color="$text">
                  <SizableText size="$bodySmMedium" color="$red11">
                    {intl.formatMessage({
                      id: ETranslations.perp_ticker_direction_funding_tooltip_short,
                    })}
                  </SizableText>{' '}
                  {intl.formatMessage({
                    id: ETranslations.perp_ticker_direction_funding_tooltip_pays,
                  })}{' '}
                  <SizableText size="$bodySmMedium" color="$green11">
                    {intl.formatMessage({
                      id: ETranslations.perp_ticker_direction_funding_tooltip_long,
                    })}
                  </SizableText>
                </SizableText>
              )}
            </SizableText>
          </YStack>

          <Divider />
          <YStack gap="$2">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_funding_rate_tip0,
              })}
            </SizableText>
            <SizableText size="$bodySmMedium">
              {intl.formatMessage({
                id: ETranslations.perp_funding_rate_tip1,
              })}
            </SizableText>
            <SizableText size="$bodySmMedium">
              {intl.formatMessage({
                id: ETranslations.perp_funding_rate_tip2,
              })}
            </SizableText>
          </YStack>
        </YStack>
      }
    />
  );
}
const MobileHeaderMemo = memo(MobileHeader);
const MOBILE_SPOT_MAX_LEVELS_PER_SIDE = 4;

export function PerpOrderBook({
  entry,
  maxLevelsPerSide: propMaxLevelsPerSide,
  initialOrderBookHeight,
}: {
  entry?: 'perpTab' | 'perpMobileMarket';
  maxLevelsPerSide?: number;
  initialOrderBookHeight?: number;
}) {
  const { gtMd } = useMedia();
  const actionsRef = useHyperliquidActions();
  const l2BookSnapshotRequestKeyRef = useRef<string | undefined>(undefined);
  const layoutRectsRef = useRef<
    Record<string, IPerpsMobileLayoutTraceRect | undefined>
  >({});
  const renderStateSignatureRef = useRef<string | undefined>(undefined);
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [formData] = useTradingFormAtom();
  const [orderBookTickOptions] = useOrderBookTickOptionsAtom();
  const { midPrice } = useTradingPrice();
  const [shouldShowEnableTradingButton] =
    usePerpsShouldShowEnableTradingButtonAtom();

  const l2SubscriptionOptions = useMemo(() => {
    const coin = activeTradeInstrument.coin;
    if (!coin) {
      return { nSigFigs: null, mantissa: undefined };
    }
    const stored = orderBookTickOptions[coin];
    const nSigFigs = stored?.nSigFigs ?? null;
    const mantissa =
      stored?.mantissa === undefined ? undefined : stored.mantissa;
    return { nSigFigs, mantissa };
  }, [activeTradeInstrument.coin, orderBookTickOptions]);

  const { l2Book, hasOrderBook } = useL2Book({
    nSigFigs: l2SubscriptionOptions.nSigFigs,
    mantissa: l2SubscriptionOptions.mantissa,
  });

  useEffect(() => {
    if (hasOrderBook && l2Book) {
      markPerpsColdStartPerfOnce('ui_order_book_ready', {
        coin: l2Book.coin,
        bidLevels: l2Book.bids.length,
        askLevels: l2Book.asks.length,
      });
    }
  }, [hasOrderBook, l2Book]);

  useEffect(() => {
    const coin = activeTradeInstrument.coin;
    if (!coin) {
      return;
    }
    let cancelled = false;
    const getRequestOptions = async () => {
      if (orderBookTickOptions[coin]) {
        return l2SubscriptionOptions;
      }
      const storedOptions =
        await backgroundApiProxy.simpleDb.perp.getOrderBookTickOptions();
      const stored = storedOptions[coin];
      if (!stored) {
        return l2SubscriptionOptions;
      }
      markPerpsColdStartPerfOnce('ui_l2_book_persisted_tick_loaded_first', {
        coin,
        nSigFigs: stored.nSigFigs,
        mantissa: stored.mantissa,
      });
      return {
        nSigFigs: stored.nSigFigs ?? null,
        mantissa: stored.mantissa === undefined ? undefined : stored.mantissa,
      };
    };
    const applyBook = (
      book: Awaited<
        ReturnType<
          typeof backgroundApiProxy.serviceHyperliquid.getL2BookSnapshotCache
        >
      >,
    ) => {
      if (cancelled || !book) {
        return;
      }
      void actionsRef.current.updateL2Book(book);
    };

    void (async () => {
      const requestOptions = await getRequestOptions();
      const requestKey = [
        activeTradeInstrument.mode,
        coin,
        requestOptions.nSigFigs ?? '',
        requestOptions.mantissa ?? '',
      ].join(':');
      if (cancelled || l2BookSnapshotRequestKeyRef.current === requestKey) {
        return;
      }
      l2BookSnapshotRequestKeyRef.current = requestKey;
      tracePerpsMobileLayout('orderBook.cache.request', {
        entry,
        mode: activeTradeInstrument.mode,
        coin,
        nSigFigs: requestOptions.nSigFigs,
        mantissa: requestOptions.mantissa,
      });
      try {
        const book =
          await backgroundApiProxy.serviceHyperliquid.getL2BookSnapshotCache({
            coin,
            nSigFigs: requestOptions.nSigFigs,
            mantissa: requestOptions.mantissa,
          });
        applyBook(book);
        tracePerpsMobileLayout('orderBook.cache.result', {
          entry,
          mode: activeTradeInstrument.mode,
          coin,
          hasBook: Boolean(book),
          bookCoin: book?.coin,
          bidLevels: book?.levels?.[0]?.length ?? 0,
          askLevels: book?.levels?.[1]?.length ?? 0,
        });
        if (book) {
          markPerpsColdStartPerfOnce('ui_l2_book_cache_applied_first', {
            coin: book.coin,
            bidLevels: book.levels?.[0]?.length ?? 0,
            askLevels: book.levels?.[1]?.length ?? 0,
          });
        }
      } catch (error) {
        markPerpsColdStartPerfOnce('ui_l2_book_cache_error_first');
        defaultLogger.perp.hyperliquid.cacheSnapshotError({
          type: 'l2_book_ui_cache',
          error,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    actionsRef,
    activeTradeInstrument.coin,
    activeTradeInstrument.mode,
    entry,
    orderBookTickOptions,
    l2SubscriptionOptions,
  ]);

  const tickOptionsData = useTickOptions({
    symbol: l2Book?.coin,
    bids: l2Book?.bids ?? [],
    asks: l2Book?.asks ?? [],
  });
  const {
    tickOptions,
    selectedTickOption,
    setSelectedTickOption,
    priceDecimals,
    sizeDecimals,
  } = tickOptionsData;

  const handleTickOptionChange = useCallback(
    (option: ITickParam) => {
      setSelectedTickOption(option);
    },
    [setSelectedTickOption],
  );

  const handleLevelSelect = useCallback(
    (selection: IOrderBookSelection) => {
      const updates: Partial<ITradingFormData> = {
        price: selection.price,
      };

      if (formData.type !== 'limit') {
        updates.type = 'limit';
      }

      actionsRef.current.updateTradingForm(updates);
    },
    [actionsRef, formData.type],
  );

  const mobileMaxLevelsPerSide = useMemo(() => {
    if (shouldShowEnableTradingButton) return 7;
    if (activeTradeInstrument.mode === 'spot')
      return MOBILE_SPOT_MAX_LEVELS_PER_SIDE;
    if (formData.hasTpsl) return 9;
    return 7;
  }, [
    activeTradeInstrument.mode,
    formData.hasTpsl,
    shouldShowEnableTradingButton,
  ]);

  const desktopMaxLevelsPerSide = useMemo(
    () => propMaxLevelsPerSide ?? 18,
    [propMaxLevelsPerSide],
  );

  const handleTraceLayout = useCallback(
    (name: string, event: LayoutChangeEvent) => {
      if (gtMd) {
        return;
      }
      const rect = getPerpsMobileLayoutTraceRect(event);
      if (
        isPerpsMobileLayoutTraceRectChanged(layoutRectsRef.current[name], rect)
      ) {
        tracePerpsMobileLayout(`orderBook.${name}.layout`, {
          rect,
          entry: entry ?? 'perpTab',
          coin: activeTradeInstrument.coin,
          mode: activeTradeInstrument.mode,
          hasOrderBook,
          mobileMaxLevelsPerSide,
          shouldShowEnableTradingButton,
        });
        layoutRectsRef.current[name] = rect;
      }
    },
    [
      activeTradeInstrument.coin,
      activeTradeInstrument.mode,
      entry,
      gtMd,
      hasOrderBook,
      mobileMaxLevelsPerSide,
      shouldShowEnableTradingButton,
    ],
  );

  useEffect(() => {
    if (gtMd) {
      return;
    }
    const signature = [
      entry ?? 'perpTab',
      activeTradeInstrument.mode,
      activeTradeInstrument.coin,
      hasOrderBook ? 'book' : 'loading',
      l2Book?.coin ?? '',
      l2Book?.bids.length ?? 0,
      l2Book?.asks.length ?? 0,
      shouldShowEnableTradingButton ? 'enableTrading' : 'trade',
      formData.hasTpsl ? 'tpsl' : 'noTpsl',
      mobileMaxLevelsPerSide,
    ].join('|');
    if (renderStateSignatureRef.current === signature) {
      return;
    }
    renderStateSignatureRef.current = signature;
    tracePerpsMobileLayout('orderBook.render.state', {
      entry: entry ?? 'perpTab',
      coin: activeTradeInstrument.coin,
      mode: activeTradeInstrument.mode,
      hasOrderBook,
      bookCoin: l2Book?.coin,
      bidLevels: l2Book?.bids.length ?? 0,
      askLevels: l2Book?.asks.length ?? 0,
      mobileMaxLevelsPerSide,
      shouldShowEnableTradingButton,
      hasTpsl: formData.hasTpsl,
    });
  }, [
    activeTradeInstrument.coin,
    activeTradeInstrument.mode,
    entry,
    formData.hasTpsl,
    gtMd,
    hasOrderBook,
    l2Book?.asks.length,
    l2Book?.bids.length,
    l2Book?.coin,
    mobileMaxLevelsPerSide,
    shouldShowEnableTradingButton,
  ]);

  const mobileOrderBook = useMemo(() => {
    if (!hasOrderBook || !l2Book) return null;
    if (gtMd) return null;
    if (entry === 'perpMobileMarket') {
      return (
        <OrderBook
          horizontal
          symbol={l2Book.coin}
          bids={l2Book.bids}
          asks={l2Book.asks}
          maxLevelsPerSide={13}
          selectedTickOption={selectedTickOption}
          onTickOptionChange={handleTickOptionChange}
          tickOptions={tickOptions}
          showTickSelector
          priceDecimals={priceDecimals}
          sizeDecimals={sizeDecimals}
          onSelectLevel={handleLevelSelect}
          loadingNode={
            <DefaultLoadingNode
              variant="mobileHorizontal"
              maxLevelsPerSide={13}
            />
          }
          style={{
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 8,
            paddingBottom: 8,
          }}
          variant="mobileHorizontal"
        />
      );
    }
    return (
      <YStack
        gap="$1"
        onLayout={(event) => handleTraceLayout('mobileVerticalReady', event)}
      >
        <MobileHeaderMemo />
        <OrderBookMobile
          symbol={l2Book.coin}
          bids={l2Book.bids}
          asks={l2Book.asks}
          maxLevelsPerSide={mobileMaxLevelsPerSide}
          selectedTickOption={selectedTickOption}
          onTickOptionChange={handleTickOptionChange}
          tickOptions={tickOptions}
          showTickSelector
          priceDecimals={priceDecimals}
          sizeDecimals={sizeDecimals}
          onSelectLevel={handleLevelSelect}
          variant="mobileVertical"
        />
      </YStack>
    );
  }, [
    entry,
    gtMd,
    handleTraceLayout,
    handleTickOptionChange,
    l2Book,
    handleLevelSelect,
    selectedTickOption,
    hasOrderBook,
    mobileMaxLevelsPerSide,
    tickOptions,
    priceDecimals,
    sizeDecimals,
  ]);

  if (!hasOrderBook || !l2Book) {
    let loadingVariant = 'desktop';
    if (!gtMd) {
      loadingVariant =
        entry === 'perpMobileMarket' ? 'mobileHorizontal' : 'mobileVertical';
    }
    if (!gtMd && loadingVariant === 'mobileVertical') {
      return (
        <YStack
          flex={1}
          bg="$bgApp"
          gap="$1"
          onLayout={(event) =>
            handleTraceLayout('mobileVerticalLoading', event)
          }
        >
          <MobileHeaderMemo showPlaceholder />
          <OrderBookMobile
            symbol={activeTradeInstrument.coin}
            bids={[]}
            asks={[]}
            maxLevelsPerSide={mobileMaxLevelsPerSide}
            selectedTickOption={selectedTickOption}
            onTickOptionChange={handleTickOptionChange}
            tickOptions={tickOptions}
            showTickSelector
            priceDecimals={priceDecimals}
            sizeDecimals={sizeDecimals}
            onSelectLevel={handleLevelSelect}
            variant="mobileVertical"
          />
        </YStack>
      );
    }
    if (!gtMd && loadingVariant === 'mobileHorizontal') {
      return (
        <YStack
          flex={1}
          bg="$bgApp"
          onLayout={(event) =>
            handleTraceLayout('mobileHorizontalLoading', event)
          }
        >
          <OrderBook
            horizontal
            symbol={activeTradeInstrument.coin}
            bids={[]}
            asks={[]}
            maxLevelsPerSide={13}
            selectedTickOption={selectedTickOption}
            onTickOptionChange={handleTickOptionChange}
            tickOptions={tickOptions}
            showTickSelector
            priceDecimals={priceDecimals}
            sizeDecimals={sizeDecimals}
            onSelectLevel={handleLevelSelect}
            loadingNode={
              <DefaultLoadingNode
                variant="mobileHorizontal"
                maxLevelsPerSide={13}
              />
            }
            variant="mobileHorizontal"
          />
        </YStack>
      );
    }
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <DefaultLoadingNode
          variant={loadingVariant as IOrderBookVariant}
          symbol={
            loadingVariant === 'mobileVertical'
              ? (l2Book?.coin ?? activeTradeInstrument.coin)
              : undefined
          }
          isSpot={activeTradeInstrument.mode === 'spot'}
          spotUniverse={
            activeTradeInstrument.mode === 'spot'
              ? activeTradeInstrument.universe
              : undefined
          }
          midPrice={midPrice}
          maxLevelsPerSide={
            loadingVariant === 'mobileVertical'
              ? mobileMaxLevelsPerSide
              : undefined
          }
        />
      </YStack>
    );
  }

  const content = (
    <YStack
      flex={1}
      bg="$bgApp"
      onLayout={(event) => handleTraceLayout('rootReady', event)}
    >
      {gtMd ? (
        <OrderBook
          symbol={l2Book.coin}
          horizontal={false}
          bids={l2Book.bids}
          asks={l2Book.asks}
          maxLevelsPerSide={desktopMaxLevelsPerSide}
          initialContainerHeight={initialOrderBookHeight}
          selectedTickOption={selectedTickOption}
          onTickOptionChange={handleTickOptionChange}
          tickOptions={tickOptions}
          showTickSelector
          priceDecimals={priceDecimals}
          sizeDecimals={sizeDecimals}
          onSelectLevel={handleLevelSelect}
          variant="web"
        />
      ) : (
        mobileOrderBook
      )}
    </YStack>
  );
  return (
    <DebugRenderTracker name="PerpOrderBook" position="top-left">
      {content}
    </DebugRenderTracker>
  );
}
