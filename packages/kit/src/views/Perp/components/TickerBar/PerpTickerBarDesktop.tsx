import { memo, useMemo } from 'react';

import { isString } from 'lodash';
import { useIntl } from 'react-intl';

import {
  DashText,
  DebugRenderTracker,
  Divider,
  IconButton,
  NumberSizeableText,
  ScrollView,
  SizableText,
  SkeletonContainer,
  Tooltip,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { openHyperLiquidTokenExplorerUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import {
  usePerpsActiveAssetCtxAtom,
  useTradingModeAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  useSpotActiveAssetAtom,
  useSpotActiveAssetCtxAtom,
  useSpotExternalMarketCapsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/spot';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
  formatLocalizedNumberString,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { getSpotMarketCapValue } from '@onekeyhq/shared/src/utils/perpsUtils';
import { PERP_LAYOUT_CONFIG } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { useFundingCountdown, usePerpSession } from '../../hooks';
import { useSpotMetaMaps } from '../../hooks/useSpotMetaMaps';
import { PerpTokenSelector } from '../TokenSelector/PerpTokenSelector';
import { FavoriteButton } from '../TokenSelector/PerpTokenSelectorRow';

const TICKER_BAR_STAT_VALUE_TEXT_PROPS = {
  size: '$headingXs',
  fontFamily: '$monoRegular',
  textTransform: 'none',
  letterSpacing: 0,
} as const;

function useTickerBarIsLoading() {
  const { isReady, hasError } = usePerpSession();
  const [tradingMode] = useTradingModeAtom();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const [spotAssetCtx] = useSpotActiveAssetCtxAtom();
  const isSpot = tradingMode === 'spot';
  if (isSpot) {
    // Spot: only loading if spot ctx hasn't arrived yet.
    // Don't gate on isReady (perps WS connection state) — spot data
    // flows through the same WS but isReady can be temporarily false
    // during mode transitions while the spot subscription is active.
    return !spotAssetCtx?.ctx;
  }
  const { markPrice } = assetCtx?.ctx || {
    markPrice: '0',
  };
  return !isReady || hasError || parseFloat(markPrice) === 0;
}

const TickerBarMarkPriceView = memo(
  ({
    formattedMarkPrice,
    isLoading,
    tooltipContentId,
  }: {
    formattedMarkPrice: string;
    isLoading: boolean;
    tooltipContentId: ETranslations;
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
                  id: tooltipContentId,
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
  const [tradingMode] = useTradingModeAtom();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const [spotAssetCtx] = useSpotActiveAssetCtxAtom();
  const isSpot = tradingMode === 'spot';
  const formattedMarkPrice = isSpot
    ? formatLocalizedNumberString(spotAssetCtx?.ctx?.markPrice || '')
    : assetCtx?.ctx?.markPrice || '';
  const isLoading = useTickerBarIsLoading();
  return (
    <TickerBarMarkPriceView
      formattedMarkPrice={formattedMarkPrice}
      isLoading={isLoading}
      tooltipContentId={
        isSpot
          ? ETranslations.perp_spot_reference_price__desc
          : ETranslations.perp_mark_price_tooltip
      }
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
  const [tradingMode] = useTradingModeAtom();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const [spotAssetCtx] = useSpotActiveAssetCtxAtom();
  const change24hPercent =
    tradingMode === 'spot'
      ? spotAssetCtx?.ctx?.change24hPercent || 0
      : assetCtx?.ctx?.change24hPercent || 0;
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
              <DashText
                size="$bodySm"
                dashColor="$textDisabled"
                dashThickness={0.5}
                color="$textSubdued"
                cursor="help"
              >
                {intl.formatMessage({
                  id: ETranslations.perp_token_bar_oracle_price,
                })}
              </DashText>
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
            <SizableText
              {...TICKER_BAR_STAT_VALUE_TEXT_PROPS}
              fontVariant={['tabular-nums']}
            >
              {formattedOraclePrice}
            </SizableText>
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
            <SizableText
              {...TICKER_BAR_STAT_VALUE_TEXT_PROPS}
              fontVariant={['tabular-nums']}
            >
              ${formattedVolume24h}
            </SizableText>
          </SkeletonContainer>
        </YStack>
      </DebugRenderTracker>
    );
  },
);
TickerBar24hVolumeView.displayName = 'TickerBar24hVolumeView';

function TickerBar24hVolume() {
  const [tradingMode] = useTradingModeAtom();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const [spotAssetCtx] = useSpotActiveAssetCtxAtom();
  const isSpot = tradingMode === 'spot';
  const volume24h = isSpot
    ? spotAssetCtx?.ctx?.volume24h || '0'
    : assetCtx?.ctx?.volume24h || '0';
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
              <DashText
                size="$bodySm"
                color="$textSubdued"
                dashColor="$textDisabled"
                dashThickness={0.5}
                cursor="help"
              >
                {intl.formatMessage({
                  id: ETranslations.perp_token_bar_open_Interest,
                })}
              </DashText>
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
            <SizableText
              {...TICKER_BAR_STAT_VALUE_TEXT_PROPS}
              fontVariant={['tabular-nums']}
            >
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

const TickerBarMarketCapView = memo(
  ({
    formattedMarketCap,
    isLoading,
  }: {
    formattedMarketCap: string;
    isLoading: boolean;
  }) => {
    const intl = useIntl();
    return (
      <DebugRenderTracker name="TickerBarMarketCap">
        <YStack>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.global_market_cap,
            })}
          </SizableText>
          <SkeletonContainer isLoading={isLoading} width={80} height={16}>
            <SizableText
              {...TICKER_BAR_STAT_VALUE_TEXT_PROPS}
              fontVariant={['tabular-nums']}
            >
              {formattedMarketCap === '--'
                ? formattedMarketCap
                : `$${formattedMarketCap}`}
            </SizableText>
          </SkeletonContainer>
        </YStack>
      </DebugRenderTracker>
    );
  },
);
TickerBarMarketCapView.displayName = 'TickerBarMarketCapView';

function TickerBarMarketCap() {
  const [spotAssetCtx] = useSpotActiveAssetCtxAtom();
  const [spotMarketCaps] = useSpotExternalMarketCapsAtom();
  const marketCap = getSpotMarketCapValue(
    spotAssetCtx?.ctx,
    spotAssetCtx?.baseName ?? spotAssetCtx?.coin,
    spotMarketCaps,
  );
  const formattedMarketCap = marketCap
    ? formatDisplayNumber(NUMBER_FORMATTER.marketCap(marketCap))
    : undefined;
  const isLoading = useTickerBarIsLoading();

  return (
    <TickerBarMarketCapView
      formattedMarketCap={
        isString(formattedMarketCap) ? formattedMarketCap : '--'
      }
      isLoading={isLoading}
    />
  );
}

const TickerBarSpotContractView = memo(
  ({ contract, isLoading }: { contract?: string; isLoading: boolean }) => {
    const intl = useIntl();
    const { copyText } = useClipboard();
    const shortenedContract = contract
      ? `${contract.slice(0, 6)}...${contract.slice(-4)}`
      : '--';

    return (
      <DebugRenderTracker name="TickerBarSpotContract">
        <YStack>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.global_contract,
            })}
          </SizableText>
          <SkeletonContainer isLoading={isLoading} width={120} height={16}>
            <XStack gap="$1" alignItems="center">
              <SizableText
                {...TICKER_BAR_STAT_VALUE_TEXT_PROPS}
                color="$text"
                numberOfLines={1}
              >
                {shortenedContract}
              </SizableText>
              {contract ? (
                <>
                  <IconButton
                    size="small"
                    variant="tertiary"
                    icon="Copy3Outline"
                    iconProps={{ size: '$3', color: '$iconSubdued' }}
                    onPress={() => {
                      copyText(contract);
                    }}
                  />
                  <IconButton
                    size="small"
                    variant="tertiary"
                    icon="OpenOutline"
                    iconProps={{ size: '$3', color: '$iconSubdued' }}
                    onPress={() => {
                      void openHyperLiquidTokenExplorerUrl({
                        tokenId: contract,
                      });
                    }}
                  />
                </>
              ) : null}
            </XStack>
          </SkeletonContainer>
        </YStack>
      </DebugRenderTracker>
    );
  },
);
TickerBarSpotContractView.displayName = 'TickerBarSpotContractView';

