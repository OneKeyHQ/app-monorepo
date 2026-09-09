import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { useIntl } from 'react-intl';
import Svg, { Circle } from 'react-native-svg';

import {
  Button,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  formatPerpsUsd,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IUserFunding } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  type IFundingDistributionRow,
  type IPortfolioTimePeriod,
  buildFundingDirectionDistribution,
} from './portfolioStats';

import type {
  GestureResponderEvent,
  PointerEvent as NativePointerEvent,
  View as RNView,
} from 'react-native';

const MOBILE_FUNDING_DISTRIBUTION_CARD_HEIGHT = 220;
const DONUT_SIZE = 112;
const DONUT_STROKE_WIDTH = 7;
const DONUT_ACTIVE_STROKE_WIDTH = 10;
const DONUT_HIT_STROKE_WIDTH = 24;
const DONUT_VISUAL_GAP = 4;
const DONUT_MIN_VISIBLE_SLICE_LENGTH = DONUT_ACTIVE_STROKE_WIDTH;
const DONUT_RADIUS = (DONUT_SIZE - DONUT_ACTIVE_STROKE_WIDTH) / 2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const DONUT_CENTER = DONUT_SIZE / 2;

function FundingDistributionCardSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <YStack
      flex={isMobile ? undefined : 1}
      height={isMobile ? MOBILE_FUNDING_DISTRIBUTION_CARD_HEIGHT : undefined}
      bg="$bgSubdued"
      borderRadius="$3"
      p="$3.5"
      gap="$3"
    >
      <XStack justifyContent="space-between" alignItems="center">
        <Skeleton width="$20" height="$4" />
        <Skeleton width="$24" height="$5" />
      </XStack>
      <XStack gap="$4" alignItems="center">
        <Skeleton width={DONUT_SIZE} height={DONUT_SIZE} borderRadius="$full" />
        <YStack flex={1} gap="$2">
          {Array.from({ length: 5 }, (_unusedRow, rowIndex) => (
            <Skeleton key={rowIndex} width="100%" height="$4" />
          ))}
        </YStack>
      </XStack>
    </YStack>
  );
}

type IFundingDonutSlice = IFundingDistributionRow & {
  color: string;
  dashOffset: number;
  percentage: string;
  arcLength: number;
};

function ensureMinimumVisibleSliceLengths(rawLengths: number[]) {
  const totalLength = rawLengths.reduce((sum, length) => sum + length, 0);
  const minimumArcLength = DONUT_VISUAL_GAP + DONUT_MIN_VISIBLE_SLICE_LENGTH;
  if (
    rawLengths.length === 0 ||
    minimumArcLength * rawLengths.length >= totalLength
  ) {
    return rawLengths;
  }

  const shortfall = rawLengths.reduce(
    (sum, length) => sum + Math.max(minimumArcLength - length, 0),
    0,
  );
  const donorLength = rawLengths.reduce(
    (sum, length) => sum + Math.max(length - minimumArcLength, 0),
    0,
  );
  if (shortfall === 0 || donorLength === 0) {
    return rawLengths;
  }

  // Preserve a short, full-width rounded arc for tiny non-zero slices while
  // borrowing the required circumference proportionally from larger slices.
  return rawLengths.map((length) =>
    length < minimumArcLength
      ? minimumArcLength
      : length - shortfall * ((length - minimumArcLength) / donorLength),
  );
}

