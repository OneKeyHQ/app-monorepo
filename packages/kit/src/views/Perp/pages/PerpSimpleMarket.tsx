import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ComponentProps } from 'react';

import { useIsFocused, useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Button,
  Divider,
  Icon,
  Page,
  ScrollView,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import { RollingNumberText } from '@onekeyhq/kit/src/components/RollingNumberText';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  useActiveTradeInstrumentAtom,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import type { IModalPerpParamList } from '@onekeyhq/shared/src/routes/perp';
import {
  formatPerpsCompactUsd,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpsAssetPosition,
  IPerpsFormattedAssetCtx,
} from '@onekeyhq/shared/types/hyperliquid';

import { PerpMarketIntroContent } from '../components/MarketDetail/PerpMarketIntroContent';
import { showClosePositionDialog } from '../components/OrderInfoPanel/ClosePositionModal';
import { PerpActionButton } from '../components/PerpActionButton';
import { SimpleMarketChart } from '../components/Simple/SimpleMarketChart';
import { SimpleMarketHeader } from '../components/Simple/SimpleMarketHeader';
import { SimpleMarketPortfolio } from '../components/Simple/SimpleMarketPortfolio';
import { SimpleOrderBook } from '../components/Simple/SimpleOrderBook';
import { simplePerpsCardStyle } from '../components/Simple/simpleStyles';
import { SimpleTradeHistory } from '../components/Simple/SimpleTradeHistory';
import { FavoriteButton } from '../components/TokenSelector/PerpTokenSelectorRow';
import { usePerpsAccountScopedActivePositions } from '../hooks/usePerpsAccountScopedActivePositions';
import { usePerpsAssetCtx } from '../hooks/usePerpsAssetCtx';
import { useSimpleMarketFocus } from '../hooks/useSimpleMarketFocus';
import { useTradingPrice } from '../hooks/useTradingPrice';
import { PerpsAccountSelectorProviderMirror } from '../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../PerpsProviderMirror';
import { getSimpleChartDisplayPerformance } from '../utils/simpleChart';
import { simplePrice, simpleUsd } from '../utils/simpleDisplay';

import type { ISimpleMarketChartPrice } from '../components/Simple/SimpleMarketChart';
import type { RouteProp } from '@react-navigation/native';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

const MemoSimpleMarketChart = memo(SimpleMarketChart);
const MemoSimpleMarketPortfolio = memo(SimpleMarketPortfolio);
const MemoSimpleOrderBook = memo(SimpleOrderBook);
const MemoSimpleTradeHistory = memo(SimpleTradeHistory);

// Keep scroll and quote updates local to their subscribers.
function createMarketStore<T>(initialValue: T) {
  let value = initialValue;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setSnapshot: (nextValue: T) => {
      if (value === nextValue) return;
      value = nextValue;
      listeners.forEach((listener) => listener());
    },
  };
}

type IVisibilityStore = ReturnType<typeof createMarketStore<boolean>>;
type IHeaderQuote = Pick<
  ComponentProps<typeof SimpleMarketHeader>,
  'price' | 'changeLabel' | 'changeLoading' | 'changeColor'
>;
type IHeaderQuoteStore = ReturnType<typeof createMarketStore<IHeaderQuote>>;

function SimpleMarketScrollingHeader({
  visibility,
  quote,
  reducedMotion,
  ...props
}: Omit<
  ComponentProps<typeof SimpleMarketHeader>,
  'priceVisibility' | keyof IHeaderQuote
> & {
  visibility: IVisibilityStore;
  quote: IHeaderQuoteStore;
  reducedMotion: boolean;
}) {
  const visible = useSyncExternalStore(
    visibility.subscribe,
    visibility.getSnapshot,
    visibility.getSnapshot,
  );
  const headerQuote = useSyncExternalStore(
    quote.subscribe,
    quote.getSnapshot,
    quote.getSnapshot,
  );
  return (
    <SimpleMarketHeader
      {...props}
      {...headerQuote}
      priceVisibility={{ visible, reducedMotion }}
    />
  );
}

function SimpleMarketMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [minWidth, setMinWidth] = useState(0);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const measuredWidth = Math.ceil(event.nativeEvent.layout.width);
    // Measure intrinsic content, never the container constrained by this minimum.
    setMinWidth((previousWidth) => Math.max(previousWidth, measuredWidth));
  }, []);

  return (
    <YStack minWidth={minWidth} flexShrink={0}>
      <YStack alignSelf="flex-start" gap="$1" onLayout={handleLayout}>
        <SizableText size="$bodyXs" color="$textSubdued" numberOfLines={1}>
          {label}
        </SizableText>
        <SizableText size="$bodySmMedium" numberOfLines={1}>
          {value}
        </SizableText>
      </YStack>
    </YStack>
  );
}

function SimpleMarketPositionStatus({
  position,
}: {
  position: IPerpsAssetPosition['position'];
}) {
  const intl = useIntl();
  const isLong = new BigNumber(position.szi).gt(0);
  const pnl = new BigNumber(position.unrealizedPnl);
  const pnlColor = pnl.gte(0) ? '$textSuccess' : '$textCritical';

  return (
    <XStack
      testID="perps-simple-position-status"
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
    >
      <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          numberOfLines={1}
          flexShrink={1}
        >
          {intl.formatMessage({ id: ETranslations.perp_position_title })}
        </SizableText>
        <XStack alignItems="center" gap="$2" flexShrink={1} minWidth={0}>
          <XStack
            w="$4"
            h="$4"
            justifyContent="center"
            alignItems="center"
            bg={isLong ? '$bgAccent' : '$bgCriticalStrong'}
            borderRadius={2}
            flexShrink={0}
          >
            <SizableText
              size="$bodySmMedium"
              color={isLong ? '$textInverse' : '$textOnColor'}
            >
              {intl.formatMessage({
                id: isLong
                  ? ETranslations.perp_position_b
                  : ETranslations.perp_position_s,
              })}
            </SizableText>
          </XStack>
          <SizableText
            size="$bodyMdMedium"
            fontVariant={['tabular-nums']}
            numberOfLines={1}
            adjustsFontSizeToFit
            flexShrink={1}
          >
            {simpleUsd(position.positionValue)}
          </SizableText>
        </XStack>
      </XStack>
      <XStack
        alignItems="baseline"
        justifyContent="flex-end"
        gap="$2"
        flex={1}
        minWidth={0}
      >
        <SizableText
          size="$bodyMdMedium"
          color={pnl.isFinite() ? pnlColor : '$textSubdued'}
          fontVariant={['tabular-nums']}
          numberOfLines={1}
          adjustsFontSizeToFit
          flexShrink={1}
        >
          {`${pnl.gt(0) ? '+' : ''}${simpleUsd(position.unrealizedPnl)}`}
        </SizableText>
      </XStack>
    </XStack>
  );
}

const SimpleMarketInfo = memo(function SimpleMarketInfo({
  coin,
}: {
  coin: string;
}) {
  const intl = useIntl();
  const [infoExpanded, setInfoExpanded] = useState(false);
  return (
    <PerpMarketIntroContent
      key={`info-${coin}`}
      coin={coin}
      displayName={parseDexCoin(coin).displayName}
      infoRowLimit={infoExpanded ? undefined : 3}
      hideInfoHeader
      paddingX={0}
      paddingTop={0}
      paddingBottom={0}
      renderSections={({ info, introduction }) => (
        <YStack gap="$6">
          {info ? (
            <YStack gap="$3">
              <SizableText size="$headingLg">
                {intl.formatMessage({
                  id: ETranslations.perp_market_info_coin_info__title,
                })}
              </SizableText>
              <YStack
                {...simplePerpsCardStyle}
                borderRadius="$6"
                p="$5"
                gap="$3"
              >
                {info}
                <XStack
                  testID="perps-simple-info-expand"
                  alignItems="center"
                  gap="$1"
                  alignSelf="flex-start"
                  onPress={() => setInfoExpanded((value) => !value)}
                >
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: infoExpanded
                        ? ETranslations.global_collapse
                        : ETranslations.global_expand,
                    })}
                  </SizableText>
                  <Icon
                    name={
                      infoExpanded
                        ? 'ChevronTopSmallOutline'
                        : 'ChevronDownSmallOutline'
                    }
                    size="$4"
                    color="$iconSubdued"
                  />
                </XStack>
              </YStack>
            </YStack>
          ) : null}
          {introduction ? (
            <YStack gap="$3">
              <SizableText size="$headingLg">
                {intl.formatMessage({
                  id: ETranslations.perp_market_info_introduction__title,
                })}
              </SizableText>
              <YStack {...simplePerpsCardStyle} borderRadius="$6" p="$5">
                {introduction}
              </YStack>
            </YStack>
          ) : null}
        </YStack>
      )}
    />
  );
});

