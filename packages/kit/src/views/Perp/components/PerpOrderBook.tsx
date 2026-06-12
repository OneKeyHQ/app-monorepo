import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  usePerpsL2BookColdCacheAtom,
  useTradingFormAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsShouldShowEnableTradingButtonAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { markPerpsColdStartPerfOnce } from '@onekeyhq/shared/src/performance/perpsColdStartPerf';
import { getPerpsOrderBookTickOptionWithCache } from '@onekeyhq/shared/src/utils/perpsOrderBookTickOptionsCache';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';

import { useFundingCountdown } from '../hooks/useFundingCountdown';
import {
  type IL2BookData,
  getFreshL2BookSnapshotFromSwr,
  normalizeL2BookData,
  useL2Book,
} from '../hooks/usePerpMarketData';
import { usePerpsActiveAssetCtxDisplay } from '../hooks/usePerpsActiveAssetCtxDisplay';
import { useTradingPrice } from '../hooks/useTradingPrice';
import {
  getFreshL2BookSnapshotFromColdCache,
  getPerpsL2BookColdCacheGlobalSnapshot,
  isPerpsL2BookInteractive,
} from '../utils/l2BookFreshness';
import {
  type IPerpsMobileLayoutTraceRect,
  getPerpsMobileLayoutTraceRect,
  isPerpsMobileLayoutTraceRectChanged,
  tracePerpsMobileLayout,
} from '../utils/mobileLayoutTrace';
import {
  PERPS_ORDER_BOOK_MOBILE_VISUAL_FRAME_MS,
  getPerpsOrderBookVisualSnapshotDelayMs,
} from '../utils/orderBookVisualScheduler';

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

function DefaultOrderBookLoadingNode({
  isSpot,
  maxLevelsPerSide,
  spotUniverse,
  symbol,
  variant,
}: {
  isSpot?: boolean;
  maxLevelsPerSide?: number;
  spotUniverse?: Parameters<typeof DefaultLoadingNode>[0]['spotUniverse'];
  symbol?: string;
  variant: IOrderBookVariant;
}) {
  const { midPrice } = useTradingPrice();
  return (
    <DefaultLoadingNode
      isSpot={isSpot}
      maxLevelsPerSide={maxLevelsPerSide}
      midPrice={midPrice}
      spotUniverse={spotUniverse}
      symbol={symbol}
      variant={variant}
    />
  );
}

function usePublishVisualL2BookSnapshot({
  book,
  enabled,
  onPublish,
}: {
  book: IL2BookData | null;
  enabled: boolean;
  onPublish: (book: IL2BookData | null) => void;
}) {
  const visualBookRef = useRef<IL2BookData | null>(book);
  const pendingBookRef = useRef<IL2BookData | null>(null);
  const lastPublishedAtRef = useRef<number | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const publishBook = useCallback(
    (nextBook: IL2BookData | null, publishedAt: number) => {
      pendingBookRef.current = null;
      visualBookRef.current = nextBook;
      lastPublishedAtRef.current = nextBook ? publishedAt : undefined;
      onPublish(nextBook);
    },
    [onPublish],
  );

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      publishBook(book, Date.now());
      return undefined;
    }

    if (!book) {
      clearTimer();
      publishBook(null, Date.now());
      return undefined;
    }

    const currentVisualBook = visualBookRef.current;
    const shouldPublishImmediately =
      !currentVisualBook || currentVisualBook.coin !== book.coin;
    const now = Date.now();
    const delayMs = shouldPublishImmediately
      ? 0
      : getPerpsOrderBookVisualSnapshotDelayMs({
          frameMs: PERPS_ORDER_BOOK_MOBILE_VISUAL_FRAME_MS,
          lastPublishedAt: lastPublishedAtRef.current,
          now,
        });

    pendingBookRef.current = book;

    if (delayMs === 0) {
      clearTimer();
      publishBook(book, now);
      return undefined;
    }

    if (!timerRef.current) {
      const expectedCoin = book.coin;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pendingBook = pendingBookRef.current;
        const visibleCoin = visualBookRef.current?.coin;
        if (
          pendingBook?.coin === expectedCoin &&
          visibleCoin === expectedCoin
        ) {
          publishBook(pendingBook, Date.now());
        } else {
          pendingBookRef.current = null;
        }
      }, delayMs);
    }

    return undefined;
  }, [book, clearTimer, enabled, publishBook]);

  useEffect(() => clearTimer, [clearTimer]);
}