type ISvgWebHoverProps = {
  cursor?: 'pointer';
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

function FundingDonutSegment({
  slice,
  isActive,
  hasActiveSlice,
  onHover,
}: {
  slice: IFundingDonutSlice;
  isActive: boolean;
  hasActiveSlice: boolean;
  onHover: (coin: string | null) => void;
}) {
  const webHoverProps: ISvgWebHoverProps = platformEnv.isNative
    ? {}
    : {
        cursor: 'pointer',
        onMouseEnter: () => onHover(slice.coin),
        onMouseLeave: () => onHover(null),
      };
  const strokeWidth = isActive ? DONUT_ACTIVE_STROKE_WIDTH : DONUT_STROKE_WIDTH;
  const visibleLength = Math.max(
    slice.arcLength - DONUT_VISUAL_GAP - strokeWidth,
    0.01,
  );

  return (
    <>
      <Circle
        {...webHoverProps}
        cx={DONUT_CENTER}
        cy={DONUT_CENTER}
        r={DONUT_RADIUS}
        stroke="#000"
        strokeWidth={DONUT_HIT_STROKE_WIDTH}
        strokeOpacity={0.001}
        fill="none"
        strokeDasharray={`${slice.arcLength} ${DONUT_CIRCUMFERENCE - slice.arcLength}`}
        strokeDashoffset={slice.dashOffset}
        rotation={-90}
        origin={`${DONUT_CENTER}, ${DONUT_CENTER}`}
        pointerEvents={platformEnv.isNative ? 'none' : 'auto'}
      />
      <Circle
        pointerEvents="none"
        cx={DONUT_CENTER}
        cy={DONUT_CENTER}
        r={DONUT_RADIUS}
        stroke={slice.color}
        strokeWidth={strokeWidth}
        strokeOpacity={hasActiveSlice && !isActive ? 0.28 : 1}
        fill="none"
        strokeDasharray={`${visibleLength} ${DONUT_CIRCUMFERENCE - visibleLength}`}
        strokeDashoffset={slice.dashOffset}
        strokeLinecap="round"
        rotation={-90}
        origin={`${DONUT_CENTER}, ${DONUT_CENTER}`}
      />
    </>
  );
}

function FundingDistributionLegendRow({
  slice,
  isActive,
  hasActiveSlice,
  onHover,
  onSelect,
}: {
  slice: IFundingDonutSlice;
  isActive: boolean;
  hasActiveSlice: boolean;
  onHover: (coin: string | null) => void;
  onSelect: (coin: string) => void;
}) {
  const intl = useIntl();
  const handleHoverStart = useCallback(() => {
    onHover(slice.coin);
  }, [onHover, slice.coin]);
  const handleHoverEnd = useCallback(() => {
    onHover(null);
  }, [onHover]);
  const handleNativePress = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      onSelect(slice.coin);
    },
    [onSelect, slice.coin],
  );

  return (
    <XStack
      minHeight={22}
      alignItems="center"
      gap="$1.5"
      opacity={hasActiveSlice && !isActive ? 0.42 : 1}
      onPointerEnter={platformEnv.isNative ? undefined : handleHoverStart}
      onPointerLeave={platformEnv.isNative ? undefined : handleHoverEnd}
      onPress={platformEnv.isNative ? handleNativePress : undefined}
      $platform-web={{
        cursor: 'pointer',
        transition: 'opacity 150ms ease',
      }}
    >
      <Stack
        width="$1.5"
        height="$1.5"
        borderRadius="$full"
        bg={slice.color}
        flexShrink={0}
      />
      <SizableText
        flex={1}
        minWidth={0}
        size="$bodyXsMedium"
        color={isActive ? '$text' : '$textSubdued'}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {slice.coin === 'Other'
          ? intl.formatMessage({ id: ETranslations.global_others })
          : parseDexCoin(slice.coin).displayName}{' '}
        {slice.percentage}
      </SizableText>
      <SizableText
        size="$bodyXs"
        color={isActive ? '$text' : '$textDisabled'}
        numberOfLines={1}
        fontVariant={['tabular-nums']}
      >
        {formatPerpsUsd(slice.amount)}
      </SizableText>
    </XStack>
  );
}