const SimpleMarketFooter = memo(function SimpleMarketFooter({
  coin,
  currentPosition,
  valid,
  submitting,
  simplePageBackground,
}: {
  coin: string;
  currentPosition: IPerpsAssetPosition | undefined;
  valid: boolean;
  submitting: boolean;
  simplePageBackground: ComponentProps<typeof YStack>['bg'];
}) {
  const intl = useIntl();
  const [activeAccount] = usePerpsActiveAccountAtom();
  const navigation = useAppNavigation();
  const order = (targetCoin: string, side: 'long' | 'short') =>
    navigation.push(EModalPerpRoutes.MobilePerpSimpleOrder, {
      coin: targetCoin,
      side,
    });
  return (
    <Page.Footer>
      <YStack bg={simplePageBackground}>
        {currentPosition ? (
          <YStack testID="perps-simple-position-footer">
            <Divider />
            <YStack px="$5" pt="$3.5" pb="$1">
              <SimpleMarketPositionStatus position={currentPosition.position} />
            </YStack>
          </YStack>
        ) : null}
        <XStack px="$5" pb="$5" pt={currentPosition ? '$2.5' : '$5'} gap="$3">
          {currentPosition ? (
            <>
              <Button
                testID="perps-simple-close-position"
                flex={1}
                size="medium"
                minHeight={48}
                borderRadius="$full"
                variant="secondary"
                disabled={!valid || submitting}
                onPress={() => {
                  if (!activeAccount.accountAddress) return;
                  showClosePositionDialog({
                    tradingUiMode: 'simple',
                    expectedAccountAddress: activeAccount.accountAddress,
                    position: currentPosition.position,
                    type: 'market',
                    intl,
                  });
                }}
              >
                {intl.formatMessage({
                  id: ETranslations.perp_position_close_short,
                })}
              </Button>
              <Button
                testID="perps-simple-add-position"
                flex={1}
                size="medium"
                minHeight={48}
                borderRadius="$full"
                variant="primary"
                disabled={!valid || submitting}
                onPress={() =>
                  order(
                    currentPosition.position.coin,
                    new BigNumber(currentPosition.position.szi).gt(0)
                      ? 'long'
                      : 'short',
                  )
                }
              >
                {intl.formatMessage({
                  id: ETranslations.add_position__action,
                })}
              </Button>
            </>
          ) : (
            <>
              <PerpActionButton
                testID="PerpSimpleMarket-4"
                flex={1}
                size="medium"
                minHeight={48}
                borderRadius="$full"
                variant="destructive"
                disabled={!valid || submitting}
                onPress={() => order(coin, 'short')}
              >
                {intl.formatMessage({ id: ETranslations.perp_trade_short })}
              </PerpActionButton>
              <PerpActionButton
                testID="PerpSimpleMarket-3"
                flex={1}
                size="medium"
                minHeight={48}
                borderRadius="$full"
                variant="accent"
                disabled={!valid || submitting}
                onPress={() => order(coin, 'long')}
              >
                {intl.formatMessage({ id: ETranslations.perp_trade_long })}
              </PerpActionButton>
            </>
          )}
        </XStack>
      </YStack>
    </Page.Footer>
  );
});

