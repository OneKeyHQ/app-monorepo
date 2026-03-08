import { useEffect, useState } from 'react';

import { Input, SizableText, XStack } from '@onekeyhq/components';
import { webFontFamily } from '@onekeyhq/components/src/utils/webFontFamily';

import type { IAutoSizeInputProps } from './AutoSizeInput.types';

const estimateInlineTextWidthPx = (text: string, fontSize: number) => {
  let width = 0;
  for (const char of text) {
    if (/[0-9]/.test(char)) {
      width += fontSize * 0.58;
    } else if (/[A-Z]/.test(char)) {
      width += fontSize * 0.62;
    } else if (/[a-z]/.test(char)) {
      width += fontSize * 0.52;
    } else if (char === ' ') {
      width += fontSize * 0.28;
    } else if (['.', ',', ':', ';'].includes(char)) {
      width += fontSize * 0.24;
    } else if (['+', '-'].includes(char)) {
      width += fontSize * 0.34;
    } else if (['$', '€', '¥', '£', '₹', '₿', 'Ξ'].includes(char)) {
      width += fontSize * 0.44;
    } else if (['(', ')', '[', ']'].includes(char)) {
      width += fontSize * 0.36;
    } else {
      width += fontSize * 0.56;
    }
  }
  return width;
};

let webTextMeasureCanvas: HTMLCanvasElement | null = null;

const measureInlineTextWidthPx = (
  text: string,
  fontSize: number,
  fontWeight = 500,
  measurementRevision = 0,
) => {
  void measurementRevision;
  if (typeof document !== 'undefined') {
    webTextMeasureCanvas ??= document.createElement('canvas');
    const context = webTextMeasureCanvas.getContext('2d');
    if (context) {
      context.font = `${fontWeight} ${fontSize}px ${webFontFamily}`;
      const metrics = context.measureText(text);
      const visualWidth =
        metrics.actualBoundingBoxLeft !== undefined &&
        metrics.actualBoundingBoxRight !== undefined
          ? metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight
          : 0;
      return Math.ceil(Math.max(metrics.width, visualWidth));
    }
  }

  return estimateInlineTextWidthPx(text, fontSize);
};