function TickerBarSpotContract() {
  const [spotAsset] = useSpotActiveAssetAtom();
  const { tokenContractMap } = useSpotMetaMaps();
  const isLoading = useTickerBarIsLoading();
  const contract =
    tokenContractMap[spotAsset?.universe?.baseName ?? ''] ||
    tokenContractMap[spotAsset?.coin ?? ''];

  return (
    <TickerBarSpotContractView contract={contract} isLoading={isLoading} />
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
      <SizableText
        {...TICKER_BAR_STAT_VALUE_TEXT_PROPS}
        color="$text"
        fontVariant={['tabular-nums']}
      >
        {countdown}
      </SizableText>
    </DebugRenderTracker>
  );
}

const TickerBarFundingRateView = memo(
  ({
    fundingRate,
    fundingRatePercent,
    hourlyFundingRate,
    dailyFundingRate,
    weeklyFundingRate,
    monthlyFundingRate,
    annualizedFundingRate,
    countdown,
    isLoading,
  }: {
    fundingRate: number;
    fundingRatePercent: string;
    hourlyFundingRate: string;
    dailyFundingRate: string;
    weeklyFundingRate: string;
    monthlyFundingRate: string;
    annualizedFundingRate: string;
    countdown: string;
    isLoading: boolean;
  }) => {
    const intl = useIntl();
    return (
      <DebugRenderTracker name="TickerBarFundingRate">
        <YStack>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_token_bar_Funding,
            })}
          </SizableText>
          <SkeletonContainer isLoading={isLoading} width={120} height={16}>
            <XStack alignItems="center" gap="$2">
              <Tooltip
                renderTrigger={
                  <XStack alignItems="center" gap="$2">
                    <DashText
                      {...TICKER_BAR_STAT_VALUE_TEXT_PROPS}
                      fontVariant={['tabular-nums']}
                      color={fundingRate >= 0 ? '$green11' : '$red11'}
                      dashColor="$textDisabled"
                      dashThickness={0.5}
                      cursor="help"
                    >
                      {`${fundingRatePercent}%`}
                    </DashText>
                    <TickerBarFundingRateCountdown />
                  </XStack>
                }
                renderContent={
                  <YStack gap="$3" py="$2" minWidth={200}>
                    <YStack gap="$2">
                      <XStack
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <SizableText
                          size="$headingXs"
                          fontFamily="$monoRegular"
                          fontVariant={['tabular-nums']}
                          color="$textSubdued"
                        >
                          {intl.formatMessage({
                            id: ETranslations.perps_fee_rate_projection,
                          })}
                        </SizableText>
                        <SizableText
                          size="$headingXs"
                          fontFamily="$monoRegular"
                          fontVariant={['tabular-nums']}
                          color="$textSubdued"
                        >
                          {intl.formatMessage({
                            id: ETranslations.perp_position_funding,
                          })}
                        </SizableText>
                      </XStack>
                      <YStack gap="$3">
                        <XStack
                          justifyContent="space-between"
                          alignItems="center"
                        >
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
                            color={fundingRate >= 0 ? '$green11' : '$red11'}
                          >
                            {hourlyFundingRate}%
                          </SizableText>
                        </XStack>
                        <XStack
                          justifyContent="space-between"
                          alignItems="center"
                        >
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
                            color={fundingRate >= 0 ? '$green11' : '$red11'}
                          >
                            {dailyFundingRate}%
                          </SizableText>
                        </XStack>
                        <XStack
                          justifyContent="space-between"
                          alignItems="center"
                        >
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
                            color={fundingRate >= 0 ? '$green11' : '$red11'}
                          >
                            {weeklyFundingRate}%
                          </SizableText>
                        </XStack>
                        <XStack
                          justifyContent="space-between"
                          alignItems="center"
                        >
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
                            color={fundingRate >= 0 ? '$green11' : '$red11'}
                          >
                            {monthlyFundingRate}%
                          </SizableText>
                        </XStack>
                        <XStack
                          justifyContent="space-between"
                          alignItems="center"
                        >
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
                            color={fundingRate >= 0 ? '$green11' : '$red11'}
                          >
                            {annualizedFundingRate}%
                          </SizableText>
                        </XStack>
                      </YStack>
                    </YStack>
                    <Divider />
                    <YStack gap="$2" justifyContent="space-between">
                      <SizableText
                        size="$headingXs"
                        fontVariant={['tabular-nums']}
                        color="$textSubdued"
                      >
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
                    <Divider />
                    <YStack gap="$2">
                      <SizableText size="$headingXs" color="$textSubdued">
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
  const hourlyFundingRate = (fundingRate * 100).toFixed(4);
  const dailyFundingRate = (fundingRate * 100 * 24).toFixed(2);
  const weeklyFundingRate = (fundingRate * 100 * 24 * 7).toFixed(2);
  const monthlyFundingRate = (fundingRate * 100 * 24 * 30).toFixed(2);
  const annualizedFundingRate = (fundingRate * 100 * 24 * 365).toFixed(2);
  const countdown = useFundingCountdown();
  const isLoading = useTickerBarIsLoading();

  return (
    <TickerBarFundingRateView
      fundingRate={fundingRate}
      fundingRatePercent={fundingRatePercent}
      hourlyFundingRate={hourlyFundingRate}
      dailyFundingRate={dailyFundingRate}
      weeklyFundingRate={weeklyFundingRate}
      monthlyFundingRate={monthlyFundingRate}
      annualizedFundingRate={annualizedFundingRate}
      countdown={countdown}
      isLoading={isLoading}
    />
  );
}

