import { memo } from 'react';

import { isString } from 'lodash';
import { useIntl } from 'react-intl';

import {
  DebugRenderTracker,
  Divider,
  NumberSizeableText,
  ScrollView,
  SizableText,
  SkeletonContainer,
  Tooltip,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { usePerpsActiveAssetCtxAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';

import { useFundingCountdown, usePerpSession } from '../../hooks';
import { PerpTokenSelector } from '../TokenSelector/PerpTokenSelector';

function useTickerBarIsLoading() {
  const { isReady, hasError } = usePerpSession();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const { markPrice } = assetCtx?.ctx || {
    markPrice: '0',
  };
  return !isReady || hasError || parseFloat(markPrice) === 0;
}

const TickerBarMarkPriceView = memo(
  ({
    formattedMarkPrice,
    isLoading,
  }: {
    formattedMarkPrice: string;
    isLoading: boolean;
  }) => {
    const intl = useIntl();
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
              <SizableText size="$headingXl" cursor="help">
                {formattedMarkPrice}
              </SizableText>
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
  },
);
TickerBarMarkPriceView.displayName = 'TickerBarMarkPriceView';

function TickerBarMarkPrice() {
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const formattedMarkPrice = assetCtx?.ctx?.markPrice || '';
  const isLoading = useTickerBarIsLoading();
  return (
    <TickerBarMarkPriceView
      formattedMarkPrice={formattedMarkPrice}
      isLoading={isLoading}
    />
  );
}

const TickerBarChange24hPercentView = memo(
  ({
    change24hPercent,
    isLoading,
    gtMd,
  }: {
    change24hPercent: number;
    isLoading: boolean;
    gtMd: boolean;
  }) => (
    <DebugRenderTracker
      name="TickerBarChange24hPercent"
      position="bottom-right"
      offsetY={10}
    >
      <SkeletonContainer isLoading={isLoading} width={50} height={16}>
        <NumberSizeableText
          size={gtMd ? '$headingXs' : '$bodySmMedium'}
          fontSize={gtMd ? undefined : 10}
          mt={gtMd ? undefined : '$-2'}
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
  ),
);
TickerBarChange24hPercentView.displayName = 'TickerBarChange24hPercentView';

export function TickerBarChange24hPercent() {
  const { gtMd } = useMedia();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const change24hPercent = assetCtx?.ctx?.change24hPercent || 0;
  const isLoading = useTickerBarIsLoading();

  return (
    <TickerBarChange24hPercentView
      change24hPercent={change24hPercent}
      isLoading={isLoading}
      gtMd={gtMd}
    />
  );
}

const TickerBarOraclePriceView = memo(
  ({
    formattedOraclePrice,
    isLoading,
  }: {
    formattedOraclePrice: string;
    isLoading: boolean;
  }) => {
    const intl = useIntl();
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
                cursor="help"
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
  },
);
TickerBarOraclePriceView.displayName = 'TickerBarOraclePriceView';

function TickerBarOraclePrice() {
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const formattedOraclePrice = assetCtx?.ctx?.oraclePrice || '';
  const isLoading = useTickerBarIsLoading();

  return (
    <TickerBarOraclePriceView
      formattedOraclePrice={formattedOraclePrice}
      isLoading={isLoading}
    />
  );
}

const TickerBar24hVolumeView = memo(
  ({
    formattedVolume24h,
    isLoading,
  }: {
    formattedVolume24h: string;
    isLoading: boolean;
  }) => {
    const intl = useIntl();
    return (
      <DebugRenderTracker name="TickerBar24hVolume">
        <YStack>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_token_bar_24h_Volume,
            })}
          </SizableText>
          <SkeletonContainer isLoading={isLoading} width={80} height={16}>
            <SizableText size="$headingXs">${formattedVolume24h}</SizableText>
          </SkeletonContainer>
        </YStack>
      </DebugRenderTracker>
    );
  },
);
TickerBar24hVolumeView.displayName = 'TickerBar24hVolumeView';

