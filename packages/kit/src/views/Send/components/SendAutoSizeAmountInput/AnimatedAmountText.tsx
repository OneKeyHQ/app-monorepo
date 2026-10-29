import { memo, useEffect, useMemo, useState } from 'react';

import { Text, View } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  createAmountInputCharacters,
  updateAmountInputCharacters,
} from './amountInputTextUtils';

import type { TextStyle } from 'react-native';

const DURATION = 200;
const TIMING = {
  duration: DURATION,
  easing: Easing.bezier(0.215, 0.61, 0.355, 1),
};

const InputCharacter = memo(function InputCharacter({
  char,
  x,
  entering = false,
  canExit = true,
  textStyle,
}: {
  char: string;
  x: number;
  entering?: boolean;
  canExit?: boolean;
  textStyle: TextStyle & { lineHeight: number };
}) {
  const position = useSharedValue(x);
  useEffect(() => {
    position.value = withTiming(x, TIMING);
    return () => cancelAnimation(position);
  }, [position, x]);
  const style = useAnimatedStyle(() => ({ left: position.value }));
  const distance = textStyle.lineHeight;
  const enter = useMemo(
    () =>
      new Keyframe({
        0: { opacity: 0, transform: [{ translateY: distance }] },
        100: {
          opacity: 1,
          transform: [{ translateY: 0 }],
          easing: TIMING.easing,
        },
      }).duration(DURATION),
    [distance],
  );
  const exit = useMemo(
    () =>
      new Keyframe({
        0: { opacity: 1, transform: [{ translateY: 0 }] },
        100: {
          opacity: 0,
          transform: [{ translateY: distance }],
          easing: TIMING.easing,
        },
      }).duration(DURATION),
    [distance],
  );

  return (
    <Animated.Text
      entering={entering ? enter : undefined}
      exiting={canExit ? exit : undefined}
      style={[textStyle, { position: 'absolute', top: 0 }, style]}
    >
      {char}
    </Animated.Text>
  );
});

function TypingCharacters({
  value,
  start,
  widthOf,
  textStyle,
  prefix,
  suffix,
  prefixX,
  suffixX,
}: {
  value: string;
  start: number;
  widthOf: (char: string) => number;
  textStyle: TextStyle & { lineHeight: number };
  prefix?: string;
  suffix?: string;
  prefixX: number;
  suffixX: number;
}) {
  const [characters, setCharacters] = useState(() =>
    createAmountInputCharacters(value),
  );
  if (characters.text !== value) {
    setCharacters(updateAmountInputCharacters(characters, value));
  }
  let x = start;
  return (
    <>
      {prefix ? (
        <InputCharacter
          char={prefix}
          x={prefixX}
          textStyle={textStyle}
          canExit={false}
        />
      ) : null}
      {characters.characters.map((character) => {
        const offset = x;
        x += widthOf(character.char);
        return (
          <InputCharacter
            key={character.id}
            char={character.char}
            x={offset}
            entering={character.entering}
            textStyle={textStyle}
          />
        );
      })}
      {suffix ? (
        <InputCharacter
          char={suffix}
          x={suffixX}
          textStyle={textStyle}
          canExit={false}
        />
      ) : null}
    </>
  );
}

