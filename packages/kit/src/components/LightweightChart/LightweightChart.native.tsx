import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Canvas,
  Circle,
  Group,
  Picture,
  Skia,
  useTypeface,
} from '@shopify/react-native-skia';
import { Image } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Stack } from '@onekeyhq/components';
import { HeaderScrollGestureContext } from '@onekeyhq/components/src/composite/Tabs/HeaderScrollGestureContext';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TRADING_VIEW_NATIVE_CROSSHAIR_LONG_PRESS_DURATION } from '../TradingView/TradingViewNative/chartConstants';
import {
  createTradingViewNativeSkiaCommandPicture,
  createTradingViewNativeSkiaFontForText,
  createTradingViewNativeSkiaResources,
} from '../TradingView/TradingViewNative/native/chartSkiaRenderer';
import {
  getTradingViewNativeSkiaDigitWidth,
  getTradingViewNativeSkiaPriceAxisLabelWidth,
} from '../TradingView/TradingViewNative/native/chartSkiaText';

import { useChartConfig } from './hooks/useChartConfig';
import {
  buildNativeChartCrosshair,
  buildNativeChartScene,
  getNativeChartHover,
} from './native/chartScene';

import type { ILightweightChartProps } from './types';

const FONT_SOURCE =
  require('@onekeyhq/components/src/hocs/Provider/fonts/brand/BrandSans-Regular.ttf') as number;
const FONT_URI = Image.resolveAssetSource(FONT_SOURCE)?.uri;
const FONT_FAMILY = platformEnv.isNativeAndroid ? 'sans-serif' : 'System';

