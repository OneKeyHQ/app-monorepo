import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { useIntl } from 'react-intl';
import Svg, { Circle } from 'react-native-svg';

import {
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

const FUNDING_DISTRIBUTION_BASE_MARKET_LIMIT = 5;
const MOBILE_FUNDING_DISTRIBUTION_CARD_HEIGHT = 220;
const DONUT_SIZE = 112;
const DONUT_STROKE_WIDTH = 7;
const DONUT_ACTIVE_STROKE_WIDTH = 10;
const DONUT_HIT_STROKE_WIDTH = 24;
const DONUT_VISUAL_GAP = 4;
const DONUT_MIN_VISIBLE_SLICE_LENGTH = DONUT_ACTIVE_STROKE_WIDTH;

function formatMarketName(coin: string) {
  return parseDexCoin(coin).displayName;
}

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

function formatDistributionPercentage(amount: number, total: number) {
  if (total <= 0) return '0.00%';
  return `${((amount / total) * 100).toFixed(2)}%`;
}

type IFundingDonutSlice = IFundingDistributionRow & {
  color: string;
  indicatorColor: string;
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

  const missingLength = rawLengths.reduce(
    (sum, length) => sum + Math.max(minimumArcLength - length, 0),
    0,
  );
  if (missingLength === 0) {
    return rawLengths;
  }

  const availableLength = rawLengths.reduce(
    (sum, length) => sum + Math.max(length - minimumArcLength, 0),
    0,
  );
  if (availableLength === 0) {
    return rawLengths;
  }

  // Preserve a short, full-width rounded arc for tiny non-zero slices while
  // borrowing the required circumference proportionally from larger slices.
  return rawLengths.map((length) => {
    if (length < minimumArcLength) {
      return minimumArcLength;
    }
    const availableShare = (length - minimumArcLength) / availableLength;
    return length - missingLength * availableShare;
  });
}

type ISvgWebHoverProps = {
  cursor?: 'pointer';
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

function FundingDonutSegment({
  slice,
  radius,
  circumference,
  center,
  isActive,
  hasActiveSlice,
  onHoveredCoinChange,
}: {
  slice: IFundingDonutSlice;
  radius: number;
  circumference: number;
  center: number;
  isActive: boolean;
  hasActiveSlice: boolean;
  onHoveredCoinChange: (coin: string | null) => void;
}) {
  const handleHoverStart = useCallback(() => {
    onHoveredCoinChange(slice.coin);
  }, [onHoveredCoinChange, slice.coin]);
  const handleHoverEnd = useCallback(() => {
    onHoveredCoinChange(null);
  }, [onHoveredCoinChange]);
  const webHoverProps: ISvgWebHoverProps = platformEnv.isNative
    ? {}
    : {
        cursor: 'pointer',
        onMouseEnter: handleHoverStart,
        onMouseLeave: handleHoverEnd,
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
        cx={center}
        cy={center}
        r={radius}
        stroke="#000"
        strokeWidth={DONUT_HIT_STROKE_WIDTH}
        strokeOpacity={0.001}
        fill="none"
        strokeDasharray={`${slice.arcLength} ${circumference - slice.arcLength}`}
        strokeDashoffset={slice.dashOffset}
        rotation={-90}
        origin={`${center}, ${center}`}
        pointerEvents={platformEnv.isNative ? 'none' : 'auto'}
        onPressIn={platformEnv.isNative ? undefined : handleHoverStart}
      />
      <Circle
        pointerEvents="none"
        cx={center}
        cy={center}
        r={radius}
        stroke={slice.color}
        strokeWidth={strokeWidth}
        strokeOpacity={hasActiveSlice && !isActive ? 0.28 : 1}
        fill="none"
        strokeDasharray={`${visibleLength} ${circumference - visibleLength}`}
        strokeDashoffset={slice.dashOffset}
        strokeLinecap="round"
        rotation={-90}
        origin={`${center}, ${center}`}
      />
    </>
  );
}

function FundingDistributionLegendRow({
  slice,
  isActive,
  hasActiveSlice,
  onHoveredCoinChange,
  onSelectedCoinChange,
}: {
  slice: IFundingDonutSlice;
  isActive: boolean;
  hasActiveSlice: boolean;
  onHoveredCoinChange: (coin: string | null) => void;
  onSelectedCoinChange: (coin: string) => void;
}) {
  const intl = useIntl();
  const handleHoverStart = useCallback(() => {
    onHoveredCoinChange(slice.coin);
  }, [onHoveredCoinChange, slice.coin]);
  const handleHoverEnd = useCallback(() => {
    onHoveredCoinChange(null);
  }, [onHoveredCoinChange]);
  const handleNativePress = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      onSelectedCoinChange(slice.coin);
    },
    [onSelectedCoinChange, slice.coin],
  );

  return (
    <XStack
      minHeight={22}
      alignItems="center"
      gap="$1.5"
      opacity={hasActiveSlice && !isActive ? 0.42 : 1}
      onHoverIn={platformEnv.isNative ? undefined : handleHoverStart}
      onHoverOut={platformEnv.isNative ? undefined : handleHoverEnd}
      onPressIn={platformEnv.isNative ? handleNativePress : handleHoverStart}
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
        bg={slice.indicatorColor}
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
          : formatMarketName(slice.coin)}{' '}
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
  const radius = (DONUT_SIZE - DONUT_ACTIVE_STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = DONUT_SIZE / 2;
  const slices = useMemo(() => {
    let cumulativeLength = 0;
    const colorValues =
      direction === 'received'
        ? [
            theme.green9?.val ?? '#30A46C',
            theme.blue9?.val ?? '#0090FF',
            theme.purple9?.val ?? '#8E4EC6',
            theme.orange9?.val ?? '#F76B15',
            theme.teal9?.val ?? '#12A594',
          ]
        : [
            theme.red9?.val ?? '#E5484D',
            theme.pink9?.val ?? '#D6409F',
            theme.orange9?.val ?? '#F76B15',
            theme.purple9?.val ?? '#8E4EC6',
            theme.blue9?.val ?? '#0090FF',
          ];
    const rawLengths = rows.map((row) =>
      Math.max((row.amount / total) * circumference, 0),
    );
    const arcLengths = ensureMinimumVisibleSliceLengths(rawLengths);
    return rows.map((row, index): IFundingDonutSlice => {
      const arcLength = arcLengths[index] ?? rawLengths[index] ?? 0;
      const isOther = row.coin === 'Other';
      const color = colorValues[index] ?? theme.neutral6.val;
      const slice = {
        ...row,
        color: isOther ? theme.neutral6.val : color,
        indicatorColor: isOther ? theme.neutral6.val : color,
        dashOffset: -cumulativeLength,
        percentage: formatDistributionPercentage(row.amount, total),
        arcLength,
      };
      cumulativeLength += arcLength;
      return slice;
    });
  }, [
    circumference,
    direction,
    rows,
    theme.blue9?.val,
    theme.green9?.val,
    theme.neutral6.val,
    theme.orange9?.val,
    theme.pink9?.val,
    theme.purple9?.val,
    theme.red9?.val,
    theme.teal9?.val,
    total,
  ]);
  const activeCoinCandidate = hoveredCoin ?? selectedCoin;
  const activeCoin = slices.some((slice) => slice.coin === activeCoinCandidate)
    ? activeCoinCandidate
    : null;
  const handleHoveredCoinChange = useCallback((coin: string | null) => {
    setHoveredCoin(coin);
  }, []);
  const handleSelectedCoinChange = useCallback((coin: string) => {
    setSelectedCoin(coin);
  }, []);
  const handleCardPress = useCallback(() => {
    setHoveredCoin(null);
    setSelectedCoin(null);
  }, []);
  const getDonutCoinAtPoint = useCallback(
    (x: number, y: number) => {
      const deltaX = x - center;
      const deltaY = y - center;
      const distanceFromCenter = Math.hypot(deltaX, deltaY);
      if (Math.abs(distanceFromCenter - radius) > DONUT_HIT_STROKE_WIDTH / 2) {
        return null;
      }

      const fullCircleRadians = Math.PI * 2;
      const angleFromTop =
        (Math.atan2(deltaY, deltaX) + Math.PI / 2 + fullCircleRadians) %
        fullCircleRadians;
      const lengthAtPoint = (angleFromTop / fullCircleRadians) * circumference;
      let cumulativeLength = 0;

      for (const slice of slices) {
        cumulativeLength += slice.arcLength;
        if (lengthAtPoint < cumulativeLength) {
          return slice.coin;
        }
      }

      return slices.at(-1)?.coin ?? null;
    },
    [center, circumference, radius, slices],
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
  const handleDonutNativePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.nativeEvent.pointerType === 'touch') {
        return;
      }
      const origin = donutOriginRef.current;
      if (!origin) {
        return;
      }
      setHoveredCoin(
        getDonutCoinAtPoint(
          event.nativeEvent.pageX - origin.x,
          event.nativeEvent.pageY - origin.y,
        ),
      );
    },
    [getDonutCoinAtPoint],
  );
  const handleDonutNativePointerEnter = useCallback(
    (event: NativePointerEvent) => {
      if (event.nativeEvent.pointerType === 'touch') {
        return;
      }
      const { pageX, pageY } = event.nativeEvent;
      donutContainerRef.current?.measure(
        (_x, _y, _width, _height, measuredPageX, measuredPageY) => {
          const origin = { x: measuredPageX, y: measuredPageY };
          donutOriginRef.current = origin;
          setHoveredCoin(
            getDonutCoinAtPoint(pageX - origin.x, pageY - origin.y),
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
          {formatPerpsUsd(total)}
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
            accessibilityLabel={`${title}: ${formatPerpsUsd(total)}`}
            onPressIn={
              platformEnv.isNative ? handleDonutNativePress : undefined
            }
            onPress={platformEnv.isNative ? handleDonutNativePress : undefined}
            onPointerEnter={
              platformEnv.isNative ? handleDonutNativePointerEnter : undefined
            }
            onPointerMove={
              platformEnv.isNative ? handleDonutNativePointerMove : undefined
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
                cx={center}
                cy={center}
                r={radius}
                stroke={theme.bgSubdued.val}
                strokeWidth={DONUT_STROKE_WIDTH}
                fill="none"
              />
              {slices.map((slice) => (
                <FundingDonutSegment
                  key={slice.coin}
                  slice={slice}
                  radius={radius}
                  circumference={circumference}
                  center={center}
                  isActive={activeCoin === slice.coin}
                  hasActiveSlice={activeCoin !== null}
                  onHoveredCoinChange={handleHoveredCoinChange}
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
                onHoveredCoinChange={handleHoveredCoinChange}
                onSelectedCoinChange={handleSelectedCoinChange}
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
            <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
              <Circle
                cx={center}
                cy={center}
                r={radius}
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
  isMobile,
}: {
  records: IUserFunding[];
  timePeriod: IPortfolioTimePeriod;
  isLoading: boolean;
  isMobile: boolean;
}) {
  const intl = useIntl();
  const distribution = useMemo(
    () =>
      buildFundingDirectionDistribution({
        records,
        timePeriod,
        maxBaseMarkets: FUNDING_DISTRIBUTION_BASE_MARKET_LIMIT,
      }),
    [records, timePeriod],
  );

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
