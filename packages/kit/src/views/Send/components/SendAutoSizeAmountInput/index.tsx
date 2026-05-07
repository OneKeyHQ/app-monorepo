import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { type LayoutChangeEvent, useWindowDimensions } from 'react-native';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import type { IInputProps, IStackProps } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { NUMBER_FORMATTER } from '@onekeyhq/shared/src/utils/numberUtils';

import { AutoSizeInput } from './AutoSizeInput';

import type { IAutoSizeInputRef } from './AutoSizeInput.types';

const INLINE_SYMBOL_MAX_LENGTH = 8;
const WRAPPED_SYMBOL_FONT_SCALE = 0.5;
const WRAPPED_SYMBOL_MIN_FONT_SIZE = 14;
const WRAPPED_SYMBOL_MAX_FONT_SIZE = 24;
const WRAPPED_SYMBOL_HORIZONTAL_PADDING_PX = 16;
const WRAPPED_SYMBOL_BREAK_CHARS = new Set([' ', '-', '_', '/', '.']);
// iOS-only hidden marker used to force a native prop delta without visible UI change.
const IOS_FORCE_WRITE_BACK_MARKER = '\u200B';

const stripIOSForceWriteBackMarker = (text: string) =>
  text.replace(/\u200B/g, '');

const makeIOSForceWriteBackPulseText = (text: string) =>
  `${text}${IOS_FORCE_WRITE_BACK_MARKER}`;

const getAmountFontSize = (length: number, scale = 1): number => {
  let size: number;
  if (length <= 4) size = 56;
  else if (length <= 7) size = 48;
  else if (length <= 10) size = 40;
  else if (length <= 14) size = 32;
  else if (length <= 18) size = 26;
  else if (length <= 22) size = 22;
  else if (length <= 28) size = 18;
  else size = 14;
  return Math.round(size * scale);
};

const normalizeTokenSymbol = (symbol?: string): string | undefined => {
  if (!symbol) {
    return undefined;
  }
  const normalizedSymbol = symbol.replace(/\s+/g, ' ').trim();
  if (!normalizedSymbol) {
    return undefined;
  }
  return normalizedSymbol;
};

