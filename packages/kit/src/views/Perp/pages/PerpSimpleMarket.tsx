import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused, useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Button,
  Icon,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  useActiveTradeInstrumentAtom,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import type { IModalPerpParamList } from '@onekeyhq/shared/src/routes/perp';
import {
  formatPerpsCompactUsd,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';

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
import { PerpsAccountSelectorProviderMirror } from '../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../PerpsProviderMirror';
import { simplePrice, simpleUsd } from '../utils/simpleDisplay';

import type { RouteProp } from '@react-navigation/native';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

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
  const intl = useIntl();
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
  const [showHeaderPrice, setShowHeaderPrice] = useState(false);
  const priceVisibility = useRef({
    scrollY: 0,
    sectionY: 0,
    priceBottom: Infinity,
    visible: false,
  });
  const updateHeaderPriceVisibility = useCallback(() => {
    const state = priceVisibility.current;
    const visible = state.scrollY >= state.sectionY + state.priceBottom;
    if (visible !== state.visible) {
      state.visible = visible;
      setShowHeaderPrice(visible);
    }
  }, []);
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
  const [infoExpanded, setInfoExpanded] = useState(false);
  const { assetCtx } = usePerpsAssetCtx({ assetId: instrument.assetId ?? -1 });
  const valid =
    instrument.mode === 'perp' && instrument.coin === route.params.coin;
  const headerWidth = Math.max(100, Math.min(264, width - 152));
  const change = valid ? assetCtx?.change24hPercent : undefined;
  const changeKnown = change !== undefined && Number.isFinite(change);
  const changeLabel = changeKnown
    ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`
    : '--';
  const directionColor = (change ?? 0) >= 0 ? '$textSuccess' : '$textCritical';
  const changeColor = changeKnown ? directionColor : '$textSubdued';
  const headerPrice = valid ? simplePrice(assetCtx?.markPrice) : '--';
  const openTokenSelector = useCallback(() => {
    if (submitting) return;
    navigation.push(EModalPerpRoutes.MobileTokenSelector);
  }, [navigation, submitting]);
  useEffect(() => {
    setInfoExpanded(false);
  }, [route.params.coin]);
  const renderHeaderTitle = useCallback(
    () => (
      <SimpleMarketHeader
        testID="perps-simple-market-token-selector"
        coin={route.params.coin}
        width={headerWidth}
        price={headerPrice}
        changeLabel={changeLabel}
        changeColor={changeColor}
        onPress={openTokenSelector}
        priceVisibility={{ visible: showHeaderPrice, reducedMotion }}
      />
    ),
    [
      headerWidth,
      route.params.coin,
      headerPrice,
      changeColor,
      changeLabel,
      openTokenSelector,
      reducedMotion,
      showHeaderPrice,
    ],
  );
  useEffect(() => {
    if (
      (settings.mobileTradingMode !== 'simple' ||
        (gtMd && !platformEnv.isNative)) &&
      focused
    )
      navigation.popStack();
  }, [focused, gtMd, navigation, settings.mobileTradingMode]);
  const order = (coin: string, side: 'long' | 'short') =>
    navigation.push(EModalPerpRoutes.MobilePerpSimpleOrder, { coin, side });
  return (
    <Page backgroundColor={simplePageBackground}>
      <Page.Header
        headerStyle={headerStyle}
        headerContainerBackgroundColor={headerBackgroundColor}
        title={parseDexCoin(route.params.coin).displayName}
        headerTitle={renderHeaderTitle}
        headerRight={() => (
          <FavoriteButton
            coin={route.params.coin}
            iconSize="$6"
            activeIconColor="$bgAccent"
          />
        )}
      />
      <Page.Body>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 24 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <YStack
            gap="$4"
            onLayout={(event) => {
              priceVisibility.current.sectionY = event.nativeEvent.layout.y;
              updateHeaderPriceVisibility();
            }}
          >
            <YStack gap="$1" onLayout={handlePriceLayout}>
              <SizableText
                size="$heading3xl"
                fontSize={32}
                lineHeight={40}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {headerPrice.replace('$', '')}
              </SizableText>
              <XStack alignItems="center" gap="$2">
                <SizableText size="$bodySm" color="$textSubdued">
                  {valid ? `≈${headerPrice}` : '--'}
                </SizableText>
                <SizableText size="$bodySmMedium" color={changeColor}>
                  {changeLabel}
                </SizableText>
              </XStack>
            </YStack>
            <XStack
              position="relative"
              gap="$2"
              alignItems="center"
              minHeight={48}
            >
              <ScrollView
                horizontal
                flex={1}
                minWidth={0}
                showsHorizontalScrollIndicator={false}
                testID="perps-simple-market-metrics"
                contentContainerStyle={{ paddingRight: 8 }}
              >
                {[
                  {
                    label: intl.formatMessage({
                      id: ETranslations.perp_position_mark_price,
                    }),
                    value: headerPrice,
                  },
                  {
                    label: intl.formatMessage({
                      id: ETranslations.perp_position_funding,
                    }),
                    value:
                      valid && assetCtx?.fundingRate
                        ? `${(Number(assetCtx.fundingRate) * 100).toFixed(4)}%`
                        : '--',
                  },
                  {
                    label: intl.formatMessage({
                      id: ETranslations.market_24h_vol_usd,
                    }),
                    value: valid
                      ? formatPerpsCompactUsd(Number(assetCtx?.volume24h))
                      : '--',
                  },
                  {
                    label: `${intl.formatMessage({ id: ETranslations.perp_token_bar_open_Interest })} (${
                      parseDexCoin(route.params.coin).displayName
                    })`,
                    value:
                      valid && Number.isFinite(Number(assetCtx?.openInterest))
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
                    value: valid ? simplePrice(assetCtx?.oraclePrice) : '--',
                  },
                  {
                    label: intl.formatMessage({
                      id: ETranslations.perp_token_selector_24h_change,
                    }),
                    value: valid ? simpleUsd(assetCtx?.change24h) : '--',
                  },
                  {
                    label: `${intl.formatMessage({ id: ETranslations.perp_token_bar_open_Interest })} (USD)`,
                    value: valid
                      ? formatPerpsCompactUsd(
                          Number(assetCtx?.openInterest) *
                            Number(assetCtx?.markPrice),
                        )
                      : '--',
                  },
                ].map((item, index) => (
                  <XStack key={item.label} alignItems="center" flexShrink={0}>
                    {index ? (
                      <YStack
                        mx="$4"
                        width={0.5}
                        height={24}
                        bg="$borderSubdued"
                      />
                    ) : null}
                    <YStack flexShrink={0} gap="$1">
                      <SizableText
                        size="$bodyXs"
                        color="$textSubdued"
                        numberOfLines={1}
                      >
                        {item.label}
                      </SizableText>
                      <SizableText size="$bodySmMedium" numberOfLines={1}>
                        {item.value}
                      </SizableText>
                    </YStack>
                  </XStack>
                ))}
              </ScrollView>
              <YStack
                position="absolute"
                top={0}
                bottom={0}
                right={0}
                width={8}
                bg={simplePageBackground}
                pointerEvents="none"
              />
            </XStack>
          </YStack>
          {valid ? (
            <SimpleMarketChart
              key={`chart-${route.params.coin}`}
              coin={route.params.coin}
              active={focused}
              livePrice={assetCtx?.markPrice}
            />
          ) : null}
          <SimpleMarketPortfolio
            key={route.params.coin}
            coin={route.params.coin}
            position={currentPosition}
            initialTab={route.params.initialPortfolioTab}
          />
          {focused && valid ? (
            <SimpleOrderBook coin={route.params.coin} />
          ) : null}
          <PerpMarketIntroContent
            key={`info-${route.params.coin}`}
            coin={route.params.coin}
            displayName={parseDexCoin(route.params.coin).displayName}
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
          <SimpleTradeHistory
            key={`history-${route.params.coin}`}
            coin={route.params.coin}
          />
        </ScrollView>
      </Page.Body>
      <Page.Footer>
        <XStack p="$5" gap="$3">
          {currentPosition ? (
            <>
              <Button
                testID="perps-simple-add-position"
                flex={1}
                size="medium"
                minHeight={48}
                borderRadius="$full"
                variant="secondary"
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
                {intl.formatMessage({ id: ETranslations.add_position__action })}
              </Button>
              <Button
                testID="perps-simple-close-position"
                flex={1}
                size="medium"
                minHeight={48}
                borderRadius="$full"
                variant="primary"
                disabled={!valid || submitting}
                onPress={() =>
                  showClosePositionDialog({
                    position: currentPosition.position,
                    type: 'market',
                    intl,
                  })
                }
              >
                {intl.formatMessage({
                  id: ETranslations.perp_position_close_short,
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
                onPress={() => order(route.params.coin, 'short')}
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
                onPress={() => order(route.params.coin, 'long')}
              >
                {intl.formatMessage({ id: ETranslations.perp_trade_long })}
              </PerpActionButton>
            </>
          )}
        </XStack>
      </Page.Footer>
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
