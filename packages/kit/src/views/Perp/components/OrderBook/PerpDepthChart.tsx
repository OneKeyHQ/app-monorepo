import {
  type ComponentRef,
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { Text as NativeText, Platform, Pressable } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
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

import {
  DEPTH_MARKER_HIT_SLOP,
  DEPTH_PRICE_RANGE_RATIO,
  buildDepthChartGeometry,
  getDepthChartLevel,
  getDepthChartLevelAtPrice,
} from './perpDepthChartGeometry';
import { usePerpDepthChartDomain } from './usePerpDepthChartDomain';
import { getOrderBookDistanceFromMid } from './utils';

import type { IPerpDepthLevel } from './perpDepthChartGeometry';
import type { IntlShape } from 'react-intl';
import type {
  GestureResponderEvent,
  LayoutChangeEvent,
  PointerEvent,
  TextStyle,
} from 'react-native';

const CHART_MIN_HEIGHT = 228;
const CHART_HEADER_HEIGHT = 44;
const PLOT_LEFT = 12;
const INITIAL_PLOT_RIGHT = 55;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 28;
const AXIS_FONT_SIZE = 10;
const AXIS_INSET = 6;
const AXIS_OUTSET = 6;
const SIZE_TICK_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];
const AXIS_FONT_FAMILY = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: webFontFamily,
});
const AXIS_TEXT_STYLE: TextStyle & { whiteSpace?: 'pre' } = {
  alignSelf: 'flex-start',
  fontFamily: AXIS_FONT_FAMILY,
  fontSize: AXIS_FONT_SIZE,
  fontVariant: ['tabular-nums'],
  position: 'absolute',
  top: 0,
  left: 0,
  opacity: 0,
  pointerEvents: 'none',
  whiteSpace: platformEnv.isNative ? undefined : 'pre',
};
const AXIS_SVG_TEXT_PROPS = {
  fontFamily: AXIS_FONT_FAMILY,
  fontSize: AXIS_FONT_SIZE,
  fontFeatureSettings: '"tnum"',
};
const TOOLTIP_INITIAL_HEIGHT = 92;
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
  baseSymbol: string;
  quoteSymbol: string;
  priceDecimals: number;
  sizeDecimals: number;
  status: 'loading' | 'empty' | 'error' | 'stale' | 'ready';
  targetKey: string;
  tickLabel: string;
  referenceMidPrice?: number;
  priceStep?: number;
};

type IChartLabels = {
  baseSymbol: string;
  quoteSymbol: string;
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

const RightAxisWidthProbe = memo(function RightAxisWidthProbe({
  measurementKey,
  sample,
  onWidth,
}: {
  measurementKey: string;
  sample: string;
  onWidth: (key: string, width: number) => void;
}) {
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onWidth(measurementKey, event.nativeEvent.layout.width);
    },
    [measurementKey, onWidth],
  );

  return (
    <NativeText
      style={AXIS_TEXT_STYLE}
      allowFontScaling={false}
      aria-hidden={!platformEnv.isNative || undefined}
      accessibilityElementsHidden={platformEnv.isNative || undefined}
      importantForAccessibility={
        platformEnv.isNative ? 'no-hide-descendants' : undefined
      }
      onLayout={onLayout}
    >
      {sample}
    </NativeText>
  );
});

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

function getPriceTicks(min: number, max: number, count: number) {
  const rawStep = (max - min) / count;
  if (rawStep <= 0) {
    return [min];
  }
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step =
    ([1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= rawStep) ?? 10) *
    magnitude;
  const firstIndex = Math.ceil(min / step);
  const lastIndex = Math.floor(max / step);
  return Array.from(
    { length: Math.min(count + 1, lastIndex - firstIndex + 1) },
    (_, index) => (firstIndex + index) * step,
  );
}

