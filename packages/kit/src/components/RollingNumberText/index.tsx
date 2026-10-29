import { useMemo, useState } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import { SizableText, Stack, XStack, getFontToken } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { RollingDigit } from './RollingDigit';

type IRollingNumberTextProps = Pick<
  ISizableTextProps,
  | 'size'
  | 'fontSize'
  | 'fontVariant'
  | 'includeFontPadding'
  | 'color'
  | 'numberOfLines'
  | 'adjustsFontSizeToFit'
  | 'flex'
  | 'flexShrink'
  | 'y'
  | 'textAlign'
  | 'testID'
> & { children: string; lineHeight?: number; animated?: boolean };

export function RollingNumberText({
  children,
  animated = true,
  flex,
  flexShrink,
  y,
  testID,
  textAlign,
  ...textProps
}: IRollingNumberTextProps) {
  const reducedMotion = useReducedMotion();
  const [availableWidth, setAvailableWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const token = getFontToken(textProps.size ?? '$bodyMd');
  let lineHeight = 24;
  if (typeof token === 'object' && token) lineHeight = token.lineHeight;
  if (typeof textProps.lineHeight === 'number') {
    lineHeight = textProps.lineHeight;
  }
  const digitProps = useMemo(
    () => ({
      size: textProps.size,
      fontSize: textProps.fontSize,
      fontVariant: textProps.fontVariant,
      includeFontPadding: textProps.includeFontPadding,
    }),
    [
      textProps.size,
      textProps.fontSize,
      textProps.fontVariant,
      textProps.includeFontPadding,
    ],
  );
  const scale =
    availableWidth > 0 && contentWidth > 0
      ? Math.min(1, availableWidth / contentWidth)
      : 1;
  const alignment = textAlign === 'right' ? 'flex-end' : 'flex-start';

  // Masked balances and missing values unmount every animated digit immediately.
  if (!animated || reducedMotion || !/\d/.test(children)) {
    return (
      <SizableText
        {...textProps}
        flex={flex}
        flexShrink={flexShrink}
        y={y}
        textAlign={textAlign}
        testID={testID}
      >
        {children}
      </SizableText>
    );
  }

  return (
    <Stack
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={children}
      flex={flex}
      flexShrink={flexShrink}
      y={y}
      minWidth={0}
      onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
    >
      {/* Keep the original text's layout, fitting and accessible value. */}
      <SizableText
        {...textProps}
        textAlign={textAlign}
        opacity={0}
        accessibilityElementsHidden={platformEnv.isNative}
        importantForAccessibility={
          platformEnv.isNative ? 'no-hide-descendants' : undefined
        }
      >
        {children}
      </SizableText>
      <Stack
        position="absolute"
        inset={0}
        justifyContent="center"
        alignItems={alignment}
        overflow="hidden"
        pointerEvents="none"
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <XStack
          flexShrink={0}
          height={lineHeight}
          alignItems="center"
          onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}
          style={{
            transform: [{ scale }],
            transformOrigin:
              textAlign === 'right' ? 'right center' : 'left center',
          }}
        >
          {children.split(/(\d[\d.,]*)/).map((part, partIndex) =>
            Array.from(part, (char, index) => {
              // Align numeric columns from the right when integer digits grow.
              const key = `${partIndex}:${part.length - index}`;
              return /\d/.test(char) ? (
                <RollingDigit
                  key={key}
                  digit={Number(char)}
                  lineHeight={lineHeight}
                  textProps={digitProps}
                  color={textProps.color}
                  animateOnMount={false}
                  duration={400}
                />
              ) : (
                <SizableText
                  key={key}
                  {...digitProps}
                  lineHeight={lineHeight}
                  height={lineHeight}
                  color={textProps.color}
                >
                  {char}
                </SizableText>
              );
            }),
          )}
        </XStack>
      </Stack>
    </Stack>
  );
}
