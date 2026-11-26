import {
  type ComponentRef,
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { Platform, Pressable } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text,
} from 'react-native-svg';

import {
  SizableText,
  Spinner,
  Stack,
  TABULAR_NUMS,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { webFontFamily } from '@onekeyhq/components/src/utils/webFontFamily';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DepthChartGesture } from './DepthChartGesture';
import {
  DEPTH_MARKER_HIT_SLOP,
  DEPTH_PRICE_RANGE_RATIO,
  buildDepthChartGeometry,
  getDepthChartHoverSelections,
} from './perpDepthChartGeometry';
import { usePerpDepthChartDomain } from './usePerpDepthChartDomain';
import { getOrderBookDistanceFromMid } from './utils';

import type {
  IDepthChartSelection,
  IPerpDepthLevel,
} from './perpDepthChartGeometry';
import type { IntlShape } from 'react-intl';
import type { LayoutChangeEvent, PointerEvent } from 'react-native';

const CHART_MIN_HEIGHT = 228;
const CHART_HEADER_HEIGHT = 44;
const PLOT_LEFT = 0;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 28;
const AXIS_FONT_SIZE = 10;
const AXIS_OUTSET = 6;
const SIZE_TICK_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];
const AXIS_FONT_FAMILY = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: webFontFamily,
});
const AXIS_SVG_TEXT_PROPS = {
  fontFamily: AXIS_FONT_FAMILY,
  fontSize: AXIS_FONT_SIZE,
  fontFeatureSettings: '"tnum"',
};
const TOUCH_TOOLTIP_WIDTH = 128;
const TOUCH_TOOLTIP_INITIAL_HEIGHT = 64;
const TOOLTIP_INITIAL_HEIGHT = 92;
const TOOLTIP_POINT_GAP = 8;
const TOOLTIP_MARGIN = 8;
const EMPTY_LEVELS: readonly IPerpDepthLevel[] = [];
const ANIMATE_OPACITY = ['opacity'];
const FADE_FROM_TRANSPARENT = { opacity: 0 };

type IDepthChartGeometry = NonNullable<
  ReturnType<typeof buildDepthChartGeometry>
>;

type IPerpDepthChartProps = {
  bids: ReadonlyArray<IPerpDepthLevel>;
  asks: ReadonlyArray<IPerpDepthLevel>;
  quoteSymbol: string;
  priceDecimals: number;
  sizeDecimals: number;
  status: 'loading' | 'empty' | 'error' | 'stale' | 'ready';
  targetKey: string;
  tickLabel: string;
  showHeader?: boolean;
  interactionEnabled?: boolean;
  referenceMidPrice?: number;
};

type IChartLabels = {
  priceDecimals: number;
  sizeDecimals: number;
};

function formatSizeTicks(intl: IntlShape, maxSize: number) {
  return SIZE_TICK_FRACTIONS.map((fraction) => {
    const size = maxSize * fraction;
    return intl.formatNumber(size, {
      notation: size > 0 && size < 0.001 ? 'scientific' : 'compact',
      maximumSignificantDigits: 3,
    });
  });
}

function DepthArea({
  side,
  color,
  points,
  plotHeight,
}: {
  side: 'bid' | 'ask';
  color: string;
  points: IDepthChartGeometry['bids'];
  plotHeight: number;
}) {
  const gradientId = `perp-depth-${useId().replaceAll(':', '')}`;
  const level = points.levels[0];
  if (!level) {
    return null;
  }

  const testID = `perp-depth-${side}-area`;
  if (!points.fill) {
    return (
      <Circle testID={testID} cx={level.x} cy={level.y} r={3} fill={color} />
    );
  }

  return (
    <G testID={testID}>
      <Defs>
        <LinearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={0}
          x2={0}
          y1={0}
          y2={plotHeight}
        >
          <Stop offset={0} stopColor={color} stopOpacity={0.28} />
          <Stop offset={0.7} stopColor={color} stopOpacity={0.1} />
          <Stop offset={1} stopColor={color} stopOpacity={0.025} />
        </LinearGradient>
      </Defs>
      <Path d={points.fill} fill={`url(#${gradientId})`} />
      <Path
        d={points.stroke}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </G>
  );
}

