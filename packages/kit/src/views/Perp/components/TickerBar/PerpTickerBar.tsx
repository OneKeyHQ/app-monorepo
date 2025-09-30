import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  DebugRenderTracker,
  Divider,
  Icon,
  IconButton,
  NumberSizeableText,
  ScrollView,
  SizableText,
  SkeletonContainer,
  Tooltip,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';

import { useFundingCountdown, usePerpSession } from '../../hooks';
import { PerpSettingsButton } from '../PerpSettingsButton';
import { PerpTokenSelector } from '../TokenSelector/PerpTokenSelector';

function useTickerBarIsLoading() {
  const { isReady, hasError } = usePerpSession();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const { markPrice } = assetCtx?.ctx || {
    markPrice: '0',
  };
  return !isReady || hasError || parseFloat(markPrice) === 0;
}

function TickerBarMarkPrice() {
  const intl = useIntl();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const formattedMarkPrice = assetCtx?.ctx?.markPrice || '';
  const isLoading = useTickerBarIsLoading();
  return (
    <DebugRenderTracker
      name="TickerBarMarkPrice"
      position="bottom-left"
      offsetY={10}
    >
      <SkeletonContainer isLoading={isLoading} width={80} height={28}>
        <Tooltip
          placement="top"
          renderTrigger={
            <SizableText size="$headingXl">{formattedMarkPrice}</SizableText>
          }
          renderContent={
            <SizableText size="$bodySm">
              {intl.formatMessage({
                id: ETranslations.perp_mark_price_tooltip,
              })}
            </SizableText>
          }
        />
      </SkeletonContainer>
    </DebugRenderTracker>
  );
}

function TickerBarChange24hPercent() {
  const intl = useIntl();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const change24hPercent = assetCtx?.ctx?.change24hPercent || 0;
  const isLoading = useTickerBarIsLoading();

  return (
    <DebugRenderTracker
      name="TickerBarChange24hPercent"
      position="bottom-right"
      offsetY={10}
    >
      <SkeletonContainer isLoading={isLoading} width={50} height={16}>
        <NumberSizeableText
          size="$headingXs"
          color={change24hPercent >= 0 ? '$green11' : '$red11'}
          formatter="priceChange"
          formatterOptions={{
            showPlusMinusSigns: true,
          }}
        >
          {change24hPercent}
        </NumberSizeableText>
      </SkeletonContainer>
    </DebugRenderTracker>
  );
}

function TickerBarOraclePrice() {
  const intl = useIntl();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const formattedOraclePrice = assetCtx?.ctx?.oraclePrice || '';
  const isLoading = useTickerBarIsLoading();

  return (
    <DebugRenderTracker name="TickerBarOraclePrice">
      <YStack>
        <Tooltip
          renderTrigger={
            <SizableText
              size="$bodySm"
              borderBottomWidth="$px"
              borderTopWidth={0}
              borderLeftWidth={0}
              borderRightWidth={0}
              borderBottomColor="$border"
              borderStyle="dashed"
              color="$textSubdued"
            >
              {intl.formatMessage({
                id: ETranslations.perp_token_bar_oracle_price,
              })}
            </SizableText>
          }
          renderContent={
            <SizableText size="$bodySm">
              {intl.formatMessage({
                id: ETranslations.perp_oracle_price_tooltip,
              })}
            </SizableText>
          }
          placement="top"
        />
        <SkeletonContainer isLoading={isLoading} width={80} height={16}>
          <SizableText size="$headingXs">{formattedOraclePrice}</SizableText>
        </SkeletonContainer>
      </YStack>
    </DebugRenderTracker>
  );
}

function TickerBar24hVolume() {
  const intl = useIntl();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const volume24h = assetCtx?.ctx?.volume24h || '0';
  const isLoading = useTickerBarIsLoading();

  return (
    <DebugRenderTracker name="TickerBar24hVolume">
      <YStack>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_token_bar_24h_Volume,
          })}
        </SizableText>
        <SkeletonContainer isLoading={isLoading} width={80} height={16}>
          <SizableText size="$headingXs">
            $
            {formatDisplayNumber(
              NUMBER_FORMATTER.marketCap(volume24h.toString()),
            )}
          </SizableText>
        </SkeletonContainer>
      </YStack>
    </DebugRenderTracker>
  );
}

function TickerBarOpenInterest() {
  const intl = useIntl();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const { openInterest = '0', markPrice = '0' } = assetCtx?.ctx || {};
  const isLoading = useTickerBarIsLoading();

  return (
    <DebugRenderTracker name="TickerBarOpenInterest">
      <YStack>
        <Tooltip
          renderTrigger={
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              borderBottomWidth="$px"
              borderTopWidth={0}
              borderLeftWidth={0}
              borderRightWidth={0}
              borderBottomColor="$border"
              borderStyle="dashed"
            >
              {intl.formatMessage({
                id: ETranslations.perp_token_bar_open_Interest,
              })}
            </SizableText>
          }
          renderContent={
            <SizableText size="$bodySm">
              {intl.formatMessage({
                id: ETranslations.perp_open_interest_tooltip,
              })}
            </SizableText>
          }
          placement="top"
        />
        <SkeletonContainer isLoading={isLoading} width={80} height={16}>
          <SizableText size="$headingXs">
            $
            {formatDisplayNumber(
              NUMBER_FORMATTER.marketCap(
                (Number(openInterest) * Number(markPrice)).toString(),
              ),
            )}
          </SizableText>
        </SkeletonContainer>
      </YStack>
    </DebugRenderTracker>
  );
}