export function LightweightChart(props: ILightweightChartProps) {
  const { height, onHover, nativeScrubOptions } = props;
  const [width, setWidth] = useState(0);
  const chartConfig = useChartConfig(props);
  const config = useMemo(
    () => ({
      ...chartConfig,
      hideCrosshairPriceLabel: props.hideCrosshairPriceLabel,
    }),
    [chartConfig, props.hideCrosshairPriceLabel],
  );
  const fontSize = config.fontSize ?? 12;
  const typeface = useTypeface(FONT_URI ?? null);
  const axisFont = useMemo(
    () =>
      typeface
        ? Skia.Font(typeface, fontSize)
        : createTradingViewNativeSkiaFontForText({
            fontFamily: FONT_FAMILY,
            fontSize,
            locale: config.locale ?? 'en',
            requiredText: '0123456789$%.₀₁₂₃₄₅₆₇₈₉',
          }),
    [typeface, fontSize, config.locale],
  );
  const digitWidth = useMemo(
    () => getTradingViewNativeSkiaDigitWidth(axisFont),
    [axisFont],
  );
  const labelFont = useMemo(
    () =>
      createTradingViewNativeSkiaFontForText({
        fontFamily: FONT_FAMILY,
        fontSize: nativeScrubOptions?.largePrice ? 16 : 14,
        locale: config.locale ?? 'en',
        requiredText: `${config.referenceLine?.title ?? ''}${Object.values(
          nativeScrubOptions?.labels ?? {},
        )
          .map((label) => `${label.time}${label.price ?? ''}`)
          .join('')}`,
      }),
    [config.locale, config.referenceLine?.title, nativeScrubOptions],
  );
  const timeFont = useMemo(
    () =>
      createTradingViewNativeSkiaFontForText({
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        locale: config.locale ?? 'en',
        requiredText: config.referenceLine?.title ?? '',
      }),
    [config.locale, config.referenceLine?.title],
  );
  const timeAxisFont = useMemo(() => {
    const locale =
      config.locale ?? Intl.DateTimeFormat().resolvedOptions().locale;
    return createTradingViewNativeSkiaFontForText({
      fontFamily: FONT_FAMILY,
      fontSize,
      locale,
      requiredText: new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(0),
    });
  }, [fontSize, config.locale]);
  const referenceFont = useMemo(
    () =>
      createTradingViewNativeSkiaFontForText({
        fontFamily: FONT_FAMILY,
        fontSize,
        locale: config.locale ?? 'en',
        requiredText: config.referenceLine?.title ?? '',
      }),
    [fontSize, config.locale, config.referenceLine?.title],
  );
  const scene = useMemo(
    () =>
      buildNativeChartScene({
        config,
        width,
        height,
        measureText: (text, font) => {
          if (font === 'priceAxis')
            return getTradingViewNativeSkiaPriceAxisLabelWidth(
              text,
              axisFont,
              digitWidth,
            );
          const measureFont =
            font === 'referenceLineLabel' ? referenceFont : timeAxisFont;
          return measureFont.measureText(text).width;
        },
      }),
    [config, width, height, axisFont, digitWidth, referenceFont, timeAxisFont],
  );
  const { textSubduedColor, lineColor } = config.theme;
  const gridColor = config.horzLineColor ?? '#E5E5EA';
  const resources = useDerivedValue(
    () =>
      createTradingViewNativeSkiaResources({
        colors: {
          axisText: textSubduedColor,
          background: 'transparent',
          grid: gridColor,
          line: lineColor,
          up: lineColor,
          down: lineColor,
        },
        fontFamily: FONT_FAMILY,
        legendFont: labelFont,
        priceAxisTypeface: typeface,
        priceAxisFontSize: fontSize,
        timeAxisFontSize: fontSize,
        timeAxisFont,
        tradingLineLabelFont: timeFont,
        watermarkSvg: null,
      }),
    [
      textSubduedColor,
      lineColor,
      gridColor,
      labelFont,
      typeface,
      fontSize,
      timeAxisFont,
      timeFont,
    ],
  );
  const active = useSharedValue(false);
  const touch = useSharedValue({ x: 0, y: 0 });
  const picture = useDerivedValue(() => {
    const commands =
      nativeScrubOptions && active.value
        ? scene.commands.filter(
            (command) =>
              command.kind !== 'polyline' ||
              command.customPaintId !== 'secondary',
          )
        : scene.commands;
    return createTradingViewNativeSkiaCommandPicture({
      commands,
      customPaintStyles: scene.customPaintStyles,
      resources: resources.value,
      width,
      height,
    });
  }, [scene, width, height, nativeScrubOptions]);
  const crosshair = useDerivedValue(() => {
    const overlay = active.value
      ? buildNativeChartCrosshair(
          scene,
          touch.value.x,
          touch.value.y,
          nativeScrubOptions,
        )
      : { commands: [], customPaintStyles: scene.customPaintStyles };
    return createTradingViewNativeSkiaCommandPicture({
      ...overlay,
      resources: resources.value,
      width,
      height,
    });
  }, [scene, width, height, nativeScrubOptions]);
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const reportHover = useCallback(
    (hover: Parameters<NonNullable<ILightweightChartProps['onHover']>>[0]) =>
      onHoverRef.current?.(hover),
    [],
  );
  useAnimatedReaction(
    () =>
      active.value
        ? getNativeChartHover(scene, touch.value.x, touch.value.y)
        : null,
    (hover, previous) => {
      if (!hover) {
        if (previous) runOnJS(reportHover)({});
        return;
      }
      if (
        !previous ||
        hover.time !== previous.time ||
        hover.price !== previous.price ||
        hover.secondaryPrice !== previous.secondaryPrice ||
        hover.x !== previous.x ||
        hover.y !== previous.y
      )
        runOnJS(reportHover)(hover);
    },
    [scene, reportHover],
  );
  useEffect(() => () => onHoverRef.current?.({}), []);
  const { excludeStartEdgeWidth } = useContext(HeaderScrollGestureContext);
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!!onHover || !!nativeScrubOptions)
        .activateAfterLongPress(
          TRADING_VIEW_NATIVE_CROSSHAIR_LONG_PRESS_DURATION,
        )
        .maxPointers(1)
        .onTouchesDown((event, manager) => {
          'worklet';
          const point = event.changedTouches[0];
          if (
            point &&
            (point.x < Math.max(scene.plot.x, excludeStartEdgeWidth) ||
              point.x > scene.plot.x + scene.plot.width ||
              point.y > scene.plot.height)
          )
            manager.fail();
        })
        .onStart((event) => {
          'worklet';
          active.value = true;
          touch.value = { x: event.x, y: event.y };
        })
        .onUpdate((event) => {
          'worklet';
          touch.value = { x: event.x, y: event.y };
        })
        .onFinalize(() => {
          'worklet';
          active.value = false;
        }),
    [
      onHover,
      nativeScrubOptions,
      scene.plot,
      excludeStartEdgeWidth,
      active,
      touch,
    ],
  );
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (props.pulseLastPoint)
      pulse.value = withRepeat(withTiming(1, { duration: 1400 }), -1, false);
    return () => {
      cancelAnimation(pulse);
      pulse.value = 0;
    };
  }, [props.pulseLastPoint, pulse]);
  const ringRadius = useDerivedValue(() => 4 * (1 + 1.4 * pulse.value));
  const ringOpacity = useDerivedValue(() => (1 - pulse.value) * 0.5);
  const dotRadius = useDerivedValue(
    () => 4 * (1 + 0.3 * Math.sin(Math.PI * pulse.value)),
  );
  return (
    <Stack
      testID="lightweight-chart-native"
      height={height}
      width="100%"
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
    >
      <GestureDetector gesture={gesture}>
        <Canvas testID="lightweight-chart-skia" style={{ flex: 1 }}>
          <Picture picture={picture} />
          {props.pulseLastPoint && scene.lastPoint ? (
            <Group clip={scene.plot}>
              <Circle
                cx={scene.lastPoint.x}
                cy={scene.lastPoint.y}
                r={ringRadius}
                opacity={ringOpacity}
                color={props.pulseLastPointColor ?? config.theme.lineColor}
              />
              <Circle
                cx={scene.lastPoint.x}
                cy={scene.lastPoint.y}
                r={dotRadius}
                color={props.pulseLastPointColor ?? config.theme.lineColor}
              />
            </Group>
          ) : null}
          <Picture picture={crosshair} />
        </Canvas>
      </GestureDetector>
    </Stack>
  );
}