const DepthPlot = memo(function DepthPlot({
  geometry,
  width,
  height,
  plotWidth,
  axisWidthPending,
  baseSymbol,
  quoteSymbol,
  priceDecimals,
}: Omit<IChartLabels, 'sizeDecimals'> & {
  geometry: IDepthChartGeometry;
  width: number;
  height: number;
  plotWidth: number;
  axisWidthPending: boolean;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const plotHeight = height - PLOT_TOP - PLOT_BOTTOM;
  const rightAxisX = axisWidthPending
    ? width - PLOT_LEFT - AXIS_OUTSET
    : plotWidth + AXIS_INSET;
  const rightAxisAnchor = axisWidthPending ? 'end' : 'start';
  const axisColor = theme.borderSubdued.val;
  const labelColor = theme.textSubdued.val;
  const bidColor = theme.textSuccess.val;
  const askColor = theme.textCritical.val;
  const formatAxisPrice = (price: number) =>
    intl.formatNumber(price, {
      maximumFractionDigits: priceDecimals,
    });
  const maxLabelWidth =
    Math.max(
      formatAxisPrice(geometry.minPrice).length,
      formatAxisPrice(geometry.maxPrice).length,
    ) * 6;
  const priceTickCount = Math.min(
    6,
    Math.max(2, Math.floor(plotWidth / (maxLabelWidth + 24))),
  );
  const priceTicks = getPriceTicks(
    geometry.minPrice,
    geometry.maxPrice,
    priceTickCount,
  );
  const sizeLabels = useMemo(
    () => formatSizeTicks(intl, geometry.maxSize),
    [geometry.maxSize, intl],
  );
  const midX =
    geometry.midPrice === undefined
      ? undefined
      : geometry.toX(geometry.midPrice);

  return (
    <Svg
      width={width}
      height={height}
      pointerEvents="none"
      accessible={platformEnv.isNative ? false : undefined}
      aria-hidden={platformEnv.isNative ? undefined : true}
    >
      <G x={PLOT_LEFT} y={PLOT_TOP}>
        {SIZE_TICK_FRACTIONS.map((fraction, index) => {
          const y = plotHeight * (1 - fraction);
          return (
            <G key={fraction}>
              <Line
                x1={0}
                y1={y}
                x2={plotWidth}
                y2={y}
                stroke={axisColor}
                strokeOpacity={fraction === 0 ? 0.9 : 0.55}
              />
              <Text
                x={rightAxisX}
                y={y + 3}
                textAnchor={rightAxisAnchor}
                fill={labelColor}
                {...AXIS_SVG_TEXT_PROPS}
              >
                {sizeLabels[index]}
              </Text>
            </G>
          );
        })}
        {priceTicks.map((price) => {
          const x = geometry.toX(price);
          let anchor: 'start' | 'middle' | 'end' = 'middle';
          if (x < maxLabelWidth / 2) anchor = 'start';
          if (x > plotWidth - maxLabelWidth / 2) anchor = 'end';
          return (
            <Text
              key={price}
              x={x}
              y={plotHeight + 16}
              textAnchor={anchor}
              fill={labelColor}
              {...AXIS_SVG_TEXT_PROPS}
            >
              {formatAxisPrice(price)}
            </Text>
          );
        })}
        <Text
          x={rightAxisX}
          y={plotHeight + 16}
          textAnchor={rightAxisAnchor}
          fill={labelColor}
          {...AXIS_SVG_TEXT_PROPS}
        >
          {quoteSymbol}
        </Text>
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
        {midX !== undefined && midX >= 0 && midX <= plotWidth ? (
          <Line
            testID="perp-depth-mid-line"
            x1={midX}
            y1={0}
            x2={midX}
            y2={plotHeight}
            stroke={theme.borderStrong.val}
            strokeDasharray="3 3"
            strokeOpacity={0.85}
          />
        ) : null}
      </G>
      <Text
        x={width - AXIS_OUTSET}
        y={9}
        textAnchor="end"
        fill={labelColor}
        {...AXIS_SVG_TEXT_PROPS}
      >
        {baseSymbol}
      </Text>
    </Svg>
  );
});

function DepthTooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack gap="$1" rowGap="$0" justifyContent="space-between" flexWrap="wrap">
      <SizableText size="$bodyXs" color="$textSubdued" maxWidth="100%">
        {label}
      </SizableText>
      <SizableText
        size="$bodyXsMedium"
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

function DepthChartInteraction({
  geometry,
  width,
  height,
  plotWidth,
  baseSymbol,
  quoteSymbol,
  sizeDecimals,
}: Omit<IChartLabels, 'priceDecimals'> & {
  geometry: IDepthChartGeometry;
  width: number;
  height: number;
  plotWidth: number;
}) {
  const intl = useIntl();
  const reducedMotion = useReducedMotion();
  const inputRef = useRef<ComponentRef<typeof Pressable>>(null);
  const [selectedPrice, setSelectedPrice] = useState<number>();
  const [tooltipHeight, setTooltipHeight] = useState(TOOLTIP_INITIAL_HEIGHT);
  const handleTooltipLayout = useCallback((event: LayoutChangeEvent) => {
    setTooltipHeight(Math.ceil(event.nativeEvent.layout.height));
  }, []);
  const plotHeight = height - PLOT_TOP - PLOT_BOTTOM;
  const inputStyle = {
    position: 'absolute' as const,
    left: PLOT_LEFT - DEPTH_MARKER_HIT_SLOP,
    top: PLOT_TOP - 3,
    width: plotWidth + DEPTH_MARKER_HIT_SLOP * 2,
    height: plotHeight + 6,
    touchAction: platformEnv.isNative ? undefined : ('pan-y' as const),
  };
  const selectFromPlotX = (x: number) => {
    const level = getDepthChartLevel(geometry, x)?.level;
    const price = level ? Number(level.price) : undefined;
    // Store the real level price shown in the tooltip and query its live cumulative size.
    setSelectedPrice(
      price !== undefined &&
        price >= geometry.minPrice &&
        price <= geometry.maxPrice
        ? price
        : undefined,
    );
  };
  const selectFromClientX = (clientX: number) => {
    const bounds = inputRef.current?.getBoundingClientRect();
    if (bounds) {
      selectFromPlotX(clientX - bounds.left - DEPTH_MARKER_HIT_SLOP);
    }
  };
  const handlePointer = (event: PointerEvent) => {
    if (event.nativeEvent.pointerType !== 'touch') {
      selectFromClientX(event.nativeEvent.clientX);
    }
  };
  const handlePress = (event: GestureResponderEvent) => {
    if (!platformEnv.isNative) {
      // React Native Web fires onPress from a click without locationX.
      const { clientX } = event.nativeEvent as { clientX?: number };
      if (typeof clientX === 'number' && Number.isFinite(clientX)) {
        selectFromClientX(clientX);
      }
    } else if (Number.isFinite(event.nativeEvent.locationX)) {
      selectFromPlotX(event.nativeEvent.locationX - DEPTH_MARKER_HIT_SLOP);
    }
  };

  const selection =
    selectedPrice === undefined
      ? undefined
      : getDepthChartLevelAtPrice(geometry, selectedPrice);
  const distanceFromMid =
    selection && geometry.midPrice !== undefined
      ? getOrderBookDistanceFromMid(selection.price, geometry.midPrice)
      : null;
  const x = PLOT_LEFT + (selection ? geometry.toX(selection.price) : 0);
  const y = PLOT_TOP + (selection?.level.y ?? 0);
  const tooltipWidth = Math.min(220, width - TOOLTIP_MARGIN * 2);
  const tooltipLeft = Math.max(
    TOOLTIP_MARGIN,
    Math.min(
      x + tooltipWidth + 10 <= width ? x + 10 : x - tooltipWidth - 10,
      width - tooltipWidth - TOOLTIP_MARGIN,
    ),
  );
  const tooltipTop = Math.max(
    TOOLTIP_MARGIN,
    Math.min(y - tooltipHeight / 2, height - tooltipHeight - TOOLTIP_MARGIN),
  );
  const isBid = selection?.side === 'bid';

  return (
    <>
      <Pressable
        ref={inputRef}
        testID="perp-depth-plot-input"
        accessible={platformEnv.isNative ? false : undefined}
        tabIndex={platformEnv.isNative ? undefined : -1}
        style={inputStyle}
        onPress={handlePress}
        onPointerEnter={platformEnv.isNative ? undefined : handlePointer}
        onPointerMove={platformEnv.isNative ? undefined : handlePointer}
        onPointerLeave={
          platformEnv.isNative
            ? undefined
            : (event) => {
                if (event.nativeEvent.pointerType !== 'touch') {
                  setSelectedPrice(undefined);
                }
              }
        }
      />
      {selection ? (
        <Stack
          pointerEvents="none"
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
        >
          <Stack
            position="absolute"
            top={PLOT_TOP}
            left={x}
            w={1}
            h={plotHeight}
            bg="$borderSubdued"
          />
          <Stack
            position="absolute"
            top={y}
            left={PLOT_LEFT}
            w={plotWidth}
            h={1}
            bg="$borderSubdued"
          />
          <Stack
            position="absolute"
            left={x - 3}
            top={y - 3}
            w={6}
            h={6}
            borderRadius="$full"
            bg={isBid ? '$textSuccess' : '$textCritical'}
            transition={reducedMotion ? '0ms' : '100ms'}
            animateOnly={ANIMATE_OPACITY}
            enterStyle={reducedMotion ? undefined : FADE_FROM_TRANSPARENT}
          />
          <YStack
            testID="perp-depth-tooltip"
            position="absolute"
            top={tooltipTop}
            left={tooltipLeft}
            w={tooltipWidth}
            p="$2"
            gap="$0.5"
            borderWidth="$px"
            borderColor="$borderSubdued"
            borderRadius="$2"
            bg="$bgApp"
            transition={reducedMotion ? '0ms' : '100ms'}
            animateOnly={ANIMATE_OPACITY}
            enterStyle={reducedMotion ? undefined : FADE_FROM_TRANSPARENT}
            onLayout={handleTooltipLayout}
          >
            <SizableText
              size="$bodyXsMedium"
              color={isBid ? '$textSuccess' : '$textCritical'}
            >
              {isBid ? 'Bids' : 'Asks'}
            </SizableText>
            <DepthTooltipRow
              label={intl.formatMessage({
                id: ETranslations.perp_orderbook_price,
              })}
              value={`${isBid ? '≥' : '≤'} ${intl.formatNumber(selection.price, { maximumFractionDigits: 20 })} ${quoteSymbol}`}
            />
            <DepthTooltipRow
              label="Cumulative size"
              value={`${intl.formatNumber(Number(selection.level.cumSize), { maximumFractionDigits: sizeDecimals })} ${baseSymbol}`}
            />
            {distanceFromMid === null ? null : (
              <DepthTooltipRow
                label={intl.formatMessage({
                  id: ETranslations.perp_distance_from_mid__title,
                })}
                value={intl.formatNumber(Number(distanceFromMid) / 100, {
                  style: 'percent',
                  maximumFractionDigits: 4,
                })}
              />
            )}
          </YStack>
        </Stack>
      ) : null}
    </>
  );
}

export function PerpDepthChart({
  bids,
  asks,
  baseSymbol,
  quoteSymbol,
  priceDecimals,
  sizeDecimals,
  status,
  targetKey,
  tickLabel,
  referenceMidPrice,
  priceStep,
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
    priceStep,
    targetKey,
  });
  const maxSize = domain?.maxSize;
  const widthSample = useMemo(() => {
    if (maxSize === undefined) return '';
    // Tabular digits let the same width sample cover all values with this format.
    const digit = intl.formatNumber(8, { useGrouping: false });
    const numbers = formatSizeTicks(intl, maxSize).map(
      (label) => label.replace(/\p{Decimal_Number}/gu, digit) + digit,
    );
    return [baseSymbol, quoteSymbol, ...numbers].join('\n');
  }, [baseSymbol, intl, maxSize, quoteSymbol]);
  const axisWidthKey = `${targetKey}\n${intl.locale}\n${widthSample}`;
  const currentAxisWidthKey = useRef(axisWidthKey);
  const [measuredAxis, setMeasuredAxis] = useState<{
    key: string;
    right: number;
  }>();
  useLayoutEffect(() => {
    currentAxisWidthKey.current = axisWidthKey;
  }, [axisWidthKey]);
  const handleAxisWidth = useCallback((key: string, value: number) => {
    if (
      key !== currentAxisWidthKey.current ||
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return;
    }
    const right = Math.ceil(value + AXIS_INSET + AXIS_OUTSET);
    setMeasuredAxis((previous) =>
      previous?.key === key && previous.right === right
        ? previous
        : { key, right },
    );
  }, []);
  const plotRight = measuredAxis?.right ?? INITIAL_PLOT_RIGHT;
  const axisWidthPending = measuredAxis?.key !== axisWidthKey;
  const plotWidth = width - PLOT_LEFT - plotRight;
  const chartHeight = Math.max(0, height - CHART_HEADER_HEIGHT);
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
  const plotRef = useRef<ComponentRef<typeof YStack>>(null);
  const wheelEnabled =
    status === 'ready' &&
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
        event.clientX > right - plotRight ||
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
  }, [plotRight, wheelEnabled, zoomByWheel]);
  const sizeDigits = Math.min(20, Math.max(0, sizeDecimals));
  const priceDigits = Math.min(20, Math.max(0, priceDecimals));
  const chartLabel = intl.formatMessage({
    id: ETranslations.perp_order_book_depth,
  });
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
  const updatingLabel = intl.formatMessage({
    id: ETranslations.global_updating,
  });
  const placeholderLabelId =
    status === 'error'
      ? ETranslations.global_network_error
      : ETranslations.global_no_data;

  return (
    <YStack
      testID="perp-depth-chart"
      width="100%"
      flex={1}
      minHeight={CHART_MIN_HEIGHT}
      onLayout={handleLayout}
      role={platformEnv.isNative ? undefined : 'group'}
      aria-label={platformEnv.isNative ? undefined : chartLabel}
      accessibilityLabel={platformEnv.isNative ? chartLabel : undefined}
    >
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
                {intl.formatMessage({
                  id: ETranslations.perp_order_mid_price_title,
                })}
              </SizableText>
              <SizableText
                size="$bodySmMedium"
                color="$text"
                fontVariant={TABULAR_NUMS}
                numberOfLines={1}
              >
                {intl.formatNumber(midPrice, {
                  maximumFractionDigits: Math.min(20, priceDigits + 1),
                })}
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
                axisWidthPending={axisWidthPending}
                baseSymbol={baseSymbol}
                quoteSymbol={quoteSymbol}
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
                {updatingLabel}
              </SizableText>
            ) : (
              <DepthChartInteraction
                key={targetKey}
                geometry={geometry}
                width={width}
                height={chartHeight}
                plotWidth={plotWidth}
                baseSymbol={baseSymbol}
                quoteSymbol={quoteSymbol}
                sizeDecimals={sizeDigits}
              />
            )}
          </>
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center" gap="$2">
            {status === 'loading' || stale ? <Spinner size="small" /> : null}
            {status !== 'loading' && plotWidth > 0 ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {stale
                  ? updatingLabel
                  : intl.formatMessage({ id: placeholderLabelId })}
              </SizableText>
            ) : null}
          </YStack>
        )}
      </YStack>
      {widthSample ? (
        <RightAxisWidthProbe
          key={axisWidthKey}
          measurementKey={axisWidthKey}
          sample={widthSample}
          onWidth={handleAxisWidth}
        />
      ) : null}
    </YStack>
  );
}