const DepthPlot = memo(function DepthPlot({
  geometry,
  width,
  height,
  plotWidth,
  priceDecimals,
}: Pick<IChartLabels, 'priceDecimals'> & {
  geometry: IDepthChartGeometry;
  width: number;
  height: number;
  plotWidth: number;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const plotHeight = height - PLOT_TOP - PLOT_BOTTOM;
  const rightAxisX = width - PLOT_LEFT - AXIS_OUTSET;
  const axisColor = theme.borderSubdued.val;
  const labelColor = theme.textSubdued.val;
  const bidColor = theme.bgAccent.val;
  const askColor = theme.bgCriticalStrong.val;
  const formatAxisPrice = (price: number) =>
    intl.formatNumber(price, {
      minimumFractionDigits: priceDecimals,
      maximumFractionDigits: priceDecimals,
    });
  // Anchor labels to screen positions, not rounded prices that slide as the
  // live midpoint and visible price range change.
  let priceTickCount = 5;
  if (plotWidth < 480) priceTickCount = 3;
  if (plotWidth < 240) priceTickCount = 1;
  const midPrice = geometry.midPrice;
  const midX = midPrice === undefined ? undefined : geometry.toX(midPrice);
  const midPriceDecimals = Math.min(20, priceDecimals + 1);
  const seenPriceLabels = new Set<string>();
  if (midPrice !== undefined) {
    seenPriceLabels.add(
      intl.formatNumber(midPrice, {
        minimumFractionDigits: priceDecimals,
        maximumFractionDigits: midPriceDecimals,
      }),
    );
  }
  const priceTicks = Array.from(
    { length: priceTickCount },
    (_, index) => (index + 0.5) / priceTickCount,
  ).flatMap((fraction) => {
    if (fraction === 0.5 && midX !== undefined) return [];
    const x = plotWidth * fraction;
    const label = formatAxisPrice(geometry.toPrice(x));
    if (seenPriceLabels.has(label)) return [];
    seenPriceLabels.add(label);
    return [{ x, label }];
  });
  const sizeLabels = useMemo(
    () => formatSizeTicks(intl, geometry.maxSize),
    [geometry.maxSize, intl],
  );
  const midPriceLabel =
    midPrice === undefined
      ? undefined
      : intl.formatNumber(midPrice, {
          minimumFractionDigits: midPriceDecimals,
          maximumFractionDigits: midPriceDecimals,
        });

  return (
    <Svg
      width={width}
      height={height}
      pointerEvents="none"
      accessible={platformEnv.isNative ? false : undefined}
      aria-hidden={platformEnv.isNative ? undefined : true}
    >
      <G x={PLOT_LEFT} y={PLOT_TOP}>
        <Line
          x1={0}
          y1={plotHeight}
          x2={plotWidth}
          y2={plotHeight}
          stroke={axisColor}
          strokeOpacity={0.9}
        />
        {priceTicks.map(({ x, label }) => (
          <Text
            key={x}
            x={x}
            y={plotHeight + 16}
            textAnchor="middle"
            fill={labelColor}
            {...AXIS_SVG_TEXT_PROPS}
          >
            {label}
          </Text>
        ))}
        <DepthArea
          side="bid"
          color={bidColor}
          points={geometry.bids}
          plotHeight={plotHeight}
        />
        <DepthArea
          side="ask"
          color={askColor}
          points={geometry.asks}
          plotHeight={plotHeight}
        />
        {SIZE_TICK_FRACTIONS.map((fraction, index) => {
          const y = plotHeight * (1 - fraction);
          const labelY = y + (fraction === 0 ? 16 : -4);
          return (
            <Text
              key={fraction}
              x={rightAxisX}
              y={labelY}
              textAnchor="end"
              fill={labelColor}
              {...AXIS_SVG_TEXT_PROPS}
            >
              {sizeLabels[index]}
            </Text>
          );
        })}
        {midX !== undefined ? (
          <>
            <Line
              testID="perp-depth-mid-line"
              x1={midX}
              y1={-PLOT_TOP}
              x2={midX}
              y2={plotHeight}
              stroke={theme.borderStrong.val}
              strokeDasharray="3 3"
              strokeOpacity={0.85}
            />
            <Text
              testID="perp-depth-mid-price"
              fontWeight="600"
              x={midX}
              y={plotHeight + 16}
              textAnchor="middle"
              fill={labelColor}
              {...AXIS_SVG_TEXT_PROPS}
            >
              {midPriceLabel}
            </Text>
          </>
        ) : null}
      </G>
    </Svg>
  );
});

function DepthTooltipRow({
  label,
  value,
  valueColor = '$text',
  compact = false,
}: {
  label: string;
  value: string;
  valueColor?: '$text' | '$bgAccent' | '$bgCriticalStrong';
  compact?: boolean;
}) {
  return (
    <XStack
      gap="$1"
      rowGap="$0"
      justifyContent="space-between"
      flexWrap={compact ? 'nowrap' : 'wrap'}
      alignItems={compact ? 'center' : undefined}
    >
      <SizableText
        size="$bodyXs"
        fontSize={compact ? 10 : undefined}
        color="$textSubdued"
        maxWidth="100%"
        flexShrink={compact ? 1 : undefined}
        lineHeight={compact ? 14 : undefined}
        numberOfLines={compact ? 2 : undefined}
        accessibilityLabel={label}
      >
        {label}
      </SizableText>
      <SizableText
        size="$bodyXsMedium"
        color={valueColor}
        fontSize={compact ? 10 : undefined}
        flexShrink={compact ? 0 : undefined}
        lineHeight={compact ? 14 : undefined}
        numberOfLines={compact ? 1 : undefined}
        fontVariant={TABULAR_NUMS}
        maxWidth="100%"
        ml="auto"
        textAlign="right"
      >
        {value}
      </SizableText>
    </XStack>
  );
}

function DepthSelectionTooltip({
  selection,
  geometry,
  height,
  plotWidth,
  paired,
  compact,
  priceDecimals,
  sizeDecimals,
}: IChartLabels & {
  selection: IDepthChartSelection;
  geometry: IDepthChartGeometry;
  height: number;
  plotWidth: number;
  paired: boolean;
  compact: boolean;
}) {
  const intl = useIntl();
  const reducedMotion = useReducedMotion();
  const [tooltipHeight, setTooltipHeight] = useState(
    compact ? TOUCH_TOOLTIP_INITIAL_HEIGHT : TOOLTIP_INITIAL_HEIGHT,
  );
  const handleTooltipLayout = useCallback((event: LayoutChangeEvent) => {
    setTooltipHeight(Math.ceil(event.nativeEvent.layout.height));
  }, []);
  const isBid = selection.side === 'bid';
  const color = isBid ? '$bgAccent' : '$bgCriticalStrong';
  const x = PLOT_LEFT + geometry.toX(selection.price);
  const y = PLOT_TOP + selection.level.y;
  const midX = PLOT_LEFT + geometry.toX(geometry.midPrice ?? selection.price);
  const leftBound = paired && !isBid ? midX + TOOLTIP_MARGIN : TOOLTIP_MARGIN;
  const rightBound =
    paired && isBid ? midX - TOOLTIP_MARGIN : plotWidth - TOOLTIP_MARGIN;
  const tooltipWidth = Math.max(
    1,
    Math.min(compact ? TOUCH_TOOLTIP_WIDTH : 180, rightBound - leftBound),
  );
  // Keep cards outside the selected pair, flipping inward at the edges.
  const outwardLeft = isBid
    ? x - tooltipWidth - TOOLTIP_POINT_GAP
    : x + TOOLTIP_POINT_GAP;
  const inwardLeft = isBid
    ? x + TOOLTIP_POINT_GAP
    : x - tooltipWidth - TOOLTIP_POINT_GAP;
  const preferredLeft =
    outwardLeft >= leftBound && outwardLeft + tooltipWidth <= rightBound
      ? outwardLeft
      : inwardLeft;
  const tooltipLeft = Math.max(
    leftBound,
    Math.min(preferredLeft, rightBound - tooltipWidth),
  );
  // Clamp at the top instead of flipping below the point during scrubbing.
  const tooltipTop = Math.max(
    TOOLTIP_MARGIN,
    Math.min(
      y - tooltipHeight - TOOLTIP_POINT_GAP,
      height - tooltipHeight - PLOT_BOTTOM - TOOLTIP_MARGIN,
    ),
  );
  const distance =
    geometry.midPrice === undefined
      ? null
      : getOrderBookDistanceFromMid(selection.price, geometry.midPrice);
  const distancePercent = distance === null ? null : Number(distance);
  const defaultDistanceDigits = compact ? 2 : 4;
  const distanceDigits =
    distancePercent !== null &&
    distancePercent > 0 &&
    distancePercent < 0.5 * 10 ** -defaultDistanceDigits
      ? Math.ceil(-Math.log10(distancePercent))
      : defaultDistanceDigits;
  const distanceFormat: Parameters<typeof intl.formatNumber>[1] =
    distanceDigits > 6
      ? {
          style: 'percent',
          notation: 'scientific',
          maximumSignificantDigits: 3,
        }
      : { style: 'percent', maximumFractionDigits: distanceDigits };
  const sideSign = isBid ? '−' : '+';
  const distanceSign = distancePercent ? sideSign : '';
  const selectionPriceDigits =
    selection.price === Number(selection.level.price) ? 20 : priceDecimals;

  return (
    <YStack
      testID={`perp-depth-tooltip-${selection.side}`}
      onLayout={handleTooltipLayout}
      position="absolute"
      top={tooltipTop}
      left={tooltipLeft}
      w={tooltipWidth}
      p={compact ? '$1' : '$2'}
      gap="$0.5"
      borderWidth="$px"
      borderColor="$borderSubdued"
      borderRadius="$2"
      bg="$bgApp"
      elevation={compact ? 0 : 4}
      transition={reducedMotion ? '0ms' : '100ms'}
      animateOnly={ANIMATE_OPACITY}
      enterStyle={reducedMotion ? undefined : FADE_FROM_TRANSPARENT}
    >
      {distancePercent === null ? null : (
        <DepthTooltipRow
          compact={compact}
          label={intl.formatMessage({
            id: ETranslations.perp_depth_range__title,
          })}
          value={`${distanceSign}${intl.formatNumber(
            distancePercent / 100,
            distanceFormat,
          )}`}
          valueColor={color}
        />
      )}
      <DepthTooltipRow
        compact={compact}
        label={intl.formatMessage({ id: ETranslations.perp_orderbook_price })}
        value={intl.formatNumber(selection.price, {
          maximumFractionDigits: selectionPriceDigits,
        })}
      />
      <DepthTooltipRow
        compact={compact}
        label={intl.formatMessage({ id: ETranslations.perp_orderbook_total })}
        value={intl.formatNumber(
          Number(selection.level.cumSize),
          compact
            ? { notation: 'compact', maximumSignificantDigits: 4 }
            : { maximumFractionDigits: sizeDecimals },
        )}
      />
    </YStack>
  );
}

function DepthChartInteraction({
  geometry,
  width,
  height,
  plotWidth,
  priceDecimals,
  sizeDecimals,
}: IChartLabels & {
  geometry: IDepthChartGeometry;
  width: number;
  height: number;
  plotWidth: number;
}) {
  const theme = useTheme();
  const inputRef = useRef<ComponentRef<typeof Pressable>>(null);
  const [interaction, setInteraction] = useState<{
    kind: 'hover' | 'touch';
    ratio: number;
  }>();
  const touching = useRef(false);
  const plotHeight = height - PLOT_TOP - PLOT_BOTTOM;
  const inputStyle = {
    position: 'absolute' as const,
    left: PLOT_LEFT - DEPTH_MARKER_HIT_SLOP,
    top: 0,
    width: plotWidth + DEPTH_MARKER_HIT_SLOP * 2,
    height: PLOT_TOP + plotHeight + 3,
    touchAction: platformEnv.isNative ? undefined : ('pan-y' as const),
  };
  const selectFromPlotX = useCallback(
    (x: number, kind: 'hover' | 'touch') => {
      const ratio =
        Number.isFinite(x) &&
        x >= -DEPTH_MARKER_HIT_SLOP &&
        x <= plotWidth + DEPTH_MARKER_HIT_SLOP
          ? x / plotWidth
          : undefined;
      setInteraction((previous) => {
        if (ratio === undefined) return undefined;
        return previous?.kind === kind && previous.ratio === ratio
          ? previous
          : { kind, ratio };
      });
    },
    [plotWidth],
  );
  const selectFromClientX = (clientX: number, kind: 'hover' | 'touch') => {
    const bounds = inputRef.current?.getBoundingClientRect();
    if (bounds)
      selectFromPlotX(clientX - bounds.left - DEPTH_MARKER_HIT_SLOP, kind);
  };
  const clearTouch = useCallback(() => {
    touching.current = false;
    setInteraction((previous) =>
      previous?.kind === 'touch' ? undefined : previous,
    );
  }, []);
  const handleNativeTouch = useCallback(
    (x: number) => selectFromPlotX(x - DEPTH_MARKER_HIT_SLOP, 'touch'),
    [selectFromPlotX],
  );
  const handlePointer = (event: PointerEvent) => {
    if (event.nativeEvent.pointerType === 'touch') {
      if (touching.current)
        selectFromClientX(event.nativeEvent.clientX, 'touch');
    } else {
      selectFromClientX(event.nativeEvent.clientX, 'hover');
    }
  };
  const ratio = interaction?.ratio;
  const selections = useMemo(
    () =>
      ratio === undefined
        ? []
        : getDepthChartHoverSelections(geometry, ratio * plotWidth),
    [geometry, plotWidth, ratio],
  );
  const paired = geometry.midPrice !== undefined;
  const compact = interaction?.kind === 'touch';

  return (
    <>
      <DepthChartGesture
        onTouchMove={handleNativeTouch}
        onTouchEnd={clearTouch}
      >
        <Pressable
          ref={inputRef}
          testID="perp-depth-plot-input"
          accessible={platformEnv.isNative ? false : undefined}
          tabIndex={platformEnv.isNative ? undefined : -1}
          style={inputStyle}
          onTouchCancel={platformEnv.isNative ? undefined : clearTouch}
          onPressOut={platformEnv.isNative ? undefined : clearTouch}
          onPointerDown={
            platformEnv.isNative
              ? undefined
              : (event) => {
                  if (event.nativeEvent.pointerType === 'touch') {
                    touching.current = true;
                    selectFromClientX(event.nativeEvent.clientX, 'touch');
                  }
                }
          }
          onPointerUp={platformEnv.isNative ? undefined : clearTouch}
          onPointerCancel={platformEnv.isNative ? undefined : clearTouch}
          onPointerEnter={platformEnv.isNative ? undefined : handlePointer}
          onPointerMove={platformEnv.isNative ? undefined : handlePointer}
          onPointerLeave={
            platformEnv.isNative
              ? undefined
              : (event) => {
                  if (event.nativeEvent.pointerType !== 'touch')
                    setInteraction(undefined);
                }
          }
        />
      </DepthChartGesture>
      {selections.length ? (
        <Stack
          pointerEvents="none"
          position="absolute"
          top={0}
          left={0}
          width={width}
          height={height}
        >
          <Svg
            width={plotWidth}
            height={height}
            style={{ position: 'absolute' }}
            pointerEvents="none"
          >
            {selections.map((selection) => {
              const x = geometry.toX(selection.price);
              return (
                <G key={selection.side}>
                  <Rect
                    x={selection.side === 'bid' ? 0 : x}
                    y={0}
                    width={selection.side === 'bid' ? x : plotWidth - x}
                    height={PLOT_TOP + plotHeight}
                    fill={theme.bgHover.val}
                    opacity={0.45}
                  />
                  <Line
                    x1={x}
                    x2={x}
                    y1={0}
                    y2={PLOT_TOP + plotHeight}
                    stroke={theme.textSubdued.val}
                    strokeDasharray="2 3"
                    strokeOpacity={0.65}
                  />
                  <Circle
                    cx={x}
                    cy={PLOT_TOP + selection.level.y}
                    r={3}
                    fill={
                      selection.side === 'bid'
                        ? theme.bgAccent.val
                        : theme.bgCriticalStrong.val
                    }
                  />
                </G>
              );
            })}
          </Svg>
          {selections.map((selection) => (
            <DepthSelectionTooltip
              key={selection.side}
              selection={selection}
              geometry={geometry}
              height={height}
              plotWidth={plotWidth}
              paired={paired}
              compact={compact}
              priceDecimals={priceDecimals}
              sizeDecimals={sizeDecimals}
            />
          ))}
        </Stack>
      ) : null}
    </>
  );
}

export function PerpDepthChart({
  bids,
  asks,
  quoteSymbol,
  priceDecimals,
  sizeDecimals,
  status,
  targetKey,
  tickLabel,
  showHeader = true,
  interactionEnabled = true,
  referenceMidPrice,
}: IPerpDepthChartProps) {
  const intl = useIntl();
  const [{ width, height }, setLayout] = useState({ width: 0, height: 0 });
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    const nextWidth = Math.floor(next.width);
    const nextHeight = Math.floor(next.height);
    setLayout((prev) =>
      nextWidth === prev.width && nextHeight === prev.height
        ? prev
        : { width: nextWidth, height: nextHeight },
    );
  }, []);

  const canPlot = status === 'ready' || status === 'stale';
  const { domain, zoomByWheel } = usePerpDepthChartDomain({
    bids: canPlot ? bids : EMPTY_LEVELS,
    asks: canPlot ? asks : EMPTY_LEVELS,
    referenceMidPrice,
    targetKey,
  });
  const plotWidth = width - PLOT_LEFT;
  const chartHeight = Math.max(
    0,
    height - (showHeader ? CHART_HEADER_HEIGHT : 0),
  );
  const geometry = useMemo(
    () =>
      canPlot && domain
        ? buildDepthChartGeometry({
            bids,
            asks,
            width: plotWidth,
            height: chartHeight - PLOT_TOP - PLOT_BOTTOM,
            domain,
            referenceMidPrice,
          })
        : undefined,
    [asks, bids, canPlot, chartHeight, domain, plotWidth, referenceMidPrice],
  );
  const midPrice = geometry?.midPrice;
  const stale = status === 'stale';
  const interactive = interactionEnabled && status === 'ready';
  const plotRef = useRef<ComponentRef<typeof YStack>>(null);
  const wheelEnabled =
    interactive &&
    Boolean(geometry) &&
    !platformEnv.isNative &&
    !platformEnv.isWebMobile;
  useEffect(() => {
    if (!wheelEnabled) return undefined;
    const plot = plotRef.current as unknown as HTMLElement | null;
    const desktopPointer = plot?.ownerDocument.defaultView?.matchMedia(
      '(hover: hover) and (pointer: fine)',
    );
    if (!plot || !desktopPointer) return undefined;

    const handleWheel = (event: WheelEvent) => {
      if (
        !desktopPointer.matches ||
        !event.cancelable ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX)
      ) {
        return;
      }

      const {
        left,
        right,
        top,
        bottom,
        height: plotHeight,
      } = plot.getBoundingClientRect();
      if (
        event.clientX < left + PLOT_LEFT ||
        event.clientX > right ||
        event.clientY < top + PLOT_TOP ||
        event.clientY > bottom - PLOT_BOTTOM
      ) {
        return;
      }

      let delta = event.deltaY;
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= plotHeight;
      if (zoomByWheel(delta)) event.preventDefault();
    };
    plot.addEventListener('wheel', handleWheel, { passive: false });
    return () => plot.removeEventListener('wheel', handleWheel);
  }, [wheelEnabled, zoomByWheel]);
  const sizeDigits = Math.min(20, Math.max(0, sizeDecimals));
  const priceDigits = Math.min(20, Math.max(0, priceDecimals));
  const chartLabel = intl.formatMessage({
    id: ETranslations.perp_order_book_depth,
  });
  const midPriceTitle = intl.formatMessage({
    id: ETranslations.perp_order_mid_price_title,
  });
  const formattedMidPrice =
    midPrice === undefined
      ? undefined
      : intl.formatNumber(midPrice, {
          maximumFractionDigits: Math.min(20, priceDigits + 1),
        });
  const chartDescription =
    showHeader || formattedMidPrice === undefined
      ? chartLabel
      : `${chartLabel}, ${midPriceTitle} ${formattedMidPrice}`;
  const rangeLabel = `±${intl.formatNumber(
    domain?.priceRangeRatio ?? DEPTH_PRICE_RANGE_RATIO,
    {
      style: 'percent',
      maximumFractionDigits: 3,
    },
  )}`;
  const incrementLabel = intl.formatMessage({
    id: ETranslations.market_chart_indicator_increment__label,
  });
  const tickDescription = `${incrementLabel} ${tickLabel} ${quoteSymbol}`;
  const placeholderLabelId =
    status === 'error'
      ? ETranslations.global_network_error
      : ETranslations.global_no_data;
  const showsStatus = geometry ? stale : status !== 'loading' && plotWidth > 0;
  const statusLabel = showsStatus
    ? intl.formatMessage({
        id: stale ? ETranslations.global_updating : placeholderLabelId,
      })
    : undefined;
  const nativeDescription =
    !showHeader && statusLabel
      ? `${chartDescription}, ${statusLabel}`
      : chartDescription;

  return (
    <YStack
      testID="perp-depth-chart"
      width="100%"
      flex={1}
      minHeight={CHART_MIN_HEIGHT}
      onLayout={handleLayout}
      role={platformEnv.isNative ? undefined : 'group'}
      aria-label={platformEnv.isNative ? undefined : chartDescription}
      accessible={platformEnv.isNative && !showHeader ? true : undefined}
      accessibilityLabel={platformEnv.isNative ? nativeDescription : undefined}
    >
      {showHeader ? (
        <XStack h={CHART_HEADER_HEIGHT} alignItems="center" gap="$1" px="$3">
          <Stack w={64}>
            {domain?.anchorMid === undefined ? null : (
              <SizableText
                size="$bodyXsMedium"
                color="$textSubdued"
                fontVariant={TABULAR_NUMS}
                numberOfLines={1}
              >
                {rangeLabel}
              </SizableText>
            )}
          </Stack>
          <YStack flex={1} minWidth={0} alignItems="center">
            {midPrice === undefined ? null : (
              <>
                <SizableText
                  size="$bodyXs"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {midPriceTitle}
                </SizableText>
                <SizableText
                  size="$bodySmMedium"
                  color="$text"
                  fontVariant={TABULAR_NUMS}
                  numberOfLines={1}
                >
                  {formattedMidPrice}
                </SizableText>
              </>
            )}
          </YStack>
          <YStack
            w={64}
            alignItems="flex-end"
            role={platformEnv.isNative ? undefined : 'group'}
            aria-label={platformEnv.isNative ? undefined : tickDescription}
            accessibilityLabel={
              platformEnv.isNative ? tickDescription : undefined
            }
            accessible={platformEnv.isNative ? true : undefined}
          >
            <SizableText size="$bodyXs" color="$textSubdued" numberOfLines={1}>
              {`Δ ${quoteSymbol}`}
            </SizableText>
            <SizableText
              size="$bodyXsMedium"
              color="$text"
              fontVariant={TABULAR_NUMS}
              numberOfLines={1}
            >
              {tickLabel}
            </SizableText>
          </YStack>
        </XStack>
      ) : null}
      <YStack
        ref={plotRef}
        height={chartHeight}
        position="relative"
        overflow="hidden"
      >
        {geometry ? (
          <>
            <Stack opacity={stale ? 0.55 : 1} pointerEvents="none">
              <DepthPlot
                geometry={geometry}
                width={width}
                height={chartHeight}
                plotWidth={plotWidth}
                priceDecimals={priceDigits}
              />
            </Stack>
            {stale ? (
              <SizableText
                position="absolute"
                top="$3"
                left="$3"
                size="$bodyXsMedium"
                color="$textSubdued"
                bg="$bgApp"
                px="$1"
              >
                {statusLabel}
              </SizableText>
            ) : null}
            {interactive ? (
              <DepthChartInteraction
                key={targetKey}
                geometry={geometry}
                width={width}
                height={chartHeight}
                plotWidth={plotWidth}
                priceDecimals={priceDigits}
                sizeDecimals={sizeDigits}
              />
            ) : null}
          </>
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center" gap="$2">
            {status === 'loading' || stale ? <Spinner size="small" /> : null}
            {statusLabel === undefined ? null : (
              <SizableText size="$bodySm" color="$textSubdued">
                {statusLabel}
              </SizableText>
            )}
          </YStack>
        )}
      </YStack>
    </YStack>
  );
}
