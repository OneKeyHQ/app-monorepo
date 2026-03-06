import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useWindowDimensions } from 'react-native';

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
import { webFontFamily } from '@onekeyhq/components/src/utils/webFontFamily';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { NUMBER_FORMATTER } from '@onekeyhq/shared/src/utils/numberUtils';

import { AutoSizeInput } from './AutoSizeInput';

import type { LayoutChangeEvent, TextInput } from 'react-native';

const INLINE_SYMBOL_MAX_LENGTH = 12;
const WRAPPED_SYMBOL_CHUNK_LENGTH = 12;
const WRAPPED_SYMBOL_FONT_SCALE = 0.5;
const WRAPPED_SYMBOL_MIN_FONT_SIZE = 14;
const WRAPPED_SYMBOL_MAX_FONT_SIZE = 24;

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

const formatWrappedTokenSymbol = (symbol: string): string => {
  if (symbol.includes(' ')) {
    return symbol;
  }
  const chunks = symbol.match(
    new RegExp(`.{1,${WRAPPED_SYMBOL_CHUNK_LENGTH}}`, 'g'),
  );
  return chunks?.join('\n') ?? symbol;
};

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

const sanitizeAmountInputText = (text: string): string => {
  let sanitizedText = text.replace(/[。,，,]/g, '.');
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
    value,
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
  const selectionColor = theme.bgPrimaryActive.val;
  const transparentColor = theme.transparent.val;
  const inputTextColor = theme.text.val;
  const placeholderColor = theme.textDisabled.val;
  const autoSizeSelectionColor = normalizeAutoSizeNativeColor(selectionColor);
  const autoSizeTransparentColor =
    normalizeAutoSizeNativeColor(transparentColor);
  const autoSizeInputTextColor = normalizeAutoSizeNativeColor(inputTextColor);
  const autoSizePlaceholderColor =
    normalizeAutoSizeNativeColor(placeholderColor);

  const [webFontMeasureVersion, setWebFontMeasureVersion] = useState(0);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const autoSizeInputRef = useRef<{ focus?: () => void } | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const rootOnLayout = onLayout as
    | ((event: LayoutChangeEvent) => void)
    | undefined;

  useEffect(() => {
    if (platformEnv.isNative || typeof document === 'undefined') {
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

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (platformEnv.isNative) {
        autoSizeInputRef.current?.focus?.();
        return;
      }
      inputRef.current?.focus();
    },
    focusPercentageButton: () => {},
  }));

  const handleSimpleChangeText = useCallback(
    (text: string) => {
      onChange?.(sanitizeAmountInputText(text));
    },
    [onChange],
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

  const displayValue = value ?? '';
  const normalizedTokenSymbol = useMemo(
    () => normalizeTokenSymbol(tokenSymbol),
    [tokenSymbol],
  );
  const shouldWrapTokenSymbol =
    (normalizedTokenSymbol?.length ?? 0) > INLINE_SYMBOL_MAX_LENGTH;
  const inlineTokenSymbol = shouldWrapTokenSymbol
    ? undefined
    : normalizedTokenSymbol;
  const wrappedTokenSymbol = useMemo(() => {
    if (!shouldWrapTokenSymbol || !normalizedTokenSymbol) {
      return undefined;
    }
    return formatWrappedTokenSymbol(normalizedTokenSymbol);
  }, [normalizedTokenSymbol, shouldWrapTokenSymbol]);

  const { leftAddOnProps: simpleLeftAddOn, ...simpleInputProps } =
    inputProps ?? {};
  const currencyLabel = simpleLeftAddOn?.label as string | undefined;
  const simpleFontSize = getAmountFontSize(
    displayValue?.length || 0,
    fontSizeScale,
  );
  const availableInlineWidth = Math.max(
    Math.floor(layoutWidth || windowWidth || 0),
    0,
  );
  const isCompactInlineWidth =
    !md && availableInlineWidth > 0 && availableInlineWidth < 360;
  const simpleMaxFontSize = Math.round(56 * fontSizeScale);
  const simpleMinFontSize = Math.round(
    (isCompactInlineWidth ? 12 : 14) * fontSizeScale,
  );
  const wrappedSymbolFontSize = Math.max(
    WRAPPED_SYMBOL_MIN_FONT_SIZE,
    Math.min(
      Math.round(simpleFontSize * WRAPPED_SYMBOL_FONT_SCALE),
      WRAPPED_SYMBOL_MAX_FONT_SIZE,
    ),
  );
  const inlinePrefixGapPx = Math.max(1, Math.round(simpleFontSize * 0.02));
  const inlineSuffixGapPx = Math.max(6, Math.round(simpleFontSize * 0.1));
  let autoSizeTextValue = displayValue;
  if (displayValue === '') {
    autoSizeTextValue = platformEnv.isNativeIOS ? '0' : '';
  }
  const inlineMeasureText =
    displayValue || simpleInputProps?.placeholder || '0';
  const inlineMeasuredAmountWidthPx = measureInlineTextWidthPx(
    inlineMeasureText,
    simpleFontSize,
    500,
    webFontMeasureVersion,
  );
  const inlineInputBufferPx = Math.max(18, Math.round(simpleFontSize * 0.5));
  const inlineAmountTextWidthPx = Math.ceil(
    inlineMeasuredAmountWidthPx + inlineInputBufferPx,
  );
  const inlinePrefixTextWidthPx = currencyLabel
    ? Math.ceil(
        measureInlineTextWidthPx(
          currencyLabel,
          simpleFontSize,
          500,
          webFontMeasureVersion,
        ),
      )
    : 0;
  const inlineSuffixTextWidthPx = inlineTokenSymbol
    ? Math.ceil(
        measureInlineTextWidthPx(
          inlineTokenSymbol,
          simpleFontSize,
          500,
          webFontMeasureVersion,
        ),
      )
    : 0;
  const autoSizePreferredWidth = Math.ceil(
    inlineAmountTextWidthPx +
      inlinePrefixTextWidthPx +
      inlineSuffixTextWidthPx +
      (currencyLabel ? inlinePrefixGapPx : 0) +
      (inlineTokenSymbol ? inlineSuffixGapPx : 0) +
      simpleFontSize * 0.18,
  );
  const autoSizeContainerMinWidth = Math.ceil(simpleMaxFontSize * 1.2);
  const defaultAutoSizeContainerMaxWidth = md ? 720 : 320;
  const autoSizeAvailableWidth =
    availableInlineWidth > 0
      ? Math.max(availableInlineWidth - (md ? 0 : 8), 0)
      : defaultAutoSizeContainerMaxWidth;
  const autoSizeContainerWidth = Math.min(
    Math.max(autoSizePreferredWidth, autoSizeContainerMinWidth),
    autoSizeAvailableWidth,
    defaultAutoSizeContainerMaxWidth,
  );
  const inlineInputWidthPx = Math.max(
    inlineAmountTextWidthPx,
    Math.ceil(simpleFontSize * 1.05),
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
    Math.max(8, Math.round(simpleFontSize * 0.16));
  const inlineInputMaxWidth =
    inlineTokenSymbol || currencyLabel
      ? `calc(100% - ${desktopInlineReservedWidthPx}px)`
      : '100%';
  const desktopPrefixOffset = Math.max(2, Math.round(simpleFontSize * 0.05));
  const desktopInlineSymbolOffset = Math.max(
    2,
    Math.round(simpleFontSize * 0.04),
  );
  const shouldCenterDesktopAmountText =
    !!wrappedTokenSymbol || (!currencyLabel && !inlineTokenSymbol);
  const desktopAmountTextAlign: 'center' | 'right' =
    shouldCenterDesktopAmountText ? 'center' : 'right';
  const desktopInlineRowOffsetPx =
    desktopAmountTextAlign === 'right'
      ? Math.round(-inlineInputSlackPx / 2)
      : 0;

  const amountInputNode = simpleInputProps?.loading ? (
    <Stack py="$4">
      <Skeleton h="$12" w="$40" />
    </Stack>
  ) : (
    <AutoSizeInput
      displayValue={displayValue}
      simpleFontSize={simpleFontSize}
      currencyLabel={currencyLabel}
      inlineTokenSymbol={inlineTokenSymbol}
      inlinePrefixGapPx={inlinePrefixGapPx}
      inlineSuffixGapPx={inlineSuffixGapPx}
      desktopAmountTextAlign={desktopAmountTextAlign}
      desktopInlineRowOffsetPx={desktopInlineRowOffsetPx}
      desktopPrefixOffset={desktopPrefixOffset}
      desktopInlineSymbolOffset={desktopInlineSymbolOffset}
      inlineInputWidthPx={inlineInputWidthPx}
      inlineInputMaxWidth={inlineInputMaxWidth}
      selectionColor={selectionColor}
      handleSimpleChangeText={handleSimpleChangeText}
      simpleInputProps={simpleInputProps}
      inputRef={inputRef}
      autoSizeContainerWidth={autoSizeContainerWidth}
      simpleMaxFontSize={simpleMaxFontSize}
      simpleMinFontSize={simpleMinFontSize}
      autoSizeTextValue={autoSizeTextValue}
      autoSizeInputTextColor={autoSizeInputTextColor}
      autoSizePlaceholderColor={autoSizePlaceholderColor}
      autoSizeSelectionColor={autoSizeSelectionColor}
      autoSizeTransparentColor={autoSizeTransparentColor}
      onHybridRef={(hybridViewRef) => {
        autoSizeInputRef.current = hybridViewRef;
      }}
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
          maxWidth={md ? '84%' : '92%'}
          mt="$1"
          lineHeight={Math.ceil(wrappedSymbolFontSize * 1.2)}
          style={{ fontSize: wrappedSymbolFontSize }}
        >
          {wrappedTokenSymbol}
        </SizableText>
      ) : null}
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
      {extraContent}
    </Stack>
  );
}

export const SendAutoSizeAmountInput = forwardRef(
  SendAutoSizeAmountInputComponent,
);
