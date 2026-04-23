import { memo, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  DashText,
  Icon,
  IconButton,
  NumberSizeableText,
  Popover,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useConnectionStateAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetCtxAtom,
  useSpotActiveAssetCtxAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useSpotActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/spot';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { useActiveTradeDisplay } from '../../hooks/useActiveTradeDisplay';
import { useSpotMetaMaps } from '../../hooks/useSpotMetaMaps';

function StatRow({
  label,
  children,
  skeletonWidth,
  showSkeleton,
}: {
  label: string;
  children: ReactNode;
  skeletonWidth: number;
  showSkeleton: boolean;
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$1">
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      {showSkeleton ? <Skeleton width={skeletonWidth} height={16} /> : children}
    </XStack>
  );
}

function MobilePerpMarketHeader() {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const { mode } = useActiveTradeDisplay();
  const [connectionState] = useConnectionStateAtom();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const [spotAssetCtx] = useSpotActiveAssetCtxAtom();
  const [spotAsset] = useSpotActiveAssetAtom();
  const { tokenContractMap } = useSpotMetaMaps();
  const [builderFeeRate, setBuilderFeeRate] = useState<number | undefined>();
  const hasError = connectionState.reconnectCount > 3;
  const isReady = connectionState.isConnected && !hasError;
  const isSpot = mode === 'spot';
  const currentCtx = isSpot ? spotAssetCtx?.ctx : assetCtx?.ctx;

  useEffect(() => {
    void backgroundApiProxy.simpleDb.perp
      .getExpectMaxBuilderFee()
      .then((fee) => {
        setBuilderFeeRate(fee);
      });
  }, []);

  // Common fields exist on both IPerpsFormattedAssetCtx and ISpotFormattedAssetCtx
  const midPrice = currentCtx?.midPrice ?? '0';
  const markPrice = currentCtx?.markPrice ?? '0';
  const volume24h = currentCtx?.volume24h ?? '0';
  const change24hPercent = currentCtx?.change24hPercent ?? 0;
  // Perp-only fields
  const perpCtx = assetCtx?.ctx;
  const fundingRate = perpCtx?.fundingRate ?? '0';
  const openInterest = perpCtx?.openInterest ?? '0';
  // Spot-only fields
  const spotCtx = spotAssetCtx?.ctx;
  const circulatingSupply = spotCtx?.circulatingSupply ?? '0';

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
    return `$${markPrice}`;
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
      const marketCap = (
        Number(circulatingSupply || 0) * Number(markPrice || 0)
      ).toString();
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
  }, [circulatingSupply, isSpot, markPrice, openInterest]);

  const spotContract =
    tokenContractMap[spotAsset?.universe?.baseName ?? ''] ||
    tokenContractMap[spotAsset?.coin ?? ''];
  const spotContractDisplay = spotContract
    ? `${spotContract.slice(0, 6)}...${spotContract.slice(-4)}`
    : '--';

  return (
    <YStack bg="$bgApp" px="$5" pt="$3" gap="$2">
      <XStack alignItems="flex-start" gap="$4">
        <YStack flex={1} minWidth={0} width="50%">
          {showSkeleton ? (
            <Skeleton width={120} height={28} />
          ) : (
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
          )}

          {showSkeleton ? (
            <Skeleton width={72} height={16} />
          ) : (
            <XStack alignItems="center" gap="$1" mt="$-1">
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
          )}
          <XStack alignItems="center" gap="$1" mt="$-1">
            <SizableText fontSize={10} color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_position_mark_price,
              })}
            </SizableText>
            <SizableText fontSize={10} color="$text">
              {markPriceDisplay}
            </SizableText>
          </XStack>
        </YStack>

        <YStack gap="$1.5" flex={1} minWidth={0} width="50%">
          <StatRow
            label={intl.formatMessage({
              id: ETranslations.perp_token_bar_24h_Volume,
            })}
            skeletonWidth={120}
            showSkeleton={showSkeleton}
          >
            <SizableText
              size="$bodySmMedium"
              color="$text"
              flex={1}
              textAlign="right"
            >
              {volumeDisplay}
            </SizableText>
          </StatRow>

          <StatRow
            label={intl.formatMessage({
              id: isSpot
                ? ETranslations.global_market_cap
                : ETranslations.perp_token_bar_open_Interest,
            })}
            skeletonWidth={120}
            showSkeleton={showSkeleton}
          >
            <SizableText
              size="$bodySmMedium"
              color="$text"
              flex={1}
              textAlign="right"
            >
              {openInterestDisplay}
            </SizableText>
          </StatRow>

          {isSpot ? (
            <StatRow
              label={intl.formatMessage({
                id: ETranslations.global_contract,
              })}
              skeletonWidth={120}
              showSkeleton={showSkeleton}
            >
              <XStack
                flex={1}
                justifyContent="flex-end"
                alignItems="center"
                gap="$1"
              >
                <SizableText
                  size="$bodySmMedium"
                  color="$text"
                  fontFamily="$monoRegular"
                >
                  {spotContractDisplay}
                </SizableText>
                {spotContract ? (
                  <IconButton
                    variant="tertiary"
                    size="small"
                    icon="Copy3Outline"
                    iconSize="$3"
                    onPress={() => {
                      copyText(spotContract);
                    }}
                  />
                ) : null}
              </XStack>
            </StatRow>
          ) : null}

          {isSpot ? null : (
            <StatRow
              label={intl.formatMessage({
                id: ETranslations.perp_position_funding,
              })}
              skeletonWidth={140}
              showSkeleton={showSkeleton}
            >
              <SizableText
                size="$bodySmMedium"
                flex={1}
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
                flex={1}
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