function TickerBar24hVolume() {
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const volume24h = assetCtx?.ctx?.volume24h || '0';
  const formattedVolume24h = formatDisplayNumber(
    NUMBER_FORMATTER.marketCap(volume24h.toString()),
  );
  const isLoading = useTickerBarIsLoading();

  return (
    <TickerBar24hVolumeView
      formattedVolume24h={
        isString(formattedVolume24h) ? formattedVolume24h : '--'
      }
      isLoading={isLoading}
    />
  );
}

const TickerBarOpenInterestView = memo(
  ({
    formattedOpenInterest,
    isLoading,
  }: {
    formattedOpenInterest: string;
    isLoading: boolean;
  }) => {
    const intl = useIntl();
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
                cursor="help"
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
              ${formattedOpenInterest}
            </SizableText>
          </SkeletonContainer>
        </YStack>
      </DebugRenderTracker>
    );
  },
);
TickerBarOpenInterestView.displayName = 'TickerBarOpenInterestView';

function TickerBarOpenInterest() {
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const { openInterest = '0', markPrice = '0' } = assetCtx?.ctx || {};
  const formattedOpenInterest = formatDisplayNumber(
    NUMBER_FORMATTER.marketCap(
      (Number(openInterest) * Number(markPrice)).toString(),
    ),
  );
  const isLoading = useTickerBarIsLoading();

  return (
    <TickerBarOpenInterestView
      formattedOpenInterest={
        isString(formattedOpenInterest) ? formattedOpenInterest : '--'
      }
      isLoading={isLoading}
    />
  );
}

function TickerBarFundingRateCountdown() {
  const countdown = useFundingCountdown();
  return (
    <DebugRenderTracker
      name="TickerBarFundingRateCountdown"
      position="bottom-right"
      offsetX={10}
    >
      <SizableText size="$headingXs" color="$text">
        {countdown}
      </SizableText>
    </DebugRenderTracker>
  );
}

const TickerBarFundingRateView = memo(
  ({
    fundingRate,
    fundingRatePercent,
    annualizedFundingRate,
    isLoading,
  }: {
    fundingRate: number;
    fundingRatePercent: string;
    annualizedFundingRate: string;
    isLoading: boolean;
  }) => {
    const intl = useIntl();
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
                cursor="help"
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
                      color={fundingRate >= 0 ? '$green11' : '$red11'}
                      cursor="help"
                    >
                      {fundingRatePercent}%
                    </SizableText>
                    <TickerBarFundingRateCountdown />
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
                        color={fundingRate >= 0 ? '$green11' : '$red11'}
                      >
                        {annualizedFundingRate}%
                      </SizableText>
                    </YStack>
                    <Divider />
                    <YStack py="$1" gap="$0.5" justifyContent="space-between">
                      <SizableText size="$bodySm" color="$textSubdued">
                        {intl.formatMessage({
                          id: ETranslations.perp_trades_history_direction,
                        })}
                      </SizableText>
                      {fundingRate >= 0 ? (
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
  },
);
TickerBarFundingRateView.displayName = 'TickerBarFundingRateView';

function TickerBarFundingRate() {
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const fundingRateStr = assetCtx?.ctx?.fundingRate || '0';
  const fundingRate = parseFloat(fundingRateStr);
  const fundingRatePercent = (fundingRate * 100).toFixed(4);
  const annualizedFundingRate = (fundingRate * 100 * 24 * 365).toFixed(2);
  const isLoading = useTickerBarIsLoading();

  return (
    <TickerBarFundingRateView
      fundingRate={fundingRate}
      fundingRatePercent={fundingRatePercent}
      annualizedFundingRate={annualizedFundingRate}
      isLoading={isLoading}
    />
  );
}

function PerpTickerBarDesktop() {
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

const PerpTickerBarDesktopMemo = memo(PerpTickerBarDesktop);
export { PerpTickerBarDesktopMemo as PerpTickerBarDesktop };
