import {
  forwardRef,
  useCallback,
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

  const [layoutWidth, setLayoutWidth] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const autoSizeInputRef = useRef<{ focus?: () => void } | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const rootOnLayout = onLayout as
    | ((event: LayoutChangeEvent) => void)
    | undefined;

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

  const currencyLabel = inputProps?.leftAddOnProps?.label as string | undefined;
  const inputLoading = inputProps?.loading;
  const inputPlaceholder = inputProps?.placeholder ?? '0';
  const inputEditable = inputProps?.editable ?? true;
  const inputKeyboardType = inputProps?.keyboardType ?? 'decimal-pad';
  const inputReturnKeyType = inputProps?.returnKeyType;
  const onInputFocus = inputProps?.onFocus;
  const onInputBlur = inputProps?.onBlur;
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

  const amountInputNode = inputLoading ? (
    <Stack py="$4">
      <Skeleton h="$12" w="$40" />
    </Stack>
  ) : (
    <AutoSizeInput
      displayValue={displayValue}
      simpleFontSize={simpleFontSize}
      simpleMaxFontSize={simpleMaxFontSize}
      simpleMinFontSize={simpleMinFontSize}
      availableInlineWidth={availableInlineWidth}
      currencyLabel={currencyLabel}
      inlineTokenSymbol={inlineTokenSymbol}
      inlinePrefixGapPx={inlinePrefixGapPx}
      inlineSuffixGapPx={inlineSuffixGapPx}
      selectionColor={selectionColor}
      handleSimpleChangeText={handleSimpleChangeText}
      inputLoading={inputLoading}
      inputPlaceholder={inputPlaceholder}
      inputEditable={inputEditable}
      inputKeyboardType={inputKeyboardType}
      inputReturnKeyType={inputReturnKeyType}
      onInputFocus={onInputFocus}
      onInputBlur={onInputBlur}
      inputRef={inputRef}
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
