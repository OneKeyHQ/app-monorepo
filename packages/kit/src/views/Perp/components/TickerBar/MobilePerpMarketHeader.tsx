import { memo, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  DashText,
  Icon,
  NumberSizeableText,
  Popover,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useConnectionStateAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetCtxAtom,
  useSpotActiveAssetCtxAtom,
  useSpotExternalMarketCapsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  formatLocalizedNumberString,
  numberFormat,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { getSpotMarketCapValue } from '@onekeyhq/shared/src/utils/perpsUtils';

import { useActiveTradeDisplay } from '../../hooks/useActiveTradeDisplay';

function StatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$2">
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        numberOfLines={1}
        flex={1}
        minWidth={0}
      >
        {label}
      </SizableText>
      <XStack flexShrink={0}>{children}</XStack>
    </XStack>
  );
}

function MobilePerpMarketHeader() {
  const intl = useIntl();
  const { coin, mode } = useActiveTradeDisplay();
  const [connectionState] = useConnectionStateAtom();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const [spotAssetCtx] = useSpotActiveAssetCtxAtom();
  const [spotMarketCaps] = useSpotExternalMarketCapsAtom();
  const [builderFeeRate, setBuilderFeeRate] = useState<number | undefined>();
  const hasError = connectionState.reconnectCount > 3;
  const isReady = connectionState.isConnected && !hasError;
  const isSpot = mode === 'spot';
  const spotCtxForActiveCoin =
    spotAssetCtx?.coin === coin ? spotAssetCtx.ctx : undefined;
  const perpCtxForActiveCoin =
    assetCtx?.coin === coin ? assetCtx.ctx : undefined;
  const currentCtx = isSpot ? spotCtxForActiveCoin : perpCtxForActiveCoin;

  useEffect(() => {
    void backgroundApiProxy.simpleDb.perp
      .getExpectMaxBuilderFee()
      .then((fee) => {
        setBuilderFeeRate(fee);
      });
  }, []);

  // Common fields exist on both IPerpsFormattedAssetCtx and ISpotFormattedAssetCtx
  // Spot WS may push cached markPx before midPx arrives; fall back to markPrice
  // so the header doesn't get fully hidden by skeleton when partial data is up.
  const markPrice = currentCtx?.markPrice ?? '0';
  const midPrice = useMemo(() => {
    const mid = currentCtx?.midPrice;
    if (mid && Number.parseFloat(mid) > 0) return mid;
    if (markPrice && Number.parseFloat(markPrice) > 0) return markPrice;
    return '0';
  }, [currentCtx?.midPrice, markPrice]);
  const volume24h = currentCtx?.volume24h ?? '0';
  const change24hPercent = currentCtx?.change24hPercent ?? 0;
  // Perp-only fields
  const perpCtx = perpCtxForActiveCoin;
  const fundingRate = perpCtx?.fundingRate ?? '0';
  const openInterest = perpCtx?.openInterest ?? '0';
  // Spot-only fields
  const spotCtx = spotCtxForActiveCoin;

  const midPriceNumber = useMemo(() => parseFloat(midPrice), [midPrice]);
  const fundingRateNumber = useMemo(
    () => Number.parseFloat(fundingRate ?? ''),
    [fundingRate],
  );

  const showSkeleton =
    !isReady ||
    hasError ||
    !Number.isFinite(midPriceNumber) ||
    midPriceNumber === 0;

  const fundingColor = fundingRateNumber >= 0 ? '$green11' : '$red11';
  const fundingDisplay = Number.isFinite(fundingRateNumber)
    ? `${(fundingRateNumber * 100).toFixed(4)}%`
    : '--';

  const markPriceDisplay = useMemo(() => {
    if (markPrice === undefined || markPrice === null || markPrice === '') {
      return '--';
    }
    return `$${formatLocalizedNumberString(markPrice)}`;
  }, [markPrice]);

  const volumeDisplay = useMemo(() => {
    if (volume24h === undefined || volume24h === null) {
      return '--';
    }
    const formatted = numberFormat(volume24h.toString(), {
      formatter: 'marketCap',
    });
    if (typeof formatted !== 'string' || formatted.length === 0) {
      return '--';
    }
    return `$${formatted}`;
  }, [volume24h]);

  const openInterestDisplay = useMemo(() => {
    if (isSpot) {
      const marketCap = getSpotMarketCapValue(
        {
          markPrice,
          totalSupply: spotCtx?.totalSupply,
          circulatingSupply: spotCtx?.circulatingSupply,
        },
        spotAssetCtx?.coin === coin
          ? (spotAssetCtx?.baseName ?? spotAssetCtx?.coin)
          : coin,
        spotMarketCaps,
      );
      if (!marketCap) {
        return '--';
      }
      const formatted = numberFormat(marketCap, {
        formatter: 'marketCap',
      });
      if (typeof formatted !== 'string' || formatted.length === 0) {
        return '--';
      }
      return `$${formatted}`;
    }

    if (
      openInterest === undefined ||
      openInterest === null ||
      openInterest === '' ||
      markPrice === undefined ||
      markPrice === null ||
      markPrice === ''
    ) {
      return '--';
    }
    const notional = (Number(openInterest) * Number(markPrice || 0)).toString();
    const formatted = numberFormat(notional, {
      formatter: 'marketCap',
    });
    if (typeof formatted !== 'string' || formatted.length === 0) {
      return '--';
    }
    return `$${formatted}`;
  }, [
    coin,
    isSpot,
    markPrice,
    openInterest,
    spotAssetCtx?.baseName,
    spotAssetCtx?.coin,
    spotCtx?.circulatingSupply,
    spotCtx?.totalSupply,
    spotMarketCaps,
  ]);

  const priceMetaContent = useMemo(() => {
    return (
      <XStack alignItems="center" gap="$1.5" mt="$-1">
        <Popover
          title={intl.formatMessage({
            id: isSpot
              ? ETranslations.perp_spot_reference_price__title
              : ETranslations.perp_position_mark_price,
          })}
          renderTrigger={
            <DashText
              fontSize={10}
              lineHeight={14}
              color="$textSubdued"
              dashColor="$textDisabled"
              dashThickness={0.5}
            >
              {markPriceDisplay}
            </DashText>
          }
          renderContent={
            <YStack px="$5" pb="$4">
              <SizableText size="$bodyMd" color="$text">
                {intl.formatMessage({
                  id: isSpot
                    ? ETranslations.perp_spot_reference_price__desc
                    : ETranslations.perp_mark_price_tooltip,
                })}
              </SizableText>
            </YStack>
          }
        />
        <XStack alignItems="center" gap="$1">
          <Icon
            name={
              change24hPercent >= 0
                ? 'ArrowTriangleTopSolid'
                : 'ArrowTriangleBottomSolid'
            }
            size="$2"
            color={change24hPercent >= 0 ? '$green11' : '$red11'}
          />
          <NumberSizeableText
            fontSize={10}
            color={change24hPercent >= 0 ? '$green11' : '$red11'}
            formatter="priceChange"
            formatterOptions={{
              showPlusMinusSigns: true,
            }}
          >
            {change24hPercent}
          </NumberSizeableText>
        </XStack>
      </XStack>
    );
  }, [change24hPercent, intl, isSpot, markPriceDisplay]);

  if (showSkeleton) {
    const statItems = [
      {
        label: intl.formatMessage({
          id: ETranslations.perp_token_bar_24h_Volume,
        }),
        valueWidth: 80,
      },
      {
        label: intl.formatMessage({
          id: isSpot
            ? ETranslations.global_market_cap
            : ETranslations.perp_token_bar_open_Interest,
        }),
        valueWidth: 80,
      },
    ];

    if (!isSpot) {
      statItems.push({
        label: intl.formatMessage({
          id: ETranslations.perp_position_funding,
        }),
        valueWidth: 64,
      });
    }

    if (!isSpot && builderFeeRate === 0) {
      statItems.push({
        label: intl.formatMessage({
          id: ETranslations.referral_perps_onekey_fee,
        }),
        valueWidth: 48,
      });
    }

    return (
      <YStack bg="$bgApp" px="$5" pt="$3" gap="$2">
        <XStack alignItems="flex-start" gap="$4">
          <YStack flex={1} minWidth={0} width="50%">
            <DashText
              size="$bodySm"
              color="$textSubdued"
              dashColor="$textDisabled"
              dashThickness={0.5}
            >
              {intl.formatMessage({
                id: ETranslations.perp_order_mid_price_title,
              })}
            </DashText>
            <Skeleton
              width={isSpot ? 144 : 136}
              height={40}
              mt="$1"
              mb="$1"
              borderRadius="$2"
            />
          </YStack>

          <YStack gap="$1.5" flex={1} minWidth={0} width="50%">
            {statItems.map((item) => (
              <StatRow key={item.label} label={item.label}>
                <Skeleton width={item.valueWidth} height={16} />
              </StatRow>
            ))}
          </YStack>
        </XStack>
      </YStack>
    );
  }

  return (
    <YStack bg="$bgApp" px="$5" pt="$3" gap="$2">
      <XStack alignItems="flex-start" gap="$4">
        <YStack flex={1} minWidth={0} width="50%">
          <>
            <Popover
              title={intl.formatMessage({
                id: ETranslations.perp_order_mid_price_title,
              })}
              renderTrigger={
                <DashText
                  size="$bodySm"
                  color="$textSubdued"
                  dashColor="$textDisabled"
                  dashThickness={0.5}
                >
                  {intl.formatMessage({
                    id: ETranslations.perp_order_mid_price_title,
                  })}
                </DashText>
              }
              renderContent={
                <YStack px="$5" pb="$4">
                  <SizableText size="$bodyMd" color="$text">
                    {intl.formatMessage({
                      id: ETranslations.perp_order_mid_price_title_desc,
                    })}
                  </SizableText>
                </YStack>
              }
            />
            <SizableText size="$heading2xl">{midPrice}</SizableText>
          </>

          {priceMetaContent}
        </YStack>

        <YStack gap="$1.5" flex={1} minWidth={0} width="50%">
          <StatRow
            label={intl.formatMessage({
              id: ETranslations.perp_token_bar_24h_Volume,
            })}
          >
            <SizableText size="$bodySmMedium" color="$text" textAlign="right">
              {volumeDisplay}
            </SizableText>
          </StatRow>

          <StatRow
            label={intl.formatMessage({
              id: isSpot
                ? ETranslations.global_market_cap
                : ETranslations.perp_token_bar_open_Interest,
            })}
          >
            <SizableText size="$bodySmMedium" color="$text" textAlign="right">
              {openInterestDisplay}
            </SizableText>
          </StatRow>

          {isSpot ? null : (
            <StatRow
              label={intl.formatMessage({
                id: ETranslations.perp_position_funding,
              })}
            >
              <SizableText
                size="$bodySmMedium"
                textAlign="right"
                color={fundingColor}
              >
                {fundingDisplay}
              </SizableText>
            </StatRow>
          )}

          {!isSpot && builderFeeRate === 0 ? (
            <XStack alignItems="center" justifyContent="space-between" gap="$1">
              <Popover
                title={intl.formatMessage({
                  id: ETranslations.referral_perps_onekey_fee,
                })}
                renderTrigger={
                  <DashText
                    size="$bodySm"
                    color="$textSubdued"
                    dashColor="$textDisabled"
                    dashThickness={0.5}
                  >
                    {intl.formatMessage({
                      id: ETranslations.referral_perps_onekey_fee,
                    })}
                  </DashText>
                }
                renderContent={
                  <YStack px="$5" pb="$4">
                    <SizableText size="$bodyMd" color="$text">
                      {intl.formatMessage({
                        id: ETranslations.perps_0_fee_desc,
                      })}
                    </SizableText>
                  </YStack>
                }
              />
              <SizableText
                size="$bodySmMedium"
                textAlign="right"
                color="$green11"
              >
                0%
              </SizableText>
            </XStack>
          ) : null}
        </YStack>
      </XStack>
    </YStack>
  );
}

const MobilePerpMarketHeaderMemo = memo(MobilePerpMarketHeader);
export { MobilePerpMarketHeaderMemo as MobilePerpMarketHeader };