function FundingDistributionCard({
  rows,
  title,
  isLoading,
  direction,
  isMobile,
}: {
  rows: IFundingDistributionRow[];
  title: string;
  isLoading: boolean;
  direction: 'received' | 'paid';
  isMobile: boolean;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const [hoveredCoin, setHoveredCoin] = useState<string | null>(null);
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);
  const donutContainerRef = useRef<RNView>(null);
  const donutOriginRef = useRef<{ x: number; y: number } | null>(null);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const formattedTotal = formatPerpsUsd(total);
  const colors =
    direction === 'received'
      ? [theme.green9, theme.blue9, theme.purple9, theme.orange9, theme.teal9]
      : [theme.red9, theme.pink9, theme.orange9, theme.purple9, theme.blue9];
  const rawLengths = rows.map(
    (row) => (row.amount / total) * DONUT_CIRCUMFERENCE,
  );
  const arcLengths = ensureMinimumVisibleSliceLengths(rawLengths);
  let cumulativeLength = 0;
  const slices = rows.map((row, index): IFundingDonutSlice => {
    const arcLength = arcLengths[index] ?? 0;
    const color =
      row.coin === 'Other'
        ? theme.neutral6.val
        : (colors[index]?.val ?? theme.neutral6.val);
    const slice = {
      ...row,
      color,
      dashOffset: -cumulativeLength,
      percentage: `${((row.amount / total) * 100).toFixed(2)}%`,
      arcLength,
    };
    cumulativeLength += arcLength;
    return slice;
  });
  const activeCoinCandidate = hoveredCoin ?? selectedCoin;
  const activeCoin = slices.some((slice) => slice.coin === activeCoinCandidate)
    ? activeCoinCandidate
    : null;
  const handleCardPress = useCallback(() => {
    setHoveredCoin(null);
    setSelectedCoin(null);
  }, []);
  const getDonutCoinAtPoint = useCallback(
    (x: number, y: number) => {
      const deltaX = x - DONUT_CENTER;
      const deltaY = y - DONUT_CENTER;
      const distanceFromCenter = Math.hypot(deltaX, deltaY);
      if (
        Math.abs(distanceFromCenter - DONUT_RADIUS) >
        DONUT_HIT_STROKE_WIDTH / 2
      ) {
        return null;
      }

      const fullCircleRadians = Math.PI * 2;
      const angleFromTop =
        (Math.atan2(deltaY, deltaX) + Math.PI / 2 + fullCircleRadians) %
        fullCircleRadians;
      const lengthAtPoint =
        (angleFromTop / fullCircleRadians) * DONUT_CIRCUMFERENCE;
      let traversedLength = 0;

      for (const slice of slices) {
        traversedLength += slice.arcLength;
        if (lengthAtPoint < traversedLength) {
          return slice.coin;
        }
      }

      return slices.at(-1)?.coin ?? null;
    },
    [slices],
  );
  const handleDonutNativePress = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      const coin = getDonutCoinAtPoint(
        event.nativeEvent.locationX,
        event.nativeEvent.locationY,
      );
      if (coin) {
        setSelectedCoin(coin);
      } else {
        handleCardPress();
      }
    },
    [getDonutCoinAtPoint, handleCardPress],
  );
  const handleDonutNativePointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement> | NativePointerEvent) => {
      if (event.nativeEvent.pointerType === 'touch') {
        return;
      }
      const { pageX, pageY } = event.nativeEvent;
      const origin = donutOriginRef.current;
      if (origin) {
        setHoveredCoin(getDonutCoinAtPoint(pageX - origin.x, pageY - origin.y));
        return;
      }
      donutContainerRef.current?.measure(
        (_x, _y, _width, _height, measuredPageX, measuredPageY) => {
          const measuredOrigin = { x: measuredPageX, y: measuredPageY };
          donutOriginRef.current = measuredOrigin;
          setHoveredCoin(
            getDonutCoinAtPoint(
              pageX - measuredOrigin.x,
              pageY - measuredOrigin.y,
            ),
          );
        },
      );
    },
    [getDonutCoinAtPoint],
  );
  const handleDonutNativePointerLeave = useCallback(() => {
    donutOriginRef.current = null;
    setHoveredCoin(null);
  }, []);

  if (isLoading && rows.length === 0) {
    return <FundingDistributionCardSkeleton isMobile={isMobile} />;
  }

  return (
    <YStack
      flex={isMobile ? undefined : 1}
      height={isMobile ? MOBILE_FUNDING_DISTRIBUTION_CARD_HEIGHT : undefined}
      bg="$bgSubdued"
      borderRadius="$3"
      p="$3.5"
      gap="$2.5"
      onPress={platformEnv.isNative ? handleCardPress : undefined}
    >
      <XStack justifyContent="space-between" alignItems="baseline" gap="$3">
        <SizableText
          size="$bodySmMedium"
          color="$textDisabled"
          numberOfLines={1}
        >
          {title}
        </SizableText>
        <SizableText
          size="$bodySmMedium"
          color="$text"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          fontVariant={['tabular-nums']}
        >
          {formattedTotal}
        </SizableText>
      </XStack>
      {rows.length > 0 ? (
        <XStack flex={1} alignItems="center" gap="$6">
          <XStack
            ref={donutContainerRef}
            position="relative"
            width={DONUT_SIZE}
            height={DONUT_SIZE}
            flexShrink={0}
            accessibilityRole="image"
            accessibilityLabel={`${title}: ${formattedTotal}`}
            onPress={platformEnv.isNative ? handleDonutNativePress : undefined}
            onPointerEnter={
              platformEnv.isNative ? handleDonutNativePointer : undefined
            }
            onPointerMove={
              platformEnv.isNative ? handleDonutNativePointer : undefined
            }
            onPointerLeave={
              platformEnv.isNative ? handleDonutNativePointerLeave : undefined
            }
          >
            <Svg
              width={DONUT_SIZE}
              height={DONUT_SIZE}
              pointerEvents={platformEnv.isNative ? 'none' : 'auto'}
            >
              <Circle
                cx={DONUT_CENTER}
                cy={DONUT_CENTER}
                r={DONUT_RADIUS}
                stroke={theme.bgSubdued.val}
                strokeWidth={DONUT_STROKE_WIDTH}
                fill="none"
              />
              {slices.map((slice) => (
                <FundingDonutSegment
                  key={slice.coin}
                  slice={slice}
                  isActive={activeCoin === slice.coin}
                  hasActiveSlice={activeCoin !== null}
                  onHover={setHoveredCoin}
                />
              ))}
            </Svg>
          </XStack>
          <YStack flex={1} minWidth={0} gap="$1">
            {slices.map((slice) => (
              <FundingDistributionLegendRow
                key={slice.coin}
                slice={slice}
                isActive={activeCoin === slice.coin}
                hasActiveSlice={activeCoin !== null}
                onHover={setHoveredCoin}
                onSelect={setSelectedCoin}
              />
            ))}
          </YStack>
        </XStack>
      ) : (
        <XStack flex={1} minHeight={DONUT_SIZE} alignItems="center" gap="$6">
          <XStack
            width={DONUT_SIZE}
            height={DONUT_SIZE}
            alignItems="center"
            justifyContent="center"
          >
            <Svg
              width={DONUT_SIZE}
              height={DONUT_SIZE}
              pointerEvents={platformEnv.isNative ? 'none' : 'auto'}
            >
              <Circle
                cx={DONUT_CENTER}
                cy={DONUT_CENTER}
                r={DONUT_RADIUS}
                stroke={theme.neutral5.val}
                strokeWidth={DONUT_STROKE_WIDTH}
                fill="none"
              />
            </Svg>
          </XStack>
          <SizableText
            flex={1}
            size="$bodySm"
            color="$textSubdued"
            textAlign="center"
          >
            {intl.formatMessage({
              id: ETranslations.perp_portfolio_funding_empty__desc,
            })}
          </SizableText>
        </XStack>
      )}
    </YStack>
  );
}