function PerpOrderBookDataBridge({
  enableVisualSnapshot,
  onInteractiveChange,
  onVisualBookChange,
  subscriptionOptions,
}: {
  enableVisualSnapshot: boolean;
  onInteractiveChange: (isInteractive: boolean) => void;
  onVisualBookChange: (book: IL2BookData | null) => void;
  subscriptionOptions: IL2BookOptions;
}) {
  const { l2Book, hasOrderBook, isOrderBookInteractive } = useL2Book({
    nSigFigs: subscriptionOptions.nSigFigs,
    mantissa: subscriptionOptions.mantissa,
  });
  const isInteractive =
    hasOrderBook && Boolean(l2Book) && isOrderBookInteractive;

  usePublishVisualL2BookSnapshot({
    book: l2Book,
    enabled: enableVisualSnapshot,
    onPublish: onVisualBookChange,
  });

  useEffect(() => {
    onInteractiveChange(isInteractive);
  }, [isInteractive, onInteractiveChange]);

  useEffect(() => {
    if (isInteractive && l2Book) {
      markPerpsColdStartPerfOnce('ui_order_book_ready', {
        coin: l2Book.coin,
        bidLevels: l2Book.bids.length,
        askLevels: l2Book.asks.length,
      });
    }
  }, [
    isInteractive,
    l2Book,
    l2Book?.asks.length,
    l2Book?.bids.length,
    l2Book?.coin,
  ]);

  return null;
}
const PerpOrderBookDataBridgeMemo = memo(PerpOrderBookDataBridge);

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
  const [l2BookColdCache] = usePerpsL2BookColdCacheAtom();
  const [shouldShowEnableTradingButton] =
    usePerpsShouldShowEnableTradingButtonAtom();

  const l2SubscriptionOptions = useMemo(() => {
    const coin = activeTradeInstrument.coin;
    if (!coin) {
      return { nSigFigs: null, mantissa: undefined };
    }
    const stored = getPerpsOrderBookTickOptionWithCache({
      coin,
      options: orderBookTickOptions,
    });
    const nSigFigs = stored?.nSigFigs ?? null;
    const mantissa =
      stored?.mantissa === undefined ? undefined : stored.mantissa;
    return { nSigFigs, mantissa };
  }, [activeTradeInstrument.coin, orderBookTickOptions]);

  const enableVisualSnapshot = !gtMd;
  const [renderL2Book, setRenderL2Book] = useState<IL2BookData | null>(null);
  const [isOrderBookInteractive, setIsOrderBookInteractive] = useState(false);
  const initialCachedL2Book = useMemo(() => {
    const coin = activeTradeInstrument.coin;
    if (!coin) {
      return null;
    }
    const options = {
      nSigFigs: l2SubscriptionOptions.nSigFigs,
      mantissa: l2SubscriptionOptions.mantissa,
    };
    const coldCachedBook = getFreshL2BookSnapshotFromColdCache({
      coin,
      options,
      cache: l2BookColdCache,
    });
    const globalColdCachedBook =
      coldCachedBook ??
      getFreshL2BookSnapshotFromColdCache({
        coin,
        options,
        cache: getPerpsL2BookColdCacheGlobalSnapshot(),
      });
    return normalizeL2BookData({
      expectedCoin: coin,
      bookData:
        globalColdCachedBook ??
        getFreshL2BookSnapshotFromSwr({
          coin,
          options,
        }),
    });
  }, [
    activeTradeInstrument.coin,
    l2BookColdCache,
    l2SubscriptionOptions.mantissa,
    l2SubscriptionOptions.nSigFigs,
  ]);
  const activeRenderL2Book =
    renderL2Book?.coin === activeTradeInstrument.coin ? renderL2Book : null;
  const visibleL2Book = activeRenderL2Book ?? initialCachedL2Book;
  const hasRenderOrderBook = Boolean(visibleL2Book);

  const handleVisualBookChange = useCallback((book: IL2BookData | null) => {
    setRenderL2Book((prevBook) => (prevBook === book ? prevBook : book));
  }, []);

  const handleOrderBookInteractiveChange = useCallback(
    (nextIsInteractive: boolean) => {
      setIsOrderBookInteractive((prevIsInteractive) =>
        prevIsInteractive === nextIsInteractive
          ? prevIsInteractive
          : nextIsInteractive,
      );
    },
    [],
  );

  // Do NOT reset renderL2Book/isOrderBookInteractive on coin/options change:
  // the bridge only re-reports isInteractive on a boolean flip, so a reset
  // landing after a `true` report leaves it stuck out of sync. Render-time gates
  // (activeRenderL2Book coin filter + freshness checks) already cover staleness.

  useEffect(() => {
    const coin = activeTradeInstrument.coin;
    if (!coin) {
      return;
    }
    let cancelled = false;
    const getRequestOptions = async () => {
      const cachedStored = getPerpsOrderBookTickOptionWithCache({
        coin,
        options: orderBookTickOptions,
      });
      if (cachedStored) {
        return {
          nSigFigs: cachedStored.nSigFigs ?? null,
          mantissa:
            cachedStored.mantissa === undefined
              ? undefined
              : cachedStored.mantissa,
        };
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
    symbol: visibleL2Book?.coin,
    bids: visibleL2Book?.bids ?? [],
    asks: visibleL2Book?.asks ?? [],
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
      if (
        !isPerpsL2BookInteractive({
          bookTime: visibleL2Book?.time,
          bookReceivedAt: visibleL2Book?.localReceivedAt,
        })
      ) {
        return;
      }

      const updates: Partial<ITradingFormData> = {
        price: selection.price,
      };

      if (formData.type !== 'limit') {
        updates.type = 'limit';
      }

      actionsRef.current.updateTradingForm(updates);
    },
    [
      actionsRef,
      formData.type,
      visibleL2Book?.localReceivedAt,
      visibleL2Book?.time,
    ],
  );
  const isVisibleOrderBookInteractive = useMemo(
    () =>
      isOrderBookInteractive &&
      isPerpsL2BookInteractive({
        bookTime: visibleL2Book?.time,
        bookReceivedAt: visibleL2Book?.localReceivedAt,
      }),
    [
      isOrderBookInteractive,
      visibleL2Book?.localReceivedAt,
      visibleL2Book?.time,
    ],
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
          hasOrderBook: hasRenderOrderBook,
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
      hasRenderOrderBook,
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
      hasRenderOrderBook ? 'book' : 'loading',
      visibleL2Book?.coin ?? '',
      visibleL2Book?.bids.length ?? 0,
      visibleL2Book?.asks.length ?? 0,
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
      hasOrderBook: hasRenderOrderBook,
      bookCoin: visibleL2Book?.coin,
      bidLevels: visibleL2Book?.bids.length ?? 0,
      askLevels: visibleL2Book?.asks.length ?? 0,
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
    hasRenderOrderBook,
    visibleL2Book?.asks.length,
    visibleL2Book?.bids.length,
    visibleL2Book?.coin,
    mobileMaxLevelsPerSide,
    shouldShowEnableTradingButton,
  ]);

  const mobileOrderBook = useMemo(() => {
    if (!hasRenderOrderBook || !visibleL2Book) return null;
    if (gtMd) return null;
    if (entry === 'perpMobileMarket') {
      return (
        <OrderBook
          horizontal
          symbol={visibleL2Book.coin}
          bids={visibleL2Book.bids}
          asks={visibleL2Book.asks}
          maxLevelsPerSide={13}
          selectedTickOption={selectedTickOption}
          onTickOptionChange={handleTickOptionChange}
          tickOptions={tickOptions}
          showTickSelector
          priceDecimals={priceDecimals}
          sizeDecimals={sizeDecimals}
          onSelectLevel={
            isVisibleOrderBookInteractive ? handleLevelSelect : undefined
          }
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
          symbol={visibleL2Book.coin}
          bids={visibleL2Book.bids}
          asks={visibleL2Book.asks}
          maxLevelsPerSide={mobileMaxLevelsPerSide}
          selectedTickOption={selectedTickOption}
          onTickOptionChange={handleTickOptionChange}
          tickOptions={tickOptions}
          showTickSelector
          priceDecimals={priceDecimals}
          sizeDecimals={sizeDecimals}
          onSelectLevel={
            isVisibleOrderBookInteractive ? handleLevelSelect : undefined
          }
          variant="mobileVertical"
        />
      </YStack>
    );
  }, [
    entry,
    gtMd,
    handleTraceLayout,
    handleTickOptionChange,
    visibleL2Book,
    handleLevelSelect,
    selectedTickOption,
    hasRenderOrderBook,
    isVisibleOrderBookInteractive,
    mobileMaxLevelsPerSide,
    tickOptions,
    priceDecimals,
    sizeDecimals,
  ]);

  const dataBridge = (
    <PerpOrderBookDataBridgeMemo
      enableVisualSnapshot={enableVisualSnapshot}
      onInteractiveChange={handleOrderBookInteractiveChange}
      onVisualBookChange={handleVisualBookChange}
      subscriptionOptions={l2SubscriptionOptions}
    />
  );

  if (!hasRenderOrderBook || !visibleL2Book) {
    let loadingVariant = 'desktop';
    if (!gtMd) {
      loadingVariant =
        entry === 'perpMobileMarket' ? 'mobileHorizontal' : 'mobileVertical';
    }
    if (!gtMd && loadingVariant === 'mobileVertical') {
      return (
        <>
          {dataBridge}
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
              onSelectLevel={undefined}
              variant="mobileVertical"
            />
          </YStack>
        </>
      );
    }
    if (!gtMd && loadingVariant === 'mobileHorizontal') {
      return (
        <>
          {dataBridge}
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
              onSelectLevel={undefined}
              loadingNode={
                <DefaultLoadingNode
                  variant="mobileHorizontal"
                  maxLevelsPerSide={13}
                />
              }
              variant="mobileHorizontal"
            />
          </YStack>
        </>
      );
    }
    return (
      <>
        {dataBridge}
        <YStack flex={1} justifyContent="center" alignItems="center">
          <DefaultOrderBookLoadingNode
            variant={loadingVariant as IOrderBookVariant}
            symbol={
              loadingVariant === 'mobileVertical'
                ? activeTradeInstrument.coin
                : undefined
            }
            isSpot={activeTradeInstrument.mode === 'spot'}
            spotUniverse={
              activeTradeInstrument.mode === 'spot'
                ? activeTradeInstrument.universe
                : undefined
            }
            maxLevelsPerSide={
              loadingVariant === 'mobileVertical'
                ? mobileMaxLevelsPerSide
                : undefined
            }
          />
        </YStack>
      </>
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
          symbol={visibleL2Book.coin}
          horizontal={false}
          bids={visibleL2Book.bids}
          asks={visibleL2Book.asks}
          maxLevelsPerSide={desktopMaxLevelsPerSide}
          initialContainerHeight={initialOrderBookHeight}
          selectedTickOption={selectedTickOption}
          onTickOptionChange={handleTickOptionChange}
          tickOptions={tickOptions}
          showTickSelector
          priceDecimals={priceDecimals}
          sizeDecimals={sizeDecimals}
          onSelectLevel={
            isVisibleOrderBookInteractive ? handleLevelSelect : undefined
          }
          variant="web"
        />
      ) : (
        mobileOrderBook
      )}
    </YStack>
  );
  return (
    <>
      {dataBridge}
      <DebugRenderTracker name="PerpOrderBook" position="top-left">
        {content}
      </DebugRenderTracker>
    </>
  );
}
