import { memo, useMemo } from 'react';
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
import { usePerpsActiveAssetCtxAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { usePerpSession } from '../../hooks';

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
  const { isReady, hasError } = usePerpSession();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();

  const {
    markPrice,
    oraclePrice,
    fundingRate,
    openInterest,
    volume24h,
    change24hPercent,
  } = assetCtx?.ctx || {
    markPrice: '0',
    oraclePrice: '0',
    fundingRate: '0',
    openInterest: '0',
    volume24h: '0',
    change24hPercent: 0,
  };

  const markPriceNumber = useMemo(() => parseFloat(markPrice), [markPrice]);
  const fundingRateNumber = useMemo(
    () => Number.parseFloat(fundingRate ?? ''),
    [fundingRate],
  );

  const showSkeleton =
    !isReady ||
    hasError ||
    !Number.isFinite(markPriceNumber) ||
    markPriceNumber === 0;

  const fundingColor = fundingRateNumber >= 0 ? '$green11' : '$red11';
  const fundingDisplay = Number.isFinite(fundingRateNumber)
    ? `${(fundingRateNumber * 100).toFixed(4)}%`
    : '--';

  const oraclePriceDisplay = useMemo(() => {
    if (
      oraclePrice === undefined ||
      oraclePrice === null ||
      oraclePrice === ''
    ) {
      return '--';
    }
    return `$${oraclePrice}`;
  }, [oraclePrice]);

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
  }, [markPrice, openInterest]);

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
                  id: ETranslations.perp_position_mark_price,
                })}
                renderTrigger={
                  <DashText
                    size="$bodySm"
                    color="$textSubdued"
                    dashColor="$textDisabled"
                    dashThickness={0.5}
                  >
                    {intl.formatMessage({
                      id: ETranslations.perp_position_mark_price,
                    })}
                  </DashText>
                }
                renderContent={
                  <YStack px="$5" pb="$4">
                    <SizableText size="$bodyMd" color="$text">
                      {intl.formatMessage({
                        id: ETranslations.perp_mark_price_tooltip,
                      })}
                    </SizableText>
                  </YStack>
                }
              />
              <SizableText size="$heading2xl">{`$${markPrice}`}</SizableText>
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
                id: ETranslations.perp_token_bar_oracle_price,
              })}
            </SizableText>
            <SizableText fontSize={10} color="$text">
              {oraclePriceDisplay}
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
              id: ETranslations.perp_token_bar_open_Interest,
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
        </YStack>
      </XStack>
    </YStack>
  );
}

const MobilePerpMarketHeaderMemo = memo(MobilePerpMarketHeader);
export { MobilePerpMarketHeaderMemo as MobilePerpMarketHeader };