export function PerpFundingBreakdown({
  records,
  timePeriod,
  isLoading,
  isError,
  onRetry,
  isMobile,
}: {
  records: IUserFunding[];
  timePeriod: IPortfolioTimePeriod;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  isMobile: boolean;
}) {
  const intl = useIntl();
  const distribution = useMemo(
    () =>
      buildFundingDirectionDistribution({
        records,
        timePeriod,
      }),
    [records, timePeriod],
  );

  if (isError) {
    return (
      <YStack
        flex={isMobile ? undefined : 1}
        minHeight={
          isMobile ? MOBILE_FUNDING_DISTRIBUTION_CARD_HEIGHT : undefined
        }
        alignItems="center"
        justifyContent="center"
        gap="$3"
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_failed })}
        </SizableText>
        <Button
          testID="perp-funding-breakdown-retry"
          size="small"
          variant="secondary"
          onPress={onRetry}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      </YStack>
    );
  }

  return (
    <YStack flex={isMobile ? undefined : 1} gap="$3">
      <FundingDistributionCard
        rows={distribution.received}
        title={intl.formatMessage({
          id: ETranslations.perp_portfolio_funding_total_received__label,
        })}
        isLoading={isLoading}
        direction="received"
        isMobile={isMobile}
      />
      <FundingDistributionCard
        rows={distribution.paid}
        title={intl.formatMessage({
          id: ETranslations.perp_portfolio_funding_total_paid__label,
        })}
        isLoading={isLoading}
        direction="paid"
        isMobile={isMobile}
      />
    </YStack>
  );
}