const SimpleMarketMetrics = memo(function SimpleMarketMetrics({
  coin,
  assetCtx,
  hasMarketData,
}: {
  coin: string;
  assetCtx: IPerpsFormattedAssetCtx;
  hasMarketData: boolean;
}) {
  const intl = useIntl();
  return (
    <XStack mr="$-5" gap="$2" alignItems="center" minHeight={48}>
      <ScrollView
        horizontal
        flex={1}
        minWidth={0}
        showsHorizontalScrollIndicator={false}
        testID="perps-simple-market-metrics"
      >
        {[
          {
            label: intl.formatMessage({
              id: ETranslations.perp_position_mark_price,
            }),
            value: hasMarketData ? simplePrice(assetCtx?.markPrice) : '--',
          },
          {
            label: intl.formatMessage({
              id: ETranslations.perp_position_funding,
            }),
            value:
              hasMarketData && assetCtx?.fundingRate
                ? `${(Number(assetCtx.fundingRate) * 100).toFixed(4)}%`
                : '--',
          },
          {
            label: intl.formatMessage({
              id: ETranslations.market_24h_vol_usd,
            }),
            value: hasMarketData
              ? formatPerpsCompactUsd(Number(assetCtx?.volume24h))
              : '--',
          },
          {
            label: `${intl.formatMessage({ id: ETranslations.perp_token_bar_open_Interest })} (${
              parseDexCoin(coin).displayName
            })`,
            value:
              hasMarketData && Number.isFinite(Number(assetCtx?.openInterest))
                ? intl.formatNumber(Number(assetCtx.openInterest), {
                    notation: 'compact',
                    maximumFractionDigits: 2,
                  })
                : '--',
          },
          {
            label: intl.formatMessage({
              id: ETranslations.perp_token_bar_oracle_price,
            }),
            value: hasMarketData ? simplePrice(assetCtx?.oraclePrice) : '--',
          },
          {
            label: intl.formatMessage({
              id: ETranslations.perp_token_selector_24h_change,
            }),
            value: hasMarketData ? simpleUsd(assetCtx?.change24h) : '--',
          },
          {
            label: `${intl.formatMessage({ id: ETranslations.perp_token_bar_open_Interest })} (USD)`,
            value: hasMarketData
              ? formatPerpsCompactUsd(
                  Number(assetCtx?.openInterest) * Number(assetCtx?.markPrice),
                )
              : '--',
          },
        ].map((item, index) => (
          <XStack
            key={`${coin}:${intl.locale}:${item.label}`}
            alignItems="center"
            flexShrink={0}
          >
            {index ? (
              <YStack mx="$4" width={0.5} height={24} bg="$borderSubdued" />
            ) : null}
            <SimpleMarketMetric label={item.label} value={item.value} />
          </XStack>
        ))}
      </ScrollView>
    </XStack>
  );
});