const estimateTextWidthPx = (text: string, fontSize: number) => {
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

const formatWrappedTokenSymbol = ({
  symbol,
  fontSize,
  maxWidthPx,
}: {
  symbol: string;
  fontSize: number;
  maxWidthPx: number;
}): string => {
  if (maxWidthPx <= 0 || estimateTextWidthPx(symbol, fontSize) <= maxWidthPx) {
    return symbol;
  }

  const lines: string[] = [];
  let remaining = symbol;

  while (remaining) {
    let fittingIndex = 0;
    let preferredBreakIndex = 0;

    for (let i = 0; i < remaining.length; i += 1) {
      const nextText = remaining.slice(0, i + 1);
      if (estimateTextWidthPx(nextText, fontSize) > maxWidthPx) {
        break;
      }

      fittingIndex = i + 1;
      if (WRAPPED_SYMBOL_BREAK_CHARS.has(remaining[i])) {
        preferredBreakIndex = i + 1;
      }
    }

    if (fittingIndex <= 0) {
      lines.push(remaining[0]);
      remaining = remaining.slice(1).trimStart();
    } else {
      const breakIndex =
        preferredBreakIndex > 0 ? preferredBreakIndex : fittingIndex;
      lines.push(remaining.slice(0, breakIndex).trim());
      remaining = remaining.slice(breakIndex).trimStart();
    }
  }

  return lines.join('\n');
};

const sanitizeAmountInputText = (text: string): string => {
  let sanitizedText = text.replace(/\s/g, '').replace(/[。,，,]/g, '.');

  // Auto-prepend "0" for ".5" style input.
  if (sanitizedText.startsWith('.')) {
    sanitizedText = `0${sanitizedText}`;
  }

  // Keep "0" / "0.xxx", trim redundant leading zeros like "0012" -> "12".
  if (sanitizedText.length > 1 && sanitizedText.startsWith('0')) {
    if (!sanitizedText.startsWith('0.')) {
      sanitizedText = sanitizedText.replace(/^0+/, '') || '0';
      if (sanitizedText.startsWith('.')) {
        sanitizedText = `0${sanitizedText}`;
      }
    }
  }

  // Keep only digits and decimal separator.
  sanitizedText = sanitizedText.replace(/[^\d.]/g, '');

  // Keep only the first decimal separator.
  const firstDecimalIndex = sanitizedText.indexOf('.');
  if (firstDecimalIndex !== -1) {
    const integerPart = sanitizedText.slice(0, firstDecimalIndex + 1);
    const decimalPart = sanitizedText
      .slice(firstDecimalIndex + 1)
      .replace(/\./g, '');
    sanitizedText = `${integerPart}${decimalPart}`;
  }

  return sanitizedText;
};

const normalizeAutoSizeNativeColor = (color?: string): string | undefined => {
  if (!color || !platformEnv.isNativeAndroid) {
    return color;
  }

  const match = color.match(/^#([0-9a-fA-F]{8})$/);
  if (!match) {
    return color;
  }

  const hex = match[1];
  const rrggbb = hex.slice(0, 6);
  const aa = hex.slice(6, 8);

  return `#${aa}${rrggbb}`;
};

export type ISendAmountAutoSizeInputRef = {
  focus: () => void;
  focusPercentageButton: (percent: 25 | 50 | 75 | 100) => void;
};

type ISendAmountAutoSizeInputProps = {
  value?: string;
  onChange?: (value: string) => void;
  reversible?: boolean;
  tokenSymbol?: string;
  inputProps?: Omit<IInputProps, 'value' | 'onChangeText' | 'onChange'> & {
    loading?: boolean;
  };
  valueProps?: {
    value?: string;
    color?: string;
    onPress?: () => void;
    loading?: boolean;
    currency?: string;
    tokenSymbol?: string;
    formatter?: keyof typeof NUMBER_FORMATTER;
    moreComponent?: React.ReactNode;
  };
  extraContent?: React.ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
} & IStackProps;

function SendAutoSizeAmountInputComponent(
  {
    inputProps,
    reversible,
    onChange,
    value: controlledValue,
    valueProps,
    tokenSymbol,
    extraContent,
    onLayout,
    ...rest
  }: ISendAmountAutoSizeInputProps,
  ref: React.Ref<ISendAmountAutoSizeInputRef>,
) {
  const { md } = useMedia();
  const theme = useTheme();
  const fontSizeScale = md ? 1.2 : 1.5;
  const selectionColor =
    normalizeAutoSizeNativeColor(theme.bgPrimaryActive.val) ??
    theme.bgPrimaryActive.val;
  const backgroundColor = normalizeAutoSizeNativeColor(theme.transparent.val);
  const textColor = normalizeAutoSizeNativeColor(theme.text.val);
  const placeholderColor = normalizeAutoSizeNativeColor(theme.textDisabled.val);

  const [layoutWidth, setLayoutWidth] = useState(0);
  const autoSizeInputRef = useRef<IAutoSizeInputRef | null>(null);
  const [forcedNativeText, setForcedNativeText] = useState<string | null>(null);
  const forceWriteBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const { width: windowWidth } = useWindowDimensions();
  const rootOnLayout = onLayout as
    | ((event: LayoutChangeEvent) => void)
    | undefined;

  useImperativeHandle(ref, () => ({
    focus: () => {
      autoSizeInputRef.current?.focus?.();
    },
    focusPercentageButton: () => {},
  }));

  const inputValue = controlledValue ?? '';

  const clearForceWriteBackTimer = useCallback(() => {
    if (forceWriteBackTimerRef.current) {
      clearTimeout(forceWriteBackTimerRef.current);
      forceWriteBackTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearForceWriteBackTimer(), [clearForceWriteBackTimer]);

  useEffect(() => {
    if (!platformEnv.isNativeIOS) {
      return;
    }
    // Parent controlled value updated, drop local one-shot override.
    setForcedNativeText((prev) => {
      if (prev === null) {
        return prev;
      }
      const normalizedPrev = stripIOSForceWriteBackMarker(prev);
      return normalizedPrev === inputValue ? null : prev;
    });
  }, [inputValue]);

  const handleChangeText = useCallback(
    (text: string) => {
      const sanitizedText = sanitizeAmountInputText(text);
      onChange?.(sanitizedText);

      // iOS native input can keep stale text when parent value does not change.
      // Force a pulse write-back so native receives a prop change every time.
      if (platformEnv.isNativeIOS && sanitizedText !== text) {
        clearForceWriteBackTimer();
        const pulseText = makeIOSForceWriteBackPulseText(sanitizedText);
        setForcedNativeText(pulseText);
        forceWriteBackTimerRef.current = setTimeout(() => {
          setForcedNativeText(sanitizedText);
          forceWriteBackTimerRef.current = null;
        }, 0);
      } else {
        clearForceWriteBackTimer();
        setForcedNativeText((prev) => (prev === null ? prev : null));
      }
    },
    [clearForceWriteBackTimer, onChange],
  );

  const handleInputLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextWidth = Math.round(event.nativeEvent.layout.width);
      if (nextWidth > 0) {
        setLayoutWidth((prev) => (prev === nextWidth ? prev : nextWidth));
      }
      rootOnLayout?.(event as never);
    },
    [rootOnLayout],
  );

  // Android keeps using the controlled value directly; pulse write-back is iOS-only.
  const effectiveValueRaw = platformEnv.isNativeIOS
    ? (forcedNativeText ?? inputValue)
    : inputValue;
  const effectiveValue = platformEnv.isNativeIOS
    ? stripIOSForceWriteBackMarker(effectiveValueRaw)
    : effectiveValueRaw;
  const normalizedTokenSymbol = useMemo(
    () => normalizeTokenSymbol(tokenSymbol),
    [tokenSymbol],
  );
  const shouldWrapTokenSymbol =
    (normalizedTokenSymbol?.length ?? 0) > INLINE_SYMBOL_MAX_LENGTH;
  const inlineTokenSymbol = shouldWrapTokenSymbol
    ? undefined
    : normalizedTokenSymbol;

  const currencyLabel = inputProps?.leftAddOnProps?.label as string | undefined;
  const isLoading = inputProps?.loading;
  const placeholder = inputProps?.placeholder ?? '0';
  const editable = inputProps?.editable ?? true;
  const keyboardType = inputProps?.keyboardType ?? 'decimal-pad';
  const returnKeyType = inputProps?.returnKeyType;
  const onFocus = inputProps?.onFocus;
  const onBlur = inputProps?.onBlur;
  const fontSize = getAmountFontSize(
    effectiveValue?.length || 0,
    fontSizeScale,
  );
  const availableInlineWidth = Math.max(
    Math.floor(layoutWidth || windowWidth || 0),
    0,
  );
  const isCompactInlineWidth =
    md && availableInlineWidth > 0 && availableInlineWidth < 360;
  const maxFontSize = Math.round(56 * fontSizeScale);
  const minFontSize = Math.round(
    (isCompactInlineWidth ? 12 : 14) * fontSizeScale,
  );
  const wrappedSymbolFontSize = Math.max(
    WRAPPED_SYMBOL_MIN_FONT_SIZE,
    Math.min(
      Math.round(fontSize * WRAPPED_SYMBOL_FONT_SCALE),
      WRAPPED_SYMBOL_MAX_FONT_SIZE,
    ),
  );
  const wrappedTokenSymbolMaxWidthPx =
    availableInlineWidth > 0
      ? Math.max(availableInlineWidth - WRAPPED_SYMBOL_HORIZONTAL_PADDING_PX, 0)
      : 0;
  const wrappedTokenSymbol = useMemo(() => {
    if (!shouldWrapTokenSymbol || !normalizedTokenSymbol) {
      return undefined;
    }
    return formatWrappedTokenSymbol({
      symbol: normalizedTokenSymbol,
      fontSize: wrappedSymbolFontSize,
      maxWidthPx: wrappedTokenSymbolMaxWidthPx,
    });
  }, [
    normalizedTokenSymbol,
    shouldWrapTokenSymbol,
    wrappedSymbolFontSize,
    wrappedTokenSymbolMaxWidthPx,
  ]);
  const inlinePrefixGapPx = 0;
  const inlineSuffixGapPx = Math.max(
    4,
    Math.ceil(estimateTextWidthPx(' ', fontSize)),
  );
  // Keep one unified value prop for web/native.
  // iOS native needs "0" when empty to keep caret behavior stable.
  let autoSizeValue = effectiveValueRaw;
  if (effectiveValue === '') {
    autoSizeValue = platformEnv.isNativeIOS ? '0' : '';
  }

  const amountInputNode = isLoading ? (
    <Stack py="$4">
      <Skeleton h="$12" w="$40" />
    </Stack>
  ) : (
    <AutoSizeInput
      ref={autoSizeInputRef}
      value={autoSizeValue}
      fontSize={fontSize}
      maxFontSize={maxFontSize}
      minFontSize={minFontSize}
      availableInlineWidth={availableInlineWidth}
      currencyLabel={currencyLabel}
      inlineTokenSymbol={inlineTokenSymbol}
      inlinePrefixGapPx={inlinePrefixGapPx}
      inlineSuffixGapPx={inlineSuffixGapPx}
      selectionColor={selectionColor}
      onChangeText={handleChangeText}
      placeholder={placeholder}
      editable={editable}
      keyboardType={keyboardType}
      returnKeyType={returnKeyType}
      onFocus={onFocus}
      onBlur={onBlur}
      textColor={textColor}
      placeholderColor={placeholderColor}
      backgroundColor={backgroundColor}
    />
  );

  return (
    <Stack
      alignItems="center"
      width="100%"
      {...rest}
      onLayout={handleInputLayout}
    >
      {amountInputNode}
      {wrappedTokenSymbol ? (
        <SizableText
          color="$text"
          fontWeight="500"
          textAlign="center"
          alignSelf="center"
          maxWidth={wrappedTokenSymbolMaxWidthPx || (md ? '92%' : '96%')}
          mt="$1"
          lineHeight={Math.ceil(wrappedSymbolFontSize * 1.2)}
          style={{ fontSize: wrappedSymbolFontSize }}
        >
          {wrappedTokenSymbol}
        </SizableText>
      ) : null}
      {valueProps || reversible ? (
        <XStack
          alignItems="center"
          mt={md ? '$0' : '$2'}
          py="$1.5"
          px="$1"
          borderRadius="$2"
          alignSelf="center"
          disabled={valueProps?.loading}
          onPress={valueProps?.onPress}
          {...(reversible && {
            userSelect: 'none',
            hoverStyle: {
              bg: '$bgHover',
            },
            pressStyle: {
              bg: '$bgActive',
            },
          })}
        >
          {valueProps?.loading ? (
            <Skeleton h="$6" w="$28" />
          ) : (
            <>
              <NumberSizeableText
                formatter={valueProps?.formatter ?? 'value'}
                formatterOptions={{
                  currency: valueProps?.currency,
                  tokenSymbol: valueProps?.tokenSymbol,
                }}
                size="$headingLg"
                color={valueProps?.color ?? '$textSubdued'}
              >
                {valueProps?.value || '0.00'}
              </NumberSizeableText>
              {valueProps?.moreComponent}
              {reversible ? (
                <Icon
                  name="SwitchVerOutline"
                  size="$4"
                  color="$iconSubdued"
                  ml="$1.5"
                />
              ) : null}
            </>
          )}
        </XStack>
      ) : null}
      {extraContent}
    </Stack>
  );
}

export const SendAutoSizeAmountInput = forwardRef(
  SendAutoSizeAmountInputComponent,
);
