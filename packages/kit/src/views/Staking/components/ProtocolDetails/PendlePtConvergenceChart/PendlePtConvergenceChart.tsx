import { useCallback, useId, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import {
  SizableText,
  Skeleton,
  Stack,
  YStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  DAY_MS,
  buildFuturePrices,
  buildLinePath,
  buildPastPrices,
  createTimeScale,
  findNearestPointIndex,
  formatPtRate,
  getFuturePrice,
  getPriceDomain,
  getSampleStep,
  keepRoomBelow,
  resolveMaturityTime,
  snapToStep,
} from './ptChartMath';
import { PtChartScrubArea } from './PtChartScrubArea';

import type { IPendlePtConvergenceChartProps } from './shared';
import type { LayoutChangeEvent } from 'react-native';

// The APY chart above uses the same green (#008347D6 line, fading fill).
const LINE_COLOR = '#008347';
const LINE_OPACITY = 0.84;
const FILL_OPACITY = 0.22;
const ON_LINE_COLOR = '#FFFFFF';
const PHONE_HEIGHT = 196;
const WIDE_HEIGHT = 236;
// Room above the plot for the redemption value over its dot.
const PLOT_TOP = 30;
const AXIS_HEIGHT = 28;
// Keeps the dots at both ends inside the chart.
const PLOT_INSET = 6;
const AXIS_LABEL_GAP = 8;
const LABEL_LINE_HEIGHT = 16;
// Between a dot and the price next to it.
const POINT_LABEL_GAP = 6;
const BADGE_PADDING_X = 5;
const BADGE_PADDING_Y = 1;
const BADGE_HEIGHT = LABEL_LINE_HEIGHT + BADGE_PADDING_Y * 2;
const CARD_OFFSET = 12;
const DEFAULT_CARD_SIZE = { width: 120, height: 56 };
// Estimated width of a 12px label before it has been measured.
const ESTIMATED_CHAR_WIDTH = 7;
const CARD_DATE: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};
// A market's last days move in hours, not days.
const CARD_DATE_TIME: Intl.DateTimeFormatOptions = {
  ...CARD_DATE,
  hour: '2-digit',
  minute: '2-digit',
};
const CARD_MATURITY_DATE: Intl.DateTimeFormatOptions = {
  ...CARD_DATE,
  timeZone: 'UTC',
};

type ILabelKey = 'target' | 'badge' | 'start' | 'today' | 'span' | 'end';

type IRect = { left: number; top: number; width: number; height: number };

type ISelectedPoint = {
  time: number;
  price: number;
  isEstimate: boolean;
  isMaturity: boolean;
  stepMs: number;
};