function SimpleMarketQuotes({
  coin,
  assetId,
  valid,
  focused,
  quote,
  onPriceLayout,
  onSectionLayout,
}: {
  coin: string;
  assetId: number | undefined;
  valid: boolean;
  focused: boolean;
  quote: IHeaderQuoteStore;
  onPriceLayout: (event: LayoutChangeEvent) => void;
  onSectionLayout: (event: LayoutChangeEvent) => void;
}) {
  const [chartPrice, setChartPrice] = useState<
    ISimpleMarketChartPrice | undefined
  >({
    coin,
    range: '1D',
  });
  const { midPrice, isValid: hasMidPrice } = useTradingPrice({
    perpCoin: coin,
  });
  const { assetCtx, isLoading } = usePerpsAssetCtx({
    assetId: assetId ?? -1,
  });
  const hasMarketData = valid && !isLoading;
  const currentChartPrice = chartPrice?.coin === coin ? chartPrice : undefined;
  const changeRange = currentChartPrice?.range.toUpperCase() ?? '1D';
  const performance = getSimpleChartDisplayPerformance(currentChartPrice, {
    change: hasMarketData ? assetCtx?.change24h : undefined,
    changePercent: hasMarketData ? assetCtx?.change24hPercent : undefined,
  });
  const change = valid ? performance?.changePercent : undefined;
  const changeKnown = change !== undefined && Number.isFinite(change);
  const changeLoading = !changeKnown && currentChartPrice?.isLoading;
  const changeLabel = changeKnown
    ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`
    : '--';
  const changeAmount = new BigNumber(valid ? (performance?.change ?? '') : '');
  const changeAmountLabel = changeAmount.isFinite()
    ? `${changeAmount.lt(0) ? '-' : '+'}${simplePrice(changeAmount.abs())}`
    : '--';
  const directionColor = (change ?? 0) >= 0 ? '$textSuccess' : '$textCritical';
  const changeColor = changeKnown ? directionColor : '$textSubdued';
  const headerPrice = valid
    ? simplePrice(
        currentChartPrice?.price ?? (hasMidPrice ? midPrice : undefined),
      )
    : '--';
  useLayoutEffect(() => {
    quote.setSnapshot({
      price: headerPrice,
      changeLabel,
      changeLoading,
      changeColor,
    });
  }, [quote, headerPrice, changeLabel, changeLoading, changeColor]);

  return (
    <>
      <YStack gap="$4" onLayout={onSectionLayout}>
        <YStack gap="$1" onLayout={onPriceLayout}>
          <RollingNumberText
            animated={!currentChartPrice?.isScrubbing}
            key={coin}
            testID="perps-simple-market-price"
            size="$heading3xl"
            fontSize={32}
            lineHeight={40}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {headerPrice}
          </RollingNumberText>
          <XStack alignItems="center" gap="$1">
            {changeLoading ? (
              <Skeleton width="$24" height="$4" />
            ) : (
              <>
                <SizableText size="$bodySmMedium" color={changeColor}>
                  {changeAmountLabel}
                </SizableText>
                <SizableText
                  testID="perps-simple-market-change"
                  size="$bodySmMedium"
                  color={changeColor}
                >
                  {changeKnown ? `(${changeLabel})` : '--'}
                </SizableText>
              </>
            )}
            <SizableText size="$bodySm" color="$textSubdued">
              {changeRange}
            </SizableText>
          </XStack>
        </YStack>
        <SimpleMarketMetrics
          coin={coin}
          assetCtx={assetCtx}
          hasMarketData={hasMarketData}
        />
      </YStack>
      {valid ? (
        <MemoSimpleMarketChart
          key={`chart-${coin}`}
          coin={coin}
          active={focused}
          livePrice={valid && hasMidPrice ? midPrice : undefined}
          onPriceChange={setChartPrice}
        />
      ) : null}
    </>
  );
}

function SimpleMarketContent() {
  const theme = useTheme();
  const themeVariant = useThemeVariant();
  const simplePageBackground =
    themeVariant === 'light' ? '$bgSubdued' : '$bgApp';
  const headerBackgroundColor =
    themeVariant === 'light' ? theme.bgSubdued.val : theme.bgApp.val;
  const headerStyle = useMemo(
    () => ({ backgroundColor: headerBackgroundColor }),
    [headerBackgroundColor],
  );
  const route =
    useRoute<
      RouteProp<IModalPerpParamList, EModalPerpRoutes.MobilePerpSimpleMarket>
    >();
  const navigation = useAppNavigation();
  const focused = useIsFocused();
  const { gtMd } = useMedia();
  const { width } = useWindowDimensions();
  const [instrument] = useActiveTradeInstrumentAtom();
  const [settings] = usePerpsCustomSettingsAtom();
  const [submitting] = useTradingLoadingAtom();
  useSimpleMarketFocus(
    route.params.coin,
    focused &&
      settings.mobileTradingMode === 'simple' &&
      (platformEnv.isNative || !gtMd),
  );
  const positions = usePerpsAccountScopedActivePositions();
  const currentPosition = positions.find(
    (item) => item.position.coin === route.params.coin,
  );
  const reducedMotion = useReducedMotion();
  const visibility = useMemo(
    () => ({
      coin: route.params.coin,
      headerPrice: createMarketStore(false),
      quote: createMarketStore<IHeaderQuote>({
        price: '--',
        changeLabel: '--',
        changeLoading: false,
        changeColor: '$textSubdued',
      }),
    }),
    [route.params.coin],
  );
  const priceVisibility = useRef({
    scrollY: 0,
    sectionY: 0,
    priceBottom: Infinity,
  });
  const updateHeaderPriceVisibility = useCallback(() => {
    const state = priceVisibility.current;
    const visible = state.scrollY >= state.sectionY + state.priceBottom;
    visibility.headerPrice.setSnapshot(visible);
  }, [visibility]);
  useEffect(() => {
    updateHeaderPriceVisibility();
  }, [updateHeaderPriceVisibility]);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      priceVisibility.current.scrollY = event.nativeEvent.contentOffset.y;
      updateHeaderPriceVisibility();
    },
    [updateHeaderPriceVisibility],
  );
  const handlePriceLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      priceVisibility.current.priceBottom = y + height;
      updateHeaderPriceVisibility();
    },
    [updateHeaderPriceVisibility],
  );
  const handleSectionLayout = useCallback(
    (event: LayoutChangeEvent) => {
      priceVisibility.current.sectionY = event.nativeEvent.layout.y;
      updateHeaderPriceVisibility();
    },
    [updateHeaderPriceVisibility],
  );
  const valid =
    instrument.mode === 'perp' && instrument.coin === route.params.coin;
  const headerWidth = Math.max(100, Math.min(264, width - 152));
  const openTokenSelector = useCallback(() => {
    if (submitting) return;
    navigation.push(EModalPerpRoutes.MobileTokenSelector);
  }, [navigation, submitting]);
  const renderHeaderTitle = useCallback(
    () => (
      <SimpleMarketScrollingHeader
        testID="perps-simple-market-token-selector"
        coin={route.params.coin}
        width={headerWidth}
        quote={visibility.quote}
        onPress={openTokenSelector}
        visibility={visibility.headerPrice}
        reducedMotion={reducedMotion}
      />
    ),
    [
      headerWidth,
      route.params.coin,
      openTokenSelector,
      reducedMotion,
      visibility,
    ],
  );
  const renderHeaderRight = useCallback(
    () => (
      <FavoriteButton
        coin={route.params.coin}
        iconSize="$6"
        activeIconColor="$bgAccent"
      />
    ),
    [route.params.coin],
  );
  useEffect(() => {
    if (
      (settings.mobileTradingMode !== 'simple' ||
        (gtMd && !platformEnv.isNative)) &&
      focused
    )
      navigation.popStack();
  }, [focused, gtMd, navigation, settings.mobileTradingMode]);
  return (
    <Page backgroundColor={simplePageBackground}>
      <Page.Header
        headerStyle={headerStyle}
        headerContainerBackgroundColor={headerBackgroundColor}
        title={parseDexCoin(route.params.coin).displayName}
        headerTitle={renderHeaderTitle}
        headerRight={renderHeaderRight}
      />
      <Page.Body>
        <ScrollView
          testID="perps-simple-market-scroll"
          contentContainerStyle={{
            padding: 20,
            paddingTop: 12,
            gap: 24,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <SimpleMarketQuotes
            key={`quotes-${route.params.coin}`}
            coin={route.params.coin}
            assetId={instrument.assetId}
            valid={valid}
            focused={focused}
            quote={visibility.quote}
            onPriceLayout={handlePriceLayout}
            onSectionLayout={handleSectionLayout}
          />
          <MemoSimpleMarketPortfolio
            key={route.params.coin}
            coin={route.params.coin}
            position={currentPosition}
            initialTab={route.params.initialPortfolioTab}
          />
          {focused && valid ? (
            <MemoSimpleOrderBook coin={route.params.coin} />
          ) : null}
          <SimpleMarketInfo
            key={`info-${route.params.coin}`}
            coin={route.params.coin}
          />
          <MemoSimpleTradeHistory
            key={`history-${route.params.coin}`}
            coin={route.params.coin}
          />
        </ScrollView>
      </Page.Body>
      <SimpleMarketFooter
        coin={route.params.coin}
        currentPosition={currentPosition}
        valid={valid}
        submitting={submitting}
        simplePageBackground={simplePageBackground}
      />
    </Page>
  );
}
export default function PerpSimpleMarket() {
  return (
    <PerpsAccountSelectorProviderMirror>
      <PerpsProviderMirror>
        <SimpleMarketContent />
      </PerpsProviderMirror>
    </PerpsAccountSelectorProviderMirror>
  );
}
