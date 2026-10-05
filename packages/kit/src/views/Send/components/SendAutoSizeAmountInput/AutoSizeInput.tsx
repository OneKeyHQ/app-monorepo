import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { Input, SizableText, XStack } from '@onekeyhq/components';
import { webFontFamily } from '@onekeyhq/components/src/utils/webFontFamily';
import { SendTestIDs } from '@onekeyhq/kit/src/views/Send/testIDs';

import type {
  IAutoSizeInputProps,
  IAutoSizeInputRef,
} from './AutoSizeInput.types';
import type { TextInput } from 'react-native';

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

const INLINE_WIDTH_SAFETY_PX = 8;

// containerProps.minWidth beats width and maxWidth in CSS, so the box never
// renders narrower than this. Budgeting without the floor under-counts a
// narrow amount and lets the suffix symbol overflow (OK-63548).
const getInlineAmountBoxWidthPx = (
  measuredAmountWidthPx: number,
  fontSize: number,
) =>
  Math.max(
    Math.ceil(measuredAmountWidthPx + Math.max(18, Math.round(fontSize * 0.5))),
    Math.ceil(fontSize * 1.2),
  );

function getInlineContentWidthPx({
  text,
  fontSize,
  currencyLabel,
  inlineTokenSymbol,
  inlinePrefixGapPx,
  inlineSuffixGapPx,
  measurementRevision,
}: {
  text: string;
  fontSize: number;
  currencyLabel?: string;
  inlineTokenSymbol?: string;
  inlinePrefixGapPx: number;
  inlineSuffixGapPx: number;
  measurementRevision: number;
}) {
  const amountWidthPx = getInlineAmountBoxWidthPx(
    measureInlineTextWidthPx(text, fontSize, 500, measurementRevision),
    fontSize,
  );
  const prefixWidthPx = currencyLabel
    ? Math.ceil(
        measureInlineTextWidthPx(
          currencyLabel,
          fontSize,
          500,
          measurementRevision,
        ),
      )
    : 0;
  const suffixWidthPx = inlineTokenSymbol
    ? Math.ceil(
        measureInlineTextWidthPx(
          inlineTokenSymbol,
          fontSize,
          500,
          measurementRevision,
        ),
      )
    : 0;

  return (
    amountWidthPx +
    prefixWidthPx +
    suffixWidthPx +
    (currencyLabel ? inlinePrefixGapPx : 0) +
    (inlineTokenSymbol ? inlineSuffixGapPx : 0) +
    Math.max(8, Math.round(fontSize * 0.16)) +
    INLINE_WIDTH_SAFETY_PX
  );
}

function getFittedInlineFontSize({
  text,
  fontSize,
  minFontSize,
  availableInlineWidth,
  currencyLabel,
  inlineTokenSymbol,
  inlinePrefixGapPx,
  inlineSuffixGapPx,
  measurementRevision,
}: {
  text: string;
  fontSize: number;
  minFontSize: number;
  availableInlineWidth: number;
  currencyLabel?: string;
  inlineTokenSymbol?: string;
  inlinePrefixGapPx: number;
  inlineSuffixGapPx: number;
  measurementRevision: number;
}) {
  if (availableInlineWidth <= 0) {
    return fontSize;
  }

  const minimumFontSize = Math.max(12, Math.min(fontSize, minFontSize));
  let nextFontSize = fontSize;
  while (nextFontSize > minimumFontSize) {
    const contentWidthPx = getInlineContentWidthPx({
      text,
      fontSize: nextFontSize,
      currencyLabel,
      inlineTokenSymbol,
      inlinePrefixGapPx,
      inlineSuffixGapPx,
      measurementRevision,
    });
    if (contentWidthPx <= availableInlineWidth) {
      return nextFontSize;
    }
    nextFontSize -= 1;
  }

  return minimumFontSize;
}