function overlaps(a: IRect, b: IRect) {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

function ChartLabel({
  left,
  top,
  hidden,
  onLayout,
  children,
}: {
  left: number;
  top: number;
  hidden?: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  children: string;
}) {
  return (
    <Stack
      position="absolute"
      left={left}
      top={top}
      opacity={hidden ? 0 : 1}
      pointerEvents="none"
      onLayout={onLayout}
    >
      <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
        {children}
      </SizableText>
    </Stack>
  );
}

export function PendlePtConvergenceChart({
  chart,
  impliedApyHistory,
  isHistoryLoading,
  maturityDate,
}: IPendlePtConvergenceChartProps) {
  const intl = useIntl();
  const theme = useTheme();
  const { gtMd } = useMedia();
  const height = gtMd ? WIDE_HEIGHT : PHONE_HEIGHT;
  const gradientId = `ptChartFill${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { currentRate, targetRate, remainingDays, accountingSymbol } = chart;

  const [width, setWidth] = useState(0);
  const [labelWidths, setLabelWidths] = useState<
    Partial<Record<ILabelKey, number>>
  >({});
  const [cardSize, setCardSize] = useState(DEFAULT_CARD_SIZE);
  const [selectedTime, setSelectedTime] = useState<number>();

  const now = useMemo(() => Date.now(), []);
  const maturityTime = useMemo(
    () => resolveMaturityTime({ maturityDate, remainingDays, now }),
    [maturityDate, remainingDays, now],
  );
  const { points: past, stepMs: pastStepMs } = useMemo(
    () =>
      buildPastPrices({
        history: impliedApyHistory,
        maturityTime,
        currentRate,
        now,
      }),
    [impliedApyHistory, maturityTime, currentRate, now],
  );
  const future = useMemo(
    () => buildFuturePrices({ now, maturityTime, currentRate, targetRate }),
    [now, maturityTime, currentRate, targetRate],
  );
  const futureStepMs = getSampleStep(maturityTime - now);
  const hasPast = past.length > 1;
  const startTime = hasPast ? past[0].time : now;

  const targetText = `${formatPtRate(targetRate)} ${accountingSymbol}`;
  const currentText = `${formatPtRate(currentRate)} ${accountingSymbol}`;
  const todayText = intl.formatMessage({ id: ETranslations.global_date_today });
  // Whole days, like the Maturity row above ("26 Nov 2026(36d)"). The
  // server's `remainingDays` counts the part day too and reads one more.
  const daysLeft = Math.floor((maturityTime - now) / DAY_MS);
  const spanText = intl.formatMessage(
    {
      id:
        daysLeft === 1
          ? ETranslations.earn_number_day
          : ETranslations.market_number_of_days,
    },
    { number: daysLeft },
  );
  const startText = hasPast
    ? intl.formatDate(startTime, { month: 'short', day: 'numeric' })
    : '';
  // Pendle markets expire at 00:00 UTC; local time could name the day before.
  const endText = intl.formatDate(maturityTime, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const widthOf = useCallback(
    (key: ILabelKey, text: string) =>
      labelWidths[key] ?? text.length * ESTIMATED_CHAR_WIDTH,
    [labelWidths],
  );
  const badgeWidth =
    labelWidths.badge ??
    currentText.length * ESTIMATED_CHAR_WIDTH + BADGE_PADDING_X * 2;
  const plotRight = Math.max(width - PLOT_INSET, PLOT_INSET + 1);
  const plotBottom = height - AXIS_HEIGHT;

  const scale = useMemo(
    () =>
      createTimeScale({
        startTime,
        maturityTime,
        left: PLOT_INSET,
        right: plotRight,
      }),
    [startTime, maturityTime, plotRight],
  );
  const domain = useMemo(
    () =>
      keepRoomBelow({
        domain: getPriceDomain([
          ...past.map((point) => point.price),
          currentRate,
          targetRate,
        ]),
        price: currentRate,
        share:
          (POINT_LABEL_GAP + BADGE_HEIGHT + 4) /
          Math.max(plotBottom - PLOT_TOP, 1),
      }),
    [past, currentRate, targetRate, plotBottom],
  );
  const toY = useCallback(
    (price: number) =>
      PLOT_TOP +
      (1 - (price - domain.min) / (domain.max - domain.min)) *
        (plotBottom - PLOT_TOP),
    [domain, plotBottom],
  );

  const todayX = scale.x(now);
  const todayY = toY(currentRate);
  const endX = plotRight;
  const endY = toY(targetRate);

  const paths = useMemo(() => {
    const pastPoints = past.map((point): [number, number] => [
      scale.x(point.time),
      toY(point.price),
    ]);
    const futurePoints = future.map((point): [number, number] => [
      scale.x(point.time),
      toY(point.price),
    ]);
    const outline = [...pastPoints, ...futurePoints];
    const firstX = outline.length ? outline[0][0] : todayX;
    return {
      past: hasPast ? buildLinePath([...pastPoints, [todayX, todayY]]) : '',
      future: buildLinePath(futurePoints),
      area: outline.length
        ? `${buildLinePath(outline)} L${endX.toFixed(2)} ${plotBottom} L${firstX.toFixed(2)} ${plotBottom} Z`
        : '',
    };
  }, [past, future, scale, toY, hasPast, todayX, todayY, endX, plotBottom]);

  const selected = useMemo((): ISelectedPoint | undefined => {
    if (selectedTime === undefined) {
      return undefined;
    }
    if (hasPast && selectedTime < now - pastStepMs / 2) {
      const point = past[findNearestPointIndex(past, selectedTime)];
      return {
        ...point,
        isEstimate: false,
        isMaturity: false,
        stepMs: pastStepMs,
      };
    }
    const time = snapToStep({
      time: selectedTime,
      now,
      maturityTime,
      stepMs: futureStepMs,
    });
    const isMaturity = time >= maturityTime;
    return {
      time,
      price: getFuturePrice({
        time,
        now,
        maturityTime,
        currentRate,
        targetRate,
      }),
      // Today's price and the redemption value are known, the days between
      // follow today's rate.
      isEstimate: time > now && !isMaturity,
      isMaturity,
      stepMs: futureStepMs,
    };
  }, [
    selectedTime,
    hasPast,
    now,
    past,
    pastStepMs,
    futureStepMs,
    maturityTime,
    currentRate,
    targetRate,
  ]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((previous) => (previous === next ? previous : next));
  }, []);
  const measure = useCallback(
    (key: ILabelKey) => (event: LayoutChangeEvent) => {
      const next = Math.ceil(event.nativeEvent.layout.width);
      setLabelWidths((previous) =>
        previous[key] === next ? previous : { ...previous, [key]: next },
      );
    },
    [],
  );
  const handleCardLayout = useCallback((event: LayoutChangeEvent) => {
    const next = {
      width: Math.ceil(event.nativeEvent.layout.width),
      height: Math.ceil(event.nativeEvent.layout.height),
    };
    setCardSize((previous) =>
      previous.width === next.width && previous.height === next.height
        ? previous
        : next,
    );
  }, []);
  const handleScrub = useCallback(
    (x: number) => setSelectedTime(scale.time(x)),
    [scale],
  );
  const handleScrubEnd = useCallback(() => setSelectedTime(undefined), []);

  if (!(currentRate > 0) || !(targetRate > 0) || !future.length) {
    return null;
  }
  if (isHistoryLoading) {
    return <Skeleton w="100%" h={height} borderRadius="$2" />;
  }

  // The redemption value sits over its dot, right-aligned to the edge.
  // Today's price hangs below and right of its dot, where the rising line
  // ahead leaves room; on a very narrow chart it goes above and left.
  const targetRect: IRect = {
    left: width - widthOf('target', targetText),
    top: endY - POINT_LABEL_GAP - LABEL_LINE_HEIGHT - 2,
    width: widthOf('target', targetText),
    height: LABEL_LINE_HEIGHT,
  };
  const badgeRect: IRect =
    todayX + POINT_LABEL_GAP + badgeWidth <= width
      ? {
          left: todayX + POINT_LABEL_GAP,
          top: todayY + POINT_LABEL_GAP,
          width: badgeWidth,
          height: BADGE_HEIGHT,
        }
      : {
          left: Math.max(todayX - POINT_LABEL_GAP - badgeWidth, 0),
          top: todayY - POINT_LABEL_GAP - BADGE_HEIGHT,
          width: badgeWidth,
          height: BADGE_HEIGHT,
        };

  // Axis labels: the start date on the left edge, Today under its dot, the
  // maturity date on the right edge. Start date and day count give way when
  // crowded.
  const axisTop = plotBottom + (AXIS_HEIGHT - LABEL_LINE_HEIGHT) / 2 + 2;
  const endW = widthOf('end', endText);
  const endLeft = width - endW;
  const todayW = widthOf('today', todayText);
  const todayLeft = Math.min(
    Math.max(todayX - todayW / 2, 0),
    Math.max(endLeft - AXIS_LABEL_GAP - todayW, 0),
  );
  const todayRight = todayLeft + todayW;
  const startW = widthOf('start', startText);
  const showStart = hasPast && startW + AXIS_LABEL_GAP <= todayLeft;
  const spanW = widthOf('span', spanText);
  const spanLeft = (todayX + endX) / 2 - spanW / 2;
  const showSpan =
    daysLeft >= 1 &&
    spanLeft >= todayRight + AXIS_LABEL_GAP &&
    spanLeft + spanW + AXIS_LABEL_GAP <= endLeft;

  const isMeasured =
    width > 0 &&
    (['target', 'badge', 'today', 'span', 'end'] as const).every(
      (key) => labelWidths[key] !== undefined,
    ) &&
    (!hasPast || labelWidths.start !== undefined);

  const guideColor = theme.borderSubdued.val;
  const ringColor = theme.bgApp.val;

  let card: (IRect & { x: number; y: number }) | undefined;
  if (selected) {
    const x = scale.x(selected.time);
    const y = toY(selected.price);
    let top = y - cardSize.height - CARD_OFFSET;
    let left = x - cardSize.width / 2;
    if (top < 0) {
      // No room above: sit at the top, beside the cursor instead of under it.
      top = 0;
      left = x > width / 2 ? x - cardSize.width - CARD_OFFSET : x + CARD_OFFSET;
    }
    card = {
      x,
      y,
      top,
      left: Math.min(Math.max(left, 0), Math.max(width - cardSize.width, 0)),
      width: cardSize.width,
      height: cardSize.height,
    };
  }
  // A label the card covers would peek out around it.
  const isTargetCovered = card ? overlaps(card, targetRect) : false;
  const isBadgeCovered = card ? overlaps(card, badgeRect) : false;

  return (
    <YStack
      width="100%"
      height={height}
      onLayout={handleLayout}
      role="img"
      aria-label={`${todayText} ${currentText}, ${endText} ${targetText}`}
    >
      {width > 0 ? (
        <Stack flex={1} opacity={isMeasured ? 1 : 0}>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0"
                  stopColor={LINE_COLOR}
                  stopOpacity={FILL_OPACITY}
                />
                <Stop offset="1" stopColor={LINE_COLOR} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Line
              x1={0}
              x2={endX}
              y1={endY}
              y2={endY}
              stroke={guideColor}
              strokeDasharray="3 3"
            />
            <Line
              x1={0}
              x2={endX}
              y1={todayY}
              y2={todayY}
              stroke={guideColor}
              strokeDasharray="3 3"
            />
            {hasPast ? (
              <Line
                x1={todayX}
                x2={todayX}
                y1={PLOT_TOP - 8}
                y2={plotBottom}
                stroke={guideColor}
                strokeDasharray="3 3"
              />
            ) : null}
            {paths.area ? (
              <Path d={paths.area} fill={`url(#${gradientId})`} />
            ) : null}
            {paths.past ? (
              <Path
                d={paths.past}
                fill="none"
                stroke={LINE_COLOR}
                strokeOpacity={LINE_OPACITY}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            <Path
              d={paths.future}
              fill="none"
              stroke={LINE_COLOR}
              strokeOpacity={LINE_OPACITY}
              strokeWidth={2}
              strokeDasharray="4 5"
              strokeLinecap="round"
            />
            <Circle
              cx={endX}
              cy={endY}
              r={4}
              fill={ringColor}
              stroke={LINE_COLOR}
              strokeWidth={2}
            />
            <Circle
              cx={todayX}
              cy={todayY}
              r={5}
              fill={LINE_COLOR}
              stroke={ringColor}
              strokeWidth={2}
            />
            {card ? (
              <>
                <Line
                  x1={card.x}
                  x2={card.x}
                  y1={PLOT_TOP - 8}
                  y2={plotBottom}
                  stroke={theme.iconSubdued.val}
                  strokeDasharray="3 3"
                />
                <Circle
                  cx={card.x}
                  cy={card.y}
                  r={5}
                  fill={ON_LINE_COLOR}
                  stroke={LINE_COLOR}
                  strokeWidth={2.5}
                />
              </>
            ) : null}
          </Svg>

          <ChartLabel
            left={targetRect.left}
            top={targetRect.top}
            hidden={isTargetCovered}
            onLayout={measure('target')}
          >
            {targetText}
          </ChartLabel>
          <Stack
            position="absolute"
            left={badgeRect.left}
            top={badgeRect.top}
            px={BADGE_PADDING_X}
            py={BADGE_PADDING_Y}
            borderRadius={4}
            bg={LINE_COLOR}
            opacity={isBadgeCovered ? 0 : 1}
            pointerEvents="none"
            onLayout={measure('badge')}
          >
            <SizableText size="$bodySm" color={ON_LINE_COLOR} numberOfLines={1}>
              {currentText}
            </SizableText>
          </Stack>

          {hasPast ? (
            <ChartLabel
              left={0}
              top={axisTop}
              hidden={!showStart}
              onLayout={measure('start')}
            >
              {startText}
            </ChartLabel>
          ) : null}
          <ChartLabel
            left={todayLeft}
            top={axisTop}
            onLayout={measure('today')}
          >
            {todayText}
          </ChartLabel>
          <ChartLabel
            left={spanLeft}
            top={axisTop}
            hidden={!showSpan}
            onLayout={measure('span')}
          >
            {spanText}
          </ChartLabel>
          <ChartLabel left={endLeft} top={axisTop} onLayout={measure('end')}>
            {endText}
          </ChartLabel>

          {card && selected ? (
            <YStack
              position="absolute"
              left={card.left}
              top={card.top}
              minWidth={DEFAULT_CARD_SIZE.width}
              gap="$1.5"
              px="$3"
              py="$2"
              bg="$bg"
              borderRadius="$2"
              borderWidth={1}
              borderColor="$borderSubdued"
              shadowColor="$shadowDefault"
              shadowOffset={{ width: 0, height: 2 }}
              shadowOpacity={0.1}
              shadowRadius={8}
              pointerEvents="none"
              onLayout={handleCardLayout}
            >
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {intl.formatDate(
                  selected.time,
                  (selected.isMaturity && CARD_MATURITY_DATE) ||
                    (selected.stepMs < DAY_MS && CARD_DATE_TIME) ||
                    CARD_DATE,
                )}
              </SizableText>
              <SizableText size="$bodySmMedium" color="$text" numberOfLines={1}>
                {`${selected.isEstimate ? '≈ ' : ''}${formatPtRate(
                  selected.price,
                )} ${accountingSymbol}`}
              </SizableText>
            </YStack>
          ) : null}

          <PtChartScrubArea
            width={width}
            height={height}
            onScrub={handleScrub}
            onScrubEnd={handleScrubEnd}
          />
        </Stack>
      ) : null}
    </YStack>
  );
}
