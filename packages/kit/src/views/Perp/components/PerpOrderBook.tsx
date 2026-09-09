import {
  cloneElement,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactElement, ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { type LayoutChangeEvent, StyleSheet } from 'react-native';

import {
  Button,
  DashText,
  DebugRenderTracker,
  Dialog,
  Divider,
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
  usePerpsMidByCoin,
  useTradingFormAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsCommonConfigPersistAtom,
  usePerpsShouldShowEnableTradingButtonAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { markPerpsColdStartPerfOnce } from '@onekeyhq/shared/src/performance/perpsColdStartPerf';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import { getPerpsOrderBookTickOptionWithCache } from '@onekeyhq/shared/src/utils/perpsOrderBookTickOptionsCache';
import {
  formatPriceToSignificantDigits,
  formatSpotPriceToValid,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useFundingCountdown } from '../hooks/useFundingCountdown';
import {
  type IL2BookData,
  getFreshL2BookSnapshotFromSwr,
  normalizeL2BookData,
  useL2Book,
} from '../hooks/usePerpMarketData';
import { usePerpsAccountDisplayState } from '../hooks/usePerpsAccountDisplayState';
import { usePerpsActiveAssetCtxDisplay } from '../hooks/usePerpsActiveAssetCtxDisplay';
import { useShowPortfolio } from '../hooks/useShowPortfolio';
import { PerpsProviderMirror } from '../PerpsProviderMirror';
import { shouldShowPerpsFirstDepositPrompt } from '../utils/enableTradingDialogConfirm';
import {
  getFreshL2BookSnapshotFromColdCache,
  getPerpsL2BookColdCacheGlobalSnapshot,
  isL2BookForTarget,
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
import { PerpOrderBookMobileVerticalShell } from './PerpOrderBookMobileVerticalShell';

import type { ITickParam } from './OrderBook/tickSizeUtils';

const FUNDING_DIALOG_CLOSE_DURATION_MS = 100;

function FundingDialogTrigger({
  title,
  renderTrigger,
  renderContent,
}: {
  title: string;
  renderTrigger: ReactElement<{ onPress?: () => void }>;
  renderContent: (closeDialog: () => Promise<void> | void) => ReactNode;
}) {
  const handlePress = useCallback(() => {
    const dialogInstanceRef: {
      current?: ReturnType<typeof Dialog.show>;
    } = {};
    const closeDialog = () => dialogInstanceRef.current?.close();
    dialogInstanceRef.current = Dialog.show({
      title,
      showFooter: false,
      contentContainerProps: { p: '$0' },
      sheetProps: { transition: '100ms' },
      sheetOverlayProps: { transition: '100ms' },
      renderContent: renderContent(closeDialog),
    });
  }, [renderContent, title]);

  return cloneElement(renderTrigger, { onPress: handlePress });
}

function FundingDialogContent({
  closeDialog,
}: {
  closeDialog: () => Promise<void> | void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { showPortfolio: showFundingAnalysis } = useShowPortfolio({
    initialChartType: 'funding',
  });
  const countdown = useFundingCountdown();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const { assetCtx } = usePerpsActiveAssetCtxDisplay(
    activeTradeInstrument.coin,
  );
  const fundingRate = assetCtx?.ctx?.fundingRate || '0';
  const fundingRateNumber = parseFloat(fundingRate);
  const hourlyFundingRate = (fundingRateNumber * 100).toFixed(4);
  const dailyFundingRate = (fundingRateNumber * 100 * 24).toFixed(4);
  const weeklyFundingRate = (fundingRateNumber * 100 * 24 * 7).toFixed(4);
  const monthlyFundingRate = (fundingRateNumber * 100 * 24 * 30).toFixed(4);
  const annualizedFundingRate = (fundingRateNumber * 100 * 24 * 365).toFixed(4);
  const fundingColor = fundingRateNumber >= 0 ? '$green11' : '$red11';

  const handleViewFundingHistory = useCallback(() => {
    void closeDialog();
    setTimeout(() => {
      navigation.push(EModalPerpRoutes.MobilePerpMarket, {
        initialTab: 'funding',
      });
    }, FUNDING_DIALOG_CLOSE_DURATION_MS);
  }, [closeDialog, navigation]);

  const handleViewFundingAnalysis = useCallback(() => {
    void closeDialog();
    setTimeout(() => {
      void showFundingAnalysis();
    }, FUNDING_DIALOG_CLOSE_DURATION_MS);
  }, [closeDialog, showFundingAnalysis]);

  return (
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
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({
                  id: ETranslations.perps_hourly,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium" color="$textSubdued">
                ({countdown})
              </SizableText>
            </XStack>
            <SizableText size="$bodyMdMedium" color={fundingColor}>
              {hourlyFundingRate}%
            </SizableText>
          </XStack>
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage({
                id: ETranslations.earn_daily,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium" color={fundingColor}>
              {dailyFundingRate}%
            </SizableText>
          </XStack>
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage({
                id: ETranslations.earn_weekly,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium" color={fundingColor}>
              {weeklyFundingRate}%
            </SizableText>
          </XStack>
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage({
                id: ETranslations.earn_monthly,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium" color={fundingColor}>
              {monthlyFundingRate}%
            </SizableText>
          </XStack>
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage({
                id: ETranslations.earn_annually,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium" color={fundingColor}>
              {annualizedFundingRate}%
            </SizableText>
          </XStack>
        </YStack>
      </YStack>
      <FundingDialogDivider />

      <YStack gap="$2">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_trades_history_direction,
          })}
        </SizableText>
        {fundingRateNumber >= 0 ? (
          <SizableText size="$bodyMdMedium" color="$text">
            <SizableText size="$bodyMdMedium" color="$green11">
              {intl.formatMessage({
                id: ETranslations.perp_ticker_direction_funding_tooltip_long,
              })}
            </SizableText>{' '}
            {intl.formatMessage({
              id: ETranslations.perp_ticker_direction_funding_tooltip_pays,
            })}{' '}
            <SizableText size="$bodyMdMedium" color="$red11">
              {intl.formatMessage({
                id: ETranslations.perp_ticker_direction_funding_tooltip_short,
              })}
            </SizableText>
          </SizableText>
        ) : (
          <SizableText size="$bodyMdMedium" color="$text">
            <SizableText size="$bodyMdMedium" color="$red11">
              {intl.formatMessage({
                id: ETranslations.perp_ticker_direction_funding_tooltip_short,
              })}
            </SizableText>{' '}
            {intl.formatMessage({
              id: ETranslations.perp_ticker_direction_funding_tooltip_pays,
            })}{' '}
            <SizableText size="$bodyMdMedium" color="$green11">
              {intl.formatMessage({
                id: ETranslations.perp_ticker_direction_funding_tooltip_long,
              })}
            </SizableText>
          </SizableText>
        )}
      </YStack>

      <FundingDialogDivider />
      <YStack gap="$2">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_funding_rate_tip0,
          })}
        </SizableText>
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({
            id: ETranslations.perp_funding_rate_tip1,
          })}
        </SizableText>
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({
            id: ETranslations.perp_funding_rate_tip2,
          })}
        </SizableText>
      </YStack>
      <YStack gap="$3" width="100%">
        <Button
          size="medium"
          variant="secondary"
          width="100%"
          testID="perp-view-funding-history-button"
          onPress={handleViewFundingHistory}
        >
          {intl.formatMessage({
            id: ETranslations.export_history__action,
          })}
        </Button>
        <Button
          size="medium"
          variant="secondary"
          width="100%"
          testID="perp-view-funding-analysis-button"
          onPress={handleViewFundingAnalysis}
        >
          {intl.formatMessage({
            id: ETranslations.perp_view_funding_analysis__action,
          })}
        </Button>
      </YStack>
    </YStack>
  );
}

function FundingDialogDivider() {
  if (!platformEnv.isNative) {
    return <Divider />;
  }

  return (
    <Divider
      bg="$borderSubdued"
      borderBottomWidth={0}
      flex={0}
      h={StyleSheet.hairlineWidth}
      maxHeight={StyleSheet.hairlineWidth}
      w="100%"
      y={0}
    />
  );
}

function MobileHeader() {
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
    showSkeleton,
  ]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const rect = getPerpsMobileLayoutTraceRect(event);
      if (isPerpsMobileLayoutTraceRectChanged(layoutRef.current, rect)) {
        tracePerpsMobileLayout('orderBook.mobileHeader.layout', {
          rect,
          showSkeleton,
          coin: activeTradeInstrument.coin,
        });
        layoutRef.current = rect;
      }
    },
    [activeTradeInstrument.coin, showSkeleton],
  );

  if (isSpot) {
    return null;
  }

  return (
    <FundingDialogTrigger
      title={intl.formatMessage({
        id: ETranslations.perp_position_funding,
      })}
      renderTrigger={
        <YStack
          alignItems="flex-start"
          mb="$2"
          minHeight={32}
          justifyContent="center"
          onLayout={handleLayout}
        >
          <DashText
            fontSize={10}
            color="$textSubdued"
            dashColor="$borderSubdued"
            dashThickness={0.5}
            lineHeight={16}
          >
            {intl.formatMessage({
              id: ETranslations.perp_token_bar_Funding,
            })}
          </DashText>

          {showSkeleton ? (
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
      renderContent={(closeDialog) => (
        <PerpsProviderMirror>
          <FundingDialogContent closeDialog={closeDialog} />
        </PerpsProviderMirror>
      )}
    />
  );
}
const MobileHeaderMemo = memo(MobileHeader);
const MOBILE_SPOT_MAX_LEVELS_PER_SIDE = 4;

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
  const tickReferencePrice = usePerpsMidByCoin(activeTradeInstrument.coin);
  const [formData] = useTradingFormAtom();
  const [orderBookTickOptions] = useOrderBookTickOptionsAtom();
  const [l2BookColdCache] = usePerpsL2BookColdCacheAtom();
  const [shouldShowEnableTradingButton] =
    usePerpsShouldShowEnableTradingButtonAtom();
  const {
    isLiveStatusPending,
    perpsAccountStatus,
    shouldShowConnectWalletPrompt: shouldCompactOrderBookForConnectWallet,
  } = usePerpsAccountDisplayState();
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const shouldCompactOrderBookForFirstDeposit = Boolean(
    !perpConfigCommon?.ipDisablePerp &&
    shouldShowPerpsFirstDepositPrompt({
      status: perpsAccountStatus,
      isLiveStatusPending,
      isPerpActionDisabled: Boolean(perpConfigCommon?.disablePerpActionPerp),
    }),
  );

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
  const hasInitializedTickOption = useMemo(
    () =>
      Boolean(
        getPerpsOrderBookTickOptionWithCache({
          coin: activeTradeInstrument.coin,
          options: orderBookTickOptions,
        }),
      ),
    [activeTradeInstrument.coin, orderBookTickOptions],
  );

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
  const activeRenderL2Book = isL2BookForTarget(
    renderL2Book,
    activeTradeInstrument.coin,
    l2SubscriptionOptions,
  )
    ? renderL2Book
    : null;
  const candidateL2Book = activeRenderL2Book ?? initialCachedL2Book;
  const visibleL2Book = hasInitializedTickOption ? candidateL2Book : null;
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
  // (activeRenderL2Book target filter + freshness checks) already cover staleness.

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

  const activeSizeDecimals =
    activeTradeInstrument.mode === 'spot'
      ? activeTradeInstrument.universe?.baseSzDecimals
      : activeTradeInstrument.universe?.szDecimals;
  const tickOptionsData = useTickOptions({
    symbol: activeTradeInstrument.coin,
    bids: candidateL2Book?.bids ?? [],
    asks: candidateL2Book?.asks ?? [],
    referencePrice: tickReferencePrice,
    szDecimals: activeSizeDecimals,
    isSpot: activeTradeInstrument.mode === 'spot',
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

  const handlePriceSelect = useCallback(
    (price: string) => {
      if (
        !isPerpsL2BookInteractive({
          bookTime: visibleL2Book?.time,
          bookReceivedAt: visibleL2Book?.localReceivedAt,
          isCachedSnapshot: visibleL2Book?.isCachedSnapshot,
        })
      ) {
        return;
      }

      const updates: Partial<ITradingFormData> = {
        price,
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
      visibleL2Book?.isCachedSnapshot,
      visibleL2Book?.time,
    ],
  );
  const handleLevelSelect = useCallback(
    (selection: IOrderBookSelection) => {
      handlePriceSelect(selection.price);
    },
    [handlePriceSelect],
  );
  const handleMidPriceSelect = useCallback(
    (price: string) => {
      const sizeDecimalsForPrice = activeSizeDecimals ?? 2;
      const formattedPrice =
        activeTradeInstrument.mode === 'spot'
          ? formatSpotPriceToValid(price, sizeDecimalsForPrice)
          : formatPriceToSignificantDigits(price, sizeDecimalsForPrice);
      if (formattedPrice !== '0') {
        handlePriceSelect(formattedPrice);
      }
    },
    [activeSizeDecimals, activeTradeInstrument.mode, handlePriceSelect],
  );
  const isVisibleOrderBookInteractive = useMemo(
    () =>
      isOrderBookInteractive &&
      isPerpsL2BookInteractive({
        bookTime: visibleL2Book?.time,
        bookReceivedAt: visibleL2Book?.localReceivedAt,
        isCachedSnapshot: visibleL2Book?.isCachedSnapshot,
      }),
    [
      isOrderBookInteractive,
      visibleL2Book?.isCachedSnapshot,
      visibleL2Book?.localReceivedAt,
      visibleL2Book?.time,
    ],
  );

  const mobileMaxLevelsPerSide = useMemo(() => {
    // Spot settles on its own level count, and the perps account flags read
    // true until the account address resolves, so checking them first made every
    // spot cold start render 7 levels and then collapse the first-screen grid.
    if (activeTradeInstrument.mode === 'spot')
      return MOBILE_SPOT_MAX_LEVELS_PER_SIDE;
    if (shouldCompactOrderBookForFirstDeposit) return 5;
    if (shouldShowEnableTradingButton) {
      return shouldCompactOrderBookForConnectWallet ? 6 : 7;
    }
    if (formData.hasTpsl) return 9;
    return 7;
  }, [
    activeTradeInstrument.mode,
    formData.hasTpsl,
    shouldCompactOrderBookForConnectWallet,
    shouldCompactOrderBookForFirstDeposit,
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
      candidateL2Book?.coin ?? '',
      candidateL2Book?.bids.length ?? 0,
      candidateL2Book?.asks.length ?? 0,
      hasInitializedTickOption ? 'tickReady' : 'tickPending',
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
    candidateL2Book?.asks.length,
    candidateL2Book?.bids.length,
    candidateL2Book?.coin,
    entry,
    formData.hasTpsl,
    gtMd,
    hasInitializedTickOption,
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
    if (entry !== 'perpMobileMarket') return null;
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
  }, [
    entry,
    gtMd,
    handleTickOptionChange,
    visibleL2Book,
    handleLevelSelect,
    selectedTickOption,
    hasRenderOrderBook,
    isVisibleOrderBookInteractive,
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

  if (!gtMd && entry !== 'perpMobileMarket') {
    const isLoading = !hasRenderOrderBook || !visibleL2Book;
    return (
      <>
        {dataBridge}
        <PerpOrderBookMobileVerticalShell
          header={<MobileHeaderMemo />}
          isLoading={isLoading}
          onLayout={(event) =>
            handleTraceLayout(
              isLoading ? 'mobileVerticalLoading' : 'mobileVerticalReady',
              event,
            )
          }
          loadingBody={
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
          }
          readyBody={
            visibleL2Book ? (
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
                onSelectMidPrice={
                  isVisibleOrderBookInteractive
                    ? handleMidPriceSelect
                    : undefined
                }
                variant="mobileVertical"
              />
            ) : null
          }
        />
      </>
    );
  }

  if ((!hasRenderOrderBook || !visibleL2Book) && !gtMd) {
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

  const desktopOrderBookData: Pick<IL2BookData, 'coin' | 'bids' | 'asks'> =
    hasRenderOrderBook && visibleL2Book
      ? visibleL2Book
      : {
          coin: activeTradeInstrument.coin,
          bids: [],
          asks: [],
        };

  const content = (
    <YStack
      flex={1}
      bg="$bgApp"
      onLayout={(event) => handleTraceLayout('rootReady', event)}
    >
      {gtMd ? (
        <OrderBook
          symbol={desktopOrderBookData.coin}
          horizontal={false}
          bids={desktopOrderBookData.bids}
          asks={desktopOrderBookData.asks}
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