function TickerBarFundingRate() {
  const intl = useIntl();
  const countdown = useFundingCountdown();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const fundingRate = assetCtx?.ctx?.fundingRate || '0';
  const isLoading = useTickerBarIsLoading();
  return (
    <DebugRenderTracker name="TickerBarFundingRate">
      <YStack>
        <Tooltip
          renderTrigger={
            <SizableText
              size="$bodySm"
              borderBottomWidth="$px"
              borderTopWidth={0}
              borderLeftWidth={0}
              borderRightWidth={0}
              borderBottomColor="$border"
              borderStyle="dashed"
              color="$textSubdued"
            >
              {intl.formatMessage({
                id: ETranslations.perp_token_bar_Funding,
              })}
            </SizableText>
          }
          renderContent={
            <YStack gap="$2">
              <SizableText size="$bodySm">
                {intl.formatMessage({
                  id: ETranslations.perp_funding_rate_tip1,
                })}
              </SizableText>
              <SizableText size="$bodySm">
                {intl.formatMessage({
                  id: ETranslations.perp_funding_rate_tip2,
                })}
              </SizableText>
            </YStack>
          }
          placement="top"
        />
        <SkeletonContainer isLoading={isLoading} width={120} height={16}>
          <XStack alignItems="center" gap="$2">
            <Tooltip
              renderTrigger={
                <XStack alignItems="center" gap="$2">
                  <SizableText
                    size="$headingXs"
                    color={parseFloat(fundingRate) >= 0 ? '$green11' : '$red11'}
                  >
                    {(parseFloat(fundingRate) * 100).toFixed(4)}%
                  </SizableText>
                  <SizableText size="$headingXs" color="$text">
                    {countdown}
                  </SizableText>
                </XStack>
              }
              renderContent={
                <YStack gap="$1">
                  <YStack py="$1" gap="$0.5" justifyContent="space-between">
                    <SizableText size="$bodySm" color="$textSubdued">
                      {intl.formatMessage({
                        id: ETranslations.perp_ticker_annualized_funding_tooltip,
                      })}
                    </SizableText>
                    <SizableText
                      size="$bodySmMedium"
                      color={
                        parseFloat(fundingRate) >= 0 ? '$green11' : '$red11'
                      }
                    >
                      {(parseFloat(fundingRate) * 100 * 24 * 365).toFixed(2)}%
                    </SizableText>
                  </YStack>
                  <Divider />
                  <YStack py="$1" gap="$0.5" justifyContent="space-between">
                    <SizableText size="$bodySm" color="$textSubdued">
                      {intl.formatMessage({
                        id: ETranslations.perp_trades_history_direction,
                      })}
                    </SizableText>
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
                  </YStack>
                </YStack>
              }
            />
          </XStack>
        </SkeletonContainer>
      </YStack>
    </DebugRenderTracker>
  );
}

function PerpTickerBar() {
  const { gtMd } = useMedia();
  const navigation = useAppNavigation();
  const [asset] = usePerpsActiveAssetAtom();
  const coin = asset?.coin || '';
  const intl = useIntl();
  const onPressCandleChart = useCallback(() => {
    navigation.push(EModalPerpRoutes.MobilePerpMarket);
  }, [navigation]);

  const onPressTokenSelector = useCallback(() => {
    navigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.MobileTokenSelector,
    });
  }, [navigation]);

  if (!gtMd) {
    const content = (
      <XStack
        flex={1}
        bg="$bgApp"
        gap="$4"
        px="$4"
        py="$3"
        alignItems="center"
        justifyContent="space-between"
      >
        <YStack gap="$1.5">
          <XStack
            gap="$1.5"
            bg="$bgApp"
            onPress={onPressTokenSelector}
            justifyContent="center"
            alignItems="center"
          >
            <Icon name="MenuOutline" size="$5" />

            <SizableText size="$headingXl">{coin}USD</SizableText>
            <Badge radius="$1" bg="$bgSubdued" px="$1" py={0}>
              <SizableText color="$textSubdued" fontSize={11}>
                {intl.formatMessage({
                  id: ETranslations.perp_label_perp,
                })}
              </SizableText>
            </Badge>
          </XStack>
        </YStack>
        <XStack gap="$3" alignItems="center">
          <IconButton
            icon="TradingViewCandlesOutline"
            size="small"
            iconProps={{ color: '$iconSubdued' }}
            variant="tertiary"
            onPress={onPressCandleChart}
          />
          <PerpSettingsButton testID="perp-mobile-settings-button" />
        </XStack>
      </XStack>
    );
    return (
      <DebugRenderTracker name="PerpTickerBarMobile" position="top-right">
        {content}
      </DebugRenderTracker>
    );
  }

  const content = (
    <XStack
      bg="$bgApp"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      p="$4"
      alignItems="center"
      justifyContent="flex-start"
      gap="$6"
      h={62}
    >
      <XStack gap="$4" alignItems="center">
        <PerpTokenSelector />
        <XStack alignItems="center" width={140} gap="$1.5" cursor="default">
          <TickerBarMarkPrice />
          <TickerBarChange24hPercent />
        </XStack>
      </XStack>

      {/* Right: Market Data */}
      <ScrollView
        cursor="default"
        horizontal
        flex={1}
        contentContainerStyle={{
          gap: '$8',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        <TickerBarOraclePrice />
        <TickerBar24hVolume />
        <TickerBarOpenInterest />
        <TickerBarFundingRate />
      </ScrollView>
    </XStack>
  );
  return (
    <DebugRenderTracker name="PerpTickerBarDesktop" position="top-right">
      {content}
    </DebugRenderTracker>
  );
}

const PerpTickerBarMemo = memo(PerpTickerBar);
export { PerpTickerBarMemo as PerpTickerBar };