function PerpTickerBarDesktop() {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [tradingMode] = useTradingModeAtom();
  const isSpot = tradingMode === 'spot';
  const marketDataGap = useMemo(() => (isSpot ? '$6' : '$8'), [isSpot]);
  const priceSectionWidth = useMemo(() => (isSpot ? 168 : 140), [isSpot]);
  const content = (
    <XStack
      bg="$bgApp"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      py="$4"
      pl="$5"
      pr="$3"
      alignItems="center"
      justifyContent="flex-start"
      gap="$6"
      h={PERP_LAYOUT_CONFIG.desktop.tickerBarHeight}
    >
      <XStack gap="$4" alignItems="center" minWidth={0} flexShrink={1}>
        <XStack gap="$2" alignItems="center" minWidth={0} flexShrink={1}>
          <FavoriteButton
            coin={activeTradeInstrument.coin}
            iconSize="$4"
            isSpot={isSpot}
          />
          <PerpTokenSelector />
        </XStack>

        <XStack
          alignItems="center"
          minWidth={priceSectionWidth}
          width={priceSectionWidth}
          gap="$1.5"
          flexShrink={0}
          cursor="default"
        >
          <TickerBarMarkPrice />
          <TickerBarChange24hPercent />
        </XStack>
      </XStack>

      {/* Right: Market Data */}
      <ScrollView
        cursor="default"
        horizontal
        flex={1}
        minWidth={0}
        contentContainerStyle={{
          gap: marketDataGap,
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        {isSpot ? null : <TickerBarOraclePrice />}
        <TickerBar24hVolume />
        {isSpot ? <TickerBarMarketCap /> : <TickerBarOpenInterest />}
        {isSpot ? <TickerBarSpotContract /> : null}
        {isSpot ? null : <TickerBarFundingRate />}
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