export const AutoSizeInput = forwardRef<IAutoSizeInputRef, IAutoSizeInputProps>(
  (
    {
      value,
      fontSize,
      minFontSize,
      availableInlineWidth,
      isInlineWidthMeasured = true,
      inlineTextAlignMode = 'auto',
      currencyLabel,
      inlineTokenSymbol,
      inlinePrefixGapPx,
      inlineSuffixGapPx,
      fontFamily,
      selectionColor,
      onChangeText,
      placeholder,
      editable,
      keyboardType,
      onFocus,
      onBlur,
      placeholderColor,
      ..._nativeOnlyProps
    }: IAutoSizeInputProps,
    ref,
  ) => {
    const inputRef = useRef<TextInput>(null);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          inputRef.current?.focus();
        },
        blur: () => {
          inputRef.current?.blur();
        },
      }),
      [],
    );

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

    const inlineMeasureText = value || placeholder || '0';
    const effectiveFontSize = getFittedInlineFontSize({
      text: inlineMeasureText,
      fontSize,
      minFontSize,
      availableInlineWidth,
      currencyLabel,
      inlineTokenSymbol,
      inlinePrefixGapPx,
      inlineSuffixGapPx,
      measurementRevision: webFontMeasureVersion,
    });
    const inlineMeasuredAmountWidthPx = measureInlineTextWidthPx(
      inlineMeasureText,
      effectiveFontSize,
      500,
      webFontMeasureVersion,
    );
    const inlineInputBufferPx = Math.max(
      18,
      Math.round(effectiveFontSize * 0.5),
    );
    const inlineAmountTextWidthPx = Math.ceil(
      inlineMeasuredAmountWidthPx + inlineInputBufferPx,
    );
    const inlinePrefixTextWidthPx = currencyLabel
      ? Math.ceil(
          measureInlineTextWidthPx(
            currencyLabel,
            effectiveFontSize,
            500,
            webFontMeasureVersion,
          ),
        )
      : 0;
    const inlineSuffixTextWidthPx = inlineTokenSymbol
      ? Math.ceil(
          measureInlineTextWidthPx(
            inlineTokenSymbol,
            effectiveFontSize,
            500,
            webFontMeasureVersion,
          ),
        )
      : 0;
    // Same floor as containerProps.minWidth below: min-width beats width in
    // CSS, so the trailing-space math must use the width the box renders at.
    const inlineInputMinWidthPx = Math.ceil(effectiveFontSize * 1.2);
    const inlineInputWidthPx = getInlineAmountBoxWidthPx(
      inlineMeasuredAmountWidthPx,
      effectiveFontSize,
    );
    const inlineInputSlackPx = Math.max(
      inlineInputWidthPx - inlineAmountTextWidthPx,
      0,
    );
    const desktopInlineReservedWidthPx =
      inlinePrefixTextWidthPx +
      inlineSuffixTextWidthPx +
      (currencyLabel ? inlinePrefixGapPx : 0) +
      (inlineTokenSymbol ? inlineSuffixGapPx : 0) +
      Math.max(8, Math.round(effectiveFontSize * 0.16));
    const inlineInputMaxWidth =
      inlineTokenSymbol || currencyLabel
        ? `calc(100% - ${desktopInlineReservedWidthPx}px)`
        : '100%';
    const desktopPrefixOffset = Math.max(
      2,
      Math.round(effectiveFontSize * 0.05),
    );
    const desktopInlineSymbolOffset = Math.max(
      2,
      Math.round(effectiveFontSize * 0.04),
    );
    const hasPrefix = !!currencyLabel;
    const hasSuffix = !!inlineTokenSymbol;
    // Keep the caret on the left of the placeholder in both token and fiat
    // mode (OK-63413): a right-aligned suffix layout parked the empty-state
    // caret after the "0" while the fiat prefix layout parked it before.
    const desktopAmountTextAlign: 'center' | 'left' =
      hasPrefix || hasSuffix ? 'left' : 'center';

    // The input box keeps a trailing caret/measurement buffer after the
    // digits. With the amount left-aligned that buffer would sit between the
    // digits and the suffix symbol, so pull the suffix back over it to keep
    // the visual gap at inlineSuffixGapPx. Skip this when maxWidth shrinks the
    // input below its natural width: the digits then scroll inside the box and
    // a negative margin would overlap them.
    const inlineInputTrailingSpacePx = Math.max(
      inlineInputWidthPx - Math.ceil(inlineMeasuredAmountWidthPx),
      0,
    );
    // Until the container is measured, availableInlineWidth is only the
    // window width, so treat the box as possibly clamped by maxWidth.
    const isInlineInputShrunk =
      !isInlineWidthMeasured ||
      (availableInlineWidth > 0 &&
        inlineInputWidthPx >
          availableInlineWidth - desktopInlineReservedWidthPx);
    const desktopSuffixMarginLeftPx =
      hasSuffix && !isInlineInputShrunk
        ? inlineSuffixGapPx - inlineInputTrailingSpacePx
        : inlineSuffixGapPx;

    let desktopInlineRowOffsetPx = 0;
    if (inlineTextAlignMode === 'center' || hasSuffix) {
      // Suffix mode already folds the trailing buffer into the suffix margin,
      // so the row's box matches its visible content and centers as-is.
      desktopInlineRowOffsetPx = 0;
    } else if (desktopAmountTextAlign === 'left') {
      desktopInlineRowOffsetPx = Math.round(inlineInputSlackPx / 2);
    }

    const hasSmallWidth =
      availableInlineWidth > 0 &&
      availableInlineWidth < Math.ceil(effectiveFontSize);

    return (
      <XStack
        width="100%"
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
        style={
          desktopInlineRowOffsetPx && !hasSmallWidth
            ? { transform: [{ translateX: desktopInlineRowOffsetPx }] }
            : undefined
        }
      >
        {currencyLabel ? (
          <SizableText
            color="$text"
            fontWeight="500"
            lineHeight={Math.ceil(effectiveFontSize * 1.4)}
            style={{
              fontFamily,
              fontSize: effectiveFontSize,
              marginRight: inlinePrefixGapPx,
            }}
            mt={desktopPrefixOffset}
          >
            {currencyLabel}
          </SizableText>
        ) : null}
        <Input
          testID={SendTestIDs.amountInput}
          ref={inputRef}
          keyboardType={keyboardType ?? 'decimal-pad'}
          editable={editable}
          fontSize={effectiveFontSize}
          fontWeight="500"
          fontFamily={fontFamily}
          color="$text"
          unstyled
          borderWidth={0}
          bg="transparent"
          p="$0"
          px="$0"
          pl="$0"
          pr="$0"
          h={Math.ceil(effectiveFontSize * 1.4)}
          size="large"
          focusVisibleStyle={undefined}
          placeholder={placeholder ?? '0'}
          placeholderTextColor={placeholderColor ?? '$textDisabled'}
          value={value}
          onChangeText={onChangeText}
          textAlign={desktopAmountTextAlign}
          containerProps={{
            width: inlineInputWidthPx,
            flexShrink: 1,
            minWidth: inlineInputMinWidthPx,
            maxWidth: inlineInputMaxWidth,
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
        {inlineTokenSymbol ? (
          <SizableText
            color="$text"
            fontWeight="500"
            lineHeight={Math.ceil(effectiveFontSize * 1.4)}
            style={{
              fontFamily,
              fontSize: effectiveFontSize,
              marginLeft: desktopSuffixMarginLeftPx,
            }}
            mt={desktopInlineSymbolOffset}
            numberOfLines={1}
          >
            {inlineTokenSymbol}
          </SizableText>
        ) : null}
      </XStack>
    );
  },
);

AutoSizeInput.displayName = 'AutoSizeInput';