export function AutoSizeInput({
  value,
  fontSize,
  availableWidth,
  prefix,
  suffix,
  prefixGap,
  suffixGap,
  selectionColor,
  onChangeText,
  placeholder,
  editable,
  keyboardType,
  onFocus,
  onBlur,
  inputRef,
  ..._nativeOnlyProps
}: IAutoSizeInputProps) {
  const [webFontMeasureVersion, setWebFontMeasureVersion] = useState(0);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const fontSet = document.fonts;
    if (!fontSet) {
      return undefined;
    }

    let isUnmounted = false;
    const refreshMeasurement = () => {
      if (!isUnmounted) {
        setWebFontMeasureVersion((prev) => prev + 1);
      }
    };

    void fontSet.ready.then(refreshMeasurement);
    fontSet.addEventListener?.('loadingdone', refreshMeasurement);
    fontSet.addEventListener?.('loadingerror', refreshMeasurement);

    return () => {
      isUnmounted = true;
      fontSet.removeEventListener?.('loadingdone', refreshMeasurement);
      fontSet.removeEventListener?.('loadingerror', refreshMeasurement);
    };
  }, []);

  // --- Layout calculations ---
  const measureText = value || placeholder || '0';
  const measuredAmountWidthPx = measureInlineTextWidthPx(
    measureText,
    fontSize,
    500,
    webFontMeasureVersion,
  );
  const inputBufferPx = Math.max(18, Math.round(fontSize * 0.5));
  const amountTextWidthPx = Math.ceil(measuredAmountWidthPx + inputBufferPx);
  const prefixTextWidthPx = prefix
    ? Math.ceil(
        measureInlineTextWidthPx(prefix, fontSize, 500, webFontMeasureVersion),
      )
    : 0;
  const suffixTextWidthPx = suffix
    ? Math.ceil(
        measureInlineTextWidthPx(suffix, fontSize, 500, webFontMeasureVersion),
      )
    : 0;
  const inputWidthPx = Math.max(amountTextWidthPx, Math.ceil(fontSize * 1.05));
  const inputSlackPx = Math.max(inputWidthPx - amountTextWidthPx, 0);
  const reservedWidthPx =
    prefixTextWidthPx +
    suffixTextWidthPx +
    (prefix ? prefixGap : 0) +
    (suffix ? suffixGap : 0) +
    Math.max(8, Math.round(fontSize * 0.16));
  const inputMaxWidth =
    suffix || prefix ? `calc(100% - ${reservedWidthPx}px)` : '100%';
  const prefixOffset = Math.max(2, Math.round(fontSize * 0.05));
  const suffixOffset = Math.max(2, Math.round(fontSize * 0.04));

  const hasPrefix = !!prefix;
  const hasSuffix = !!suffix;
  let textAlign: 'center' | 'left' | 'right' = 'center';
  if (hasPrefix) {
    textAlign = 'left';
  } else if (hasSuffix) {
    textAlign = 'right';
  }

  let rowOffsetPx = 0;
  if (textAlign === 'right') {
    rowOffsetPx = Math.round(-inputSlackPx / 2);
  } else if (textAlign === 'left') {
    rowOffsetPx = Math.round(inputSlackPx / 2);
  }

  const hasSmallWidth =
    availableWidth > 0 && availableWidth < Math.ceil(fontSize);

  return (
    <XStack
      width="100%"
      alignItems="center"
      justifyContent="center"
      style={
        rowOffsetPx && !hasSmallWidth
          ? { transform: [{ translateX: rowOffsetPx }] }
          : undefined
      }
    >
      {prefix ? (
        <SizableText
          color="$text"
          fontWeight="500"
          lineHeight={Math.ceil(fontSize * 1.4)}
          style={{
            fontSize,
            marginRight: prefixGap,
          }}
          mt={prefixOffset}
        >
          {prefix}
        </SizableText>
      ) : null}
      <Input
        ref={inputRef}
        keyboardType={keyboardType ?? 'decimal-pad'}
        editable={editable}
        fontSize={fontSize}
        fontWeight="500"
        color="$text"
        unstyled
        borderWidth={0}
        bg="transparent"
        p="$0"
        px="$0"
        pl="$0"
        pr="$0"
        h={Math.ceil(fontSize * 1.4)}
        size="large"
        focusVisibleStyle={undefined}
        placeholder={placeholder ?? '0'}
        placeholderTextColor="$textDisabled"
        value={value}
        onChangeText={onChangeText}
        textAlign={textAlign}
        containerProps={{
          width: inputWidthPx,
          flexShrink: 1,
          minWidth: Math.ceil(fontSize * 1.2),
          maxWidth: inputMaxWidth,
          borderWidth: 0,
          bg: 'transparent',
        }}
        selectionColor={selectionColor}
        cursorColor={selectionColor}
        caretColor={selectionColor}
        {...({
          onFocus: (event: { target: HTMLInputElement }) => {
            onFocus?.(event as never);
            if (value === '0') {
              const { target } = event;
              requestAnimationFrame(() => {
                target.setSelectionRange(1, 1);
              });
            }
          },
          onBlur: (event: { target: HTMLInputElement }) => {
            onBlur?.(event as never);
          },
          onClick: (e: { target: HTMLInputElement }) => {
            if (value === '0') {
              e.target.setSelectionRange(1, 1);
            }
          },
          onKeyUp: (e: { target: HTMLInputElement }) => {
            if (value === '0') {
              e.target.setSelectionRange(1, 1);
            }
          },
          onSelect: (e: { target: HTMLInputElement }) => {
            if (value === '0' && e.target.selectionStart !== 1) {
              e.target.setSelectionRange(1, 1);
            }
          },
        } as any)}
      />
      {suffix ? (
        <SizableText
          color="$text"
          fontWeight="500"
          lineHeight={Math.ceil(fontSize * 1.4)}
          style={{
            fontSize,
            marginLeft: suffixGap,
          }}
          mt={suffixOffset}
          numberOfLines={1}
        >
          {suffix}
        </SizableText>
      ) : null}
    </XStack>
  );
}