export function AnimatedAmountText({
  value,
  animated,
  fontFamily,
  maxFontSize,
  minFontSize,
  availableWidth,
  height,
  lineHeight: fixedLineHeight,
  align = 'center',
  prefix,
  suffix,
  prefixGap = 0,
  suffixGap = 0,
  characterWidths,
  placeholder = '0',
}: {
  value: string;
  animated: boolean;
  fontFamily: string;
  maxFontSize: number;
  minFontSize: number;
  availableWidth: number;
  height: number;
  lineHeight?: number;
  align?: 'left' | 'center';
  prefix?: string;
  suffix?: string;
  prefixGap?: number;
  suffixGap?: number;
  characterWidths?: Record<string, number>;
  placeholder?: string;
}) {
  const reducedMotion = useReducedMotion();
  const theme = useTheme();
  const displayValue = value || placeholder;
  const measureKey = `${fontFamily}:${maxFontSize}`;
  const [measurement, setMeasurement] = useState<{
    key: string;
    widths: Record<string, number>;
  }>({ key: '', widths: {} });
  const widths =
    characterWidths ??
    (measurement.key === measureKey ? measurement.widths : {});
  const unscaledWidth = (char: string) =>
    widths[char] ?? maxFontSize * (char === '.' ? 0.25 : 0.6);
  const textWidth = (text: string) =>
    Array.from(text).reduce((total, char) => total + unscaledWidth(char), 0);
  const gaps = (prefix ? prefixGap : 0) + (suffix ? suffixGap : 0);
  const naturalWidth = textWidth(
    `${prefix ?? ''}${displayValue}${suffix ?? ''}`,
  );
  const fontSize = Math.max(
    minFontSize,
    Math.min(
      maxFontSize,
      Math.floor(
        (maxFontSize * Math.max(availableWidth - gaps - 2, 0)) /
          Math.max(naturalWidth, 1),
      ),
    ),
  );
  const scale = fontSize / maxFontSize;
  const widthOf = (char: string) => unscaledWidth(char) * scale;
  const totalWidth = naturalWidth * scale + gaps;
  const prefixX =
    align === 'left' ? 0 : Math.max(0, (availableWidth - totalWidth) / 2);
  const start = prefixX + (prefix ? textWidth(prefix) * scale + prefixGap : 0);
  const suffixX =
    start + textWidth(displayValue) * scale + (suffix ? suffixGap : 0);
  const lineHeight = fixedLineHeight ?? fontSize;
  const color = value ? theme.text.val : theme.textDisabled.val;
  const textStyle = useMemo(
    () => ({
      fontFamily,
      fontSize,
      lineHeight,
      color,
      // Native already receives the exact Medium face used by the input.
      // An extra weight can remap that face in React Native's font resolver.
      fontWeight: platformEnv.isNative ? undefined : ('500' as const),
      includeFontPadding: false,
    }),
    [fontFamily, fontSize, lineHeight, color],
  );
  const measureStyle: TextStyle = { ...textStyle, fontSize: maxFontSize };
  // The fixed glyph set prevents layout measurements on every keypress.
  const glyphs = Array.from(
    new Set(`0123456789.${prefix ?? ''}${suffix ?? ''}`),
  );

  return (
    <View
      pointerEvents="none"
      style={{ width: '100%', height, overflow: 'hidden' }}
    >
      {!characterWidths ? (
        <View
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', width: 10_000, opacity: 0 }}
        >
          {glyphs.map((char) => (
            <View
              key={`${measureKey}:${char}`}
              style={{ alignSelf: 'flex-start' }}
              onLayout={(event) => {
                const width = event.nativeEvent.layout.width;
                if (width > 0)
                  setMeasurement((previous) => {
                    const oldWidths =
                      previous.key === measureKey ? previous.widths : {};
                    return oldWidths[char] === width
                      ? previous
                      : {
                          key: measureKey,
                          widths: { ...oldWidths, [char]: width },
                        };
                  });
              }}
            >
              <Text style={measureStyle} numberOfLines={1}>
                {char}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: (height - lineHeight) / 2,
          height: lineHeight,
        }}
      >
        {animated && !reducedMotion ? (
          <TypingCharacters
            value={displayValue}
            start={start}
            widthOf={widthOf}
            textStyle={textStyle}
            prefix={prefix}
            suffix={suffix}
            prefixX={prefixX}
            suffixX={suffixX}
          />
        ) : (
          <>
            {prefix ? (
              <Text
                style={[textStyle, { position: 'absolute', left: prefixX }]}
              >
                {prefix}
              </Text>
            ) : null}
            <Text style={[textStyle, { position: 'absolute', left: start }]}>
              {displayValue}
            </Text>
            {suffix ? (
              <Text
                style={[textStyle, { position: 'absolute', left: suffixX }]}
              >
                {suffix}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}
