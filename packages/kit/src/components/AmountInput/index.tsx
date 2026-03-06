import type { ComponentType, ReactElement } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import {
  type LayoutChangeEvent,
  type TextInput,
  useWindowDimensions,
} from 'react-native';

import {
  Icon,
  Image,
  Input,
  NumberSizeableText,
  Popover,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  getFontSize,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import type {
  IInputProps,
  IStackProps,
  IXStackProps,
} from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';
import type { IFormFieldProps } from '@onekeyhq/components/src/forms/types';
import { webFontFamily } from '@onekeyhq/components/src/utils/webFontFamily';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { NUMBER_FORMATTER } from '@onekeyhq/shared/src/utils/numberUtils';

import { LetterAvatar } from '../LetterAvatar';

import {
  AutoSizeInputNativeView,
  type IAutoSizeInputRef,
  wrapNitroCallback,
} from './AutoSizeNative';

// Helper function to calculate dynamic font size based on input length
// Shrinks font progressively to display full number without truncation
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

const INLINE_SYMBOL_MAX_LENGTH = 12;
const WRAPPED_SYMBOL_CHUNK_LENGTH = 12;
const WRAPPED_SYMBOL_FONT_SCALE = 0.5;
const WRAPPED_SYMBOL_MIN_FONT_SIZE = 14;
const WRAPPED_SYMBOL_MAX_FONT_SIZE = 24;

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
  // Keep natural word wrapping for spaced names; chunk only long continuous strings.
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

  if (sanitizedText === '') {
    return '0';
  }

  return sanitizedText;
};

const mapAutoSizeKeyboardType = (keyboardType?: string): string | undefined => {
  switch (keyboardType) {
    case 'decimal-pad':
      return 'decimalPad';
    case 'number-pad':
      return 'numberPad';
    case 'email-address':
      return 'emailAddress';
    case 'phone-pad':
      return 'phonePad';
    default:
      return keyboardType;
  }
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

export type ITokenSelectorPopoverProps = {
  title: string;
  content:
    | ReactElement
    | ComponentType<{ isOpen?: boolean; closePopover: () => void }>
    | null;
};

export type IAmountInputFormItemProps = IFormFieldProps<
  string,
  {
    inputProps?: Omit<IInputProps, 'value' | 'onChangeText' | 'onChange'> & {
      loading?: boolean;
    };
    enableMaxAmount?: boolean;
    maxAmountText?: string;
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
    balanceProps?: {
      value?: string;
      popoverContent?: React.ReactNode;
      popoverTitle?: string;
      onPress?: () => void;
      loading?: boolean;
      iconText?: string;
    };
    balanceHelperProps?: {
      onPress?: () => void;
    };
    tokenSelectorTriggerProps?: {
      selectedTokenImageUri?: string;
      selectedNetworkImageUri?: string;
      selectedTokenSymbol?: string;
      selectedNetworkName?: string;
      isCustomNetwork?: boolean;
      loading?: boolean;
      disabled?: boolean;
      popover?: ITokenSelectorPopoverProps;
    } & IXStackProps;
    reversible?: boolean;
    /**
     * Layout variant:
     * - 'default': Standard layout with border, token icon on right (used in Swap)
     * - 'simple': Borderless, symbol inline after amount, balance on top (used in Send)
     */
    variant?: 'default' | 'simple';
    /** Token symbol to display inline (only for 'simple' variant) */
    tokenSymbol?: string;
    /** Token image URI to display above amount (only for 'simple' variant) */
    tokenImageUri?: string;
    /** Network image URI to display as badge on token icon (only for 'simple' variant) */
    networkImageUri?: string;
    /** Callback for percentage button selection (only for 'simple' variant) */
    onPercentageSelect?: (percent: number) => void;
    /** Extra content rendered between balance and fiat value rows (only for 'simple' variant) */
    extraContent?: React.ReactNode;
    /** Additional content in the balance row, between symbol and Max button (only for 'simple' variant) */
    balanceInfoContent?: React.ReactNode;
  } & IStackProps
>;

export type IAmountInputRef = {
  focus: () => void;
  focusPercentageButton: (percent: 25 | 50 | 75 | 100) => void;
};

function AmountInputComponent(
  {
    inputProps,
    enableMaxAmount,
    maxAmountText,
    tokenSelectorTriggerProps,
    reversible,
    onChange,
    value,
    hasError,
    valueProps,
    balanceProps,
    balanceHelperProps,
    variant = 'default',
    tokenSymbol,
    tokenImageUri,
    networkImageUri,
    onPercentageSelect,
    extraContent,
    balanceInfoContent,
    ...rest
  }: IAmountInputFormItemProps,
  ref: React.Ref<IAmountInputRef>,
) {
  const intl = useIntl();
  const isSimpleVariant = variant === 'simple';
  const { md } = useMedia();
  const theme = useTheme();
  // Scale up font size on desktop modal breakpoint
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

  const sharedStyles = getSharedInputStyles({
    error: hasError,
  });
  const [selection, setSelection] = useState({ start: 1, end: 1 });
  const [webFontMeasureVersion, setWebFontMeasureVersion] = useState(0);
  const [simpleVariantLayoutWidth, setSimpleVariantLayoutWidth] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const autoSizeInputRef = useRef<IAutoSizeInputRef | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const rootOnLayout = rest.onLayout as
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

  // Expose focus method to parent component
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (platformEnv.isNative && isSimpleVariant) {
          autoSizeInputRef.current?.focus();
          return;
        }
        inputRef.current?.focus();
      },
      focusPercentageButton: () => {},
    }),
    [isSimpleVariant],
  );

  const handleChangeText = useCallback(
    (text: string) => {
      onChange?.(sanitizeAmountInputText(text));
    },
    [onChange],
  );

  // For simple variant: handle input changes
  const handleSimpleChangeText = useCallback(
    (text: string) => {
      onChange?.(sanitizeAmountInputText(text));
    },
    [onChange],
  );
  const handleAmountInputLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextWidth = Math.round(event.nativeEvent.layout.width);
      if (nextWidth > 0) {
        setSimpleVariantLayoutWidth((prev) =>
          prev === nextWidth ? prev : nextWidth,
        );
      }
      rootOnLayout?.(event as never);
    },
    [rootOnLayout],
  );

  // Display value for simple variant (no formatting, direct raw value)
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

  const InputElement = useMemo(() => {
    if (inputProps?.loading)
      return (
        <Stack py="$4" pb="$2.5" px="$3.5" flex={1}>
          <Skeleton h="$6" w="$24" />
        </Stack>
      );

    return (
      <Input
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        textContentType="none"
        keyboardType="decimal-pad"
        height="$11"
        fontSize={getFontSize('$heading3xl')}
        fontWeight="600"
        size={platformEnv.isNativeAndroid ? undefined : 'large'}
        focusVisibleStyle={undefined}
        containerProps={{
          flex: 1,
          mt: '$1.5',
          borderWidth: 0,
        }}
        value={value}
        onChangeText={handleChangeText}
        // maybe should replace with ref.current.setNativeProps({ selection })
        {...inputProps}
        {...(platformEnv.isNativeAndroid && {
          selection,
          onSelectionChange: ({ nativeEvent }) => {
            setSelection(nativeEvent.selection);
          },
          onFocus: (event) => {
            setSelection({
              start: value?.length ?? 0,
              end: value?.length ?? 0,
            });
            inputProps?.onFocus?.(event);
          },
          onBlur: (event) => {
            setSelection({ start: 0, end: 0 });
            inputProps?.onBlur?.(event);
          },
        })}
      />
    );
  }, [inputProps, value, handleChangeText, selection]);

  const AmountElement = useMemo(() => {
    if (!valueProps) {
      return null;
    }

    if (valueProps.loading)
      return (
        <Stack py="$0.5">
          <Skeleton h="$3" w="$16" />
        </Stack>
      );

    return (
      <>
        <NumberSizeableText
          formatter={valueProps.formatter ?? 'value'}
          formatterOptions={{
            currency: valueProps.currency,
            tokenSymbol: valueProps.tokenSymbol,
          }}
          size="$bodySm"
          color={valueProps.color ?? '$textSubdued'}
          pr="$0.5"
        >
          {valueProps.value || '0.00'}
        </NumberSizeableText>
        {valueProps.moreComponent}
        {reversible ? (
          <Icon name="SwitchVerOutline" size="$4" color="$iconSubdued" />
        ) : null}
      </>
    );
  }, [valueProps, reversible]);

  const TokenSelectorTrigger = useMemo(() => {
    if (tokenSelectorTriggerProps?.loading) {
      return (
        <XStack p="$3.5" pb="$2" alignItems="center">
          <Skeleton w="$7" h="$7" radius="round" />
          <Stack pl="$2" py="$1.5">
            <Skeleton h="$4" w="$10" />
          </Stack>
        </XStack>
      );
    }

    const { popover: popoverProps, ...restTriggerProps } =
      tokenSelectorTriggerProps ?? {};
    const hasPopover = !!popoverProps?.content;
    const hasOnPress = !!restTriggerProps.onPress || hasPopover;

    const triggerContent = (
      <XStack
        alignItems="center"
        m="$1.5"
        mb="$0"
        p="$2"
        borderRadius="$2"
        userSelect="none"
        {...(restTriggerProps.selectedTokenSymbol && {
          maxWidth: '$44',
        })}
        {...(hasOnPress && {
          role: 'button',
          hoverStyle: {
            bg: '$bgHover',
          },
          pressStyle: {
            bg: '$bgActive',
          },
        })}
        disabled={restTriggerProps.disabled}
        onPress={hasPopover ? undefined : restTriggerProps.onPress}
      >
        <Stack mr="$2">
          <Image
            size="$7"
            borderRadius="$full"
            source={{
              uri: restTriggerProps.selectedTokenImageUri,
            }}
            fallback={
              <Image.Fallback
                borderRadius="$full"
                alignItems="center"
                justifyContent="center"
                bg="$gray5"
              >
                <Icon
                  size="$6"
                  m="$1"
                  name="CryptoCoinOutline"
                  color="$iconSubdued"
                />
              </Image.Fallback>
            }
          />
          {restTriggerProps.selectedNetworkImageUri ? (
            <Stack
              position="absolute"
              right="$-1"
              bottom="$-1"
              p="$0.5"
              borderRadius="$full"
              flexShrink={1}
              bg="$bgApp"
            >
              <Image
                size="$3"
                borderRadius="$full"
                source={{
                  uri: restTriggerProps.selectedNetworkImageUri,
                }}
                fallback={
                  <Image.Fallback bg="$gray5" delayMs={1000}>
                    <Icon
                      size="$3"
                      name="QuestionmarkSolid"
                      color="$iconSubdued"
                    />
                  </Image.Fallback>
                }
              />
            </Stack>
          ) : null}
          {restTriggerProps.isCustomNetwork &&
          restTriggerProps.selectedNetworkName ? (
            <Stack
              position="absolute"
              right="$-1"
              bottom="$-1"
              p="$0.5"
              borderRadius="$full"
              flexShrink={1}
              bg="$bgApp"
            >
              <LetterAvatar
                size="$3"
                letter={restTriggerProps.selectedNetworkName[0]}
              />
            </Stack>
          ) : null}
        </Stack>
        <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
          {restTriggerProps.selectedTokenSymbol ||
            intl.formatMessage({ id: ETranslations.token_selector_title })}
        </SizableText>
        {hasOnPress && !restTriggerProps.disabled ? (
          <Icon
            flexShrink={0}
            name="ChevronDownSmallOutline"
            size="$5"
            mr="$-1"
            color="$iconSubdued"
          />
        ) : null}
      </XStack>
    );

    // Wrap with Popover if popover prop is provided
    if (hasPopover && !restTriggerProps.disabled) {
      return (
        <Popover
          title={popoverProps.title}
          renderTrigger={triggerContent}
          renderContent={popoverProps.content}
          floatingPanelProps={{
            w: '$72',
          }}
        />
      );
    }

    return triggerContent;
  }, [intl, tokenSelectorTriggerProps]);

  const BalanceElement = useMemo(() => {
    if (!balanceProps) {
      return null;
    }
    if (balanceProps.loading) {
      return (
        <Stack py="$0.5" my={7} px="$3.5">
          <Skeleton h="$3" w="$16" />
        </Stack>
      );
    }
    if (balanceProps.value) {
      const contentComponent = (
        <XStack
          alignItems="center"
          m="$1"
          px="$2.5"
          py="$1"
          borderRadius={6}
          onPress={balanceProps.onPress}
          {...(enableMaxAmount && {
            userSelect: 'none',
            hoverStyle: {
              bg: '$bgHover',
            },
            pressStyle: {
              bg: '$bgActive',
            },
          })}
          {...(balanceHelperProps && {
            px: '$1.5',
            mr: '$-2',
          })}
        >
          {balanceProps.iconText ? (
            <SizableText color="$textSubdued" size="$bodySm" mr="$1">
              {balanceProps.iconText}
            </SizableText>
          ) : (
            <Icon name="WalletOutline" size="$4" color="$iconSubdued" mr="$1" />
          )}
          <>
            <NumberSizeableText
              size="$bodySm"
              color="$textSubdued"
              formatter="balance"
            >
              {balanceProps.value ?? 0}
            </NumberSizeableText>
          </>
          {enableMaxAmount ? (
            <SizableText pl="$1" size="$bodySmMedium" color="$textInteractive">
              {maxAmountText ??
                intl.formatMessage({ id: ETranslations.send_max })}
            </SizableText>
          ) : null}
        </XStack>
      );
      if (balanceProps.popoverContent) {
        return (
          <Popover
            title=""
            showHeader={false}
            renderContent={() => balanceProps.popoverContent}
            renderTrigger={contentComponent}
          />
        );
      }
      return contentComponent;
    }
    return null;
  }, [balanceHelperProps, balanceProps, enableMaxAmount, intl, maxAmountText]);

  const balanceHelper = useMemo(() => {
    if (!balanceHelperProps) {
      return null;
    }

    return (
      <Stack
        mx="$2"
        p="$1"
        borderRadius={6}
        {...(balanceHelperProps?.onPress && {
          hoverStyle: {
            bg: '$bgHover',
          },
          pressStyle: {
            bg: '$bgActive',
          },
        })}
        onPress={balanceHelperProps?.onPress}
      >
        <Icon name="InfoCircleOutline" color="$iconSubdued" size="$4" />
      </Stack>
    );
  }, [balanceHelperProps]);

  // Simple variant: borderless, symbol inline, balance card rendered externally
  if (isSimpleVariant) {
    const { leftAddOnProps: simpleLeftAddOn, ...simpleInputProps } =
      inputProps ?? {};
    const currencyLabel = simpleLeftAddOn?.label as string | undefined;
    const useAutoSizeInput = platformEnv.isNative && !!AutoSizeInputNativeView;

    const simpleFontSize = getAmountFontSize(
      displayValue?.length || 0,
      fontSizeScale,
    );
    const availableInlineWidth = Math.max(
      Math.floor(simpleVariantLayoutWidth || windowWidth || 0),
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
    const isPrefixOnlyInlineLayout =
      !!currencyLabel && !inlineTokenSymbol && !wrappedTokenSymbol;
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
    const isLongPrefixOnlyAmount =
      isPrefixOnlyInlineLayout && inlineMeasureText.length > 12;
    let inlineInputBufferPx = Math.max(18, Math.round(simpleFontSize * 0.5));
    if (isPrefixOnlyInlineLayout) {
      inlineInputBufferPx = isLongPrefixOnlyAmount
        ? Math.max(14, Math.round(simpleFontSize * 0.32))
        : Math.max(10, Math.round(simpleFontSize * 0.18));
    }
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
    const autoSizePrefixText = currencyLabel ?? '';
    const autoSizeSuffixText = inlineTokenSymbol ?? '';
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
      !!wrappedTokenSymbol ||
      (!currencyLabel && !inlineTokenSymbol) ||
      isPrefixOnlyInlineLayout;
    let desktopAmountTextAlign: 'center' | 'right' = 'right';
    if (shouldCenterDesktopAmountText) {
      desktopAmountTextAlign = 'center';
    }
    let desktopInlineRowOffsetPx = 0;
    if (desktopAmountTextAlign === 'right') {
      desktopInlineRowOffsetPx = Math.round(-inlineInputSlackPx / 2);
    }

    let amountInputNode = platformEnv.isNative ? (
      <Input
        ref={inputRef}
        keyboardType="decimal-pad"
        fontSize={simpleFontSize}
        fontWeight="500"
        color="$text"
        unstyled
        borderWidth={0}
        bg="transparent"
        p="$0"
        h={Math.ceil(simpleFontSize * 1.4)}
        size="large"
        focusVisibleStyle={undefined}
        placeholder="0"
        placeholderTextColor="$textDisabled"
        value={displayValue}
        onChangeText={handleSimpleChangeText}
        textAlign="center"
        containerProps={{
          width: '100%',
          borderWidth: 0,
          bg: 'transparent',
        }}
        {...(currencyLabel && {
          leftAddOnProps: {
            label: currencyLabel,
            pr: '$0',
            pl: '$0',
            mr: '$-2',
          },
        })}
        {...(inlineTokenSymbol && {
          addOns: [
            {
              label: inlineTokenSymbol,
              pr: '$0',
              pl: '$1.25',
            },
          ],
        })}
        {...simpleInputProps}
        selectionColor={selectionColor}
        cursorColor={selectionColor}
        caretColor={selectionColor}
        {...({
          selection,
          onSelectionChange: ({ nativeEvent }) => {
            if (displayValue === '0') {
              setSelection({ start: 1, end: 1 });
            } else {
              setSelection(nativeEvent.selection);
            }
          },
          onFocus: (event) => {
            setSelection({
              start: displayValue?.length ?? 0,
              end: displayValue?.length ?? 0,
            });
            simpleInputProps?.onFocus?.(event);
          },
          onBlur: (event) => {
            setSelection({ start: 0, end: 0 });
            simpleInputProps?.onBlur?.(event);
          },
        } as const)}
      />
    ) : (
      <XStack
        width="100%"
        alignItems="center"
        justifyContent="center"
        style={
          desktopInlineRowOffsetPx
            ? { transform: [{ translateX: desktopInlineRowOffsetPx }] }
            : undefined
        }
      >
        {currencyLabel ? (
          <SizableText
            color="$text"
            fontWeight="500"
            lineHeight={Math.ceil(simpleFontSize * 1.4)}
            style={{
              fontSize: simpleFontSize,
              marginRight: inlinePrefixGapPx,
            }}
            mt={desktopPrefixOffset}
          >
            {currencyLabel}
          </SizableText>
        ) : null}
        <Input
          ref={inputRef}
          keyboardType="decimal-pad"
          fontSize={simpleFontSize}
          fontWeight="500"
          color="$text"
          unstyled
          borderWidth={0}
          bg="transparent"
          p="$0"
          px="$0"
          pl="$0"
          pr="$0"
          h={Math.ceil(simpleFontSize * 1.4)}
          size="large"
          focusVisibleStyle={undefined}
          placeholder="0"
          placeholderTextColor="$textDisabled"
          value={displayValue}
          onChangeText={handleSimpleChangeText}
          textAlign={desktopAmountTextAlign}
          containerProps={{
            width: inlineInputWidthPx,
            flexShrink: 1,
            minWidth: Math.ceil(simpleFontSize * 1.2),
            maxWidth: inlineInputMaxWidth,
            borderWidth: 0,
            bg: 'transparent',
          }}
          {...simpleInputProps}
          selectionColor={selectionColor}
          cursorColor={selectionColor}
          caretColor={selectionColor}
          {...({
            onFocus: (event: { target: HTMLInputElement }) => {
              simpleInputProps?.onFocus?.(event as never);
              if (displayValue === '0') {
                const { target } = event;
                requestAnimationFrame(() => {
                  target.setSelectionRange(1, 1);
                });
              }
            },
            onClick: (e: { target: HTMLInputElement }) => {
              if (displayValue === '0') {
                e.target.setSelectionRange(1, 1);
              }
            },
            onKeyUp: (e: { target: HTMLInputElement }) => {
              if (displayValue === '0') {
                e.target.setSelectionRange(1, 1);
              }
            },
            onSelect: (e: { target: HTMLInputElement }) => {
              if (displayValue === '0' && e.target.selectionStart !== 1) {
                e.target.setSelectionRange(1, 1);
              }
            },
          } as any)}
        />
        {inlineTokenSymbol ? (
          <SizableText
            color="$text"
            fontWeight="500"
            lineHeight={Math.ceil(simpleFontSize * 1.4)}
            style={{
              fontSize: simpleFontSize,
              marginLeft: inlineSuffixGapPx,
            }}
            mt={desktopInlineSymbolOffset}
            numberOfLines={1}
          >
            {inlineTokenSymbol}
          </SizableText>
        ) : null}
      </XStack>
    );

    if (simpleInputProps?.loading) {
      amountInputNode = (
        <Stack py="$4">
          <Skeleton h="$12" w="$40" />
        </Stack>
      );
    } else if (useAutoSizeInput) {
      amountInputNode = (
        <Stack width="100%" alignItems="center" py="$1">
          <AutoSizeInputNativeView
            style={{
              width: autoSizeContainerWidth,
              height: Math.ceil(simpleMaxFontSize * 1.4),
              minHeight: Math.ceil(simpleMinFontSize * 1.4),
            }}
            text={autoSizeTextValue}
            placeholder={simpleInputProps?.placeholder ?? '0'}
            prefix={autoSizePrefixText}
            suffix={autoSizeSuffixText}
            fontSize={simpleMaxFontSize}
            minFontSize={simpleMinFontSize}
            textAlign="center"
            fontWeight="500"
            editable={simpleInputProps?.editable ?? true}
            keyboardType={mapAutoSizeKeyboardType(
              simpleInputProps?.keyboardType ?? 'decimal-pad',
            )}
            returnKeyType={simpleInputProps?.returnKeyType}
            autoCorrect={false}
            autoCapitalize="none"
            textColor={autoSizeInputTextColor}
            prefixColor={autoSizeInputTextColor}
            suffixColor={autoSizeInputTextColor}
            placeholderColor={autoSizePlaceholderColor}
            selectionColor={autoSizeSelectionColor}
            prefixMarginRight={currencyLabel ? inlinePrefixGapPx : 0}
            suffixMarginLeft={inlineTokenSymbol ? inlineSuffixGapPx : 0}
            showBorder={false}
            inputBackgroundColor={autoSizeTransparentColor}
            contentAutoWidth
            onChangeText={wrapNitroCallback(handleSimpleChangeText)}
            onFocus={wrapNitroCallback(() => {
              simpleInputProps?.onFocus?.({} as never);
            })}
            onBlur={wrapNitroCallback(() => {
              simpleInputProps?.onBlur?.({} as never);
            })}
            hybridRef={wrapNitroCallback((hybridViewRef: IAutoSizeInputRef) => {
              autoSizeInputRef.current = hybridViewRef;
            })}
          />
        </Stack>
      );
    }

    return (
      <Stack
        alignItems="center"
        width="100%"
        {...rest}
        onLayout={handleAmountInputLayout}
      >
        {/* Amount input row */}
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

        {/* Fiat value + flip button */}
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

        {/* Extra content (CoinControl, AddressTypeSelector) */}
        {extraContent}
      </Stack>
    );
  }

  // Default variant: standard layout with border
  return (
    <Stack
      borderRadius="$3"
      position="relative"
      borderWidth={sharedStyles.borderWidth}
      borderColor={sharedStyles.borderColor}
      overflow="hidden"
      borderCurve="continuous"
      {...rest}
    >
      <XStack alignItems="center">
        {InputElement}
        {TokenSelectorTrigger}
      </XStack>
      <XStack alignItems="center" justifyContent="space-between">
        <XStack
          alignItems="center"
          m="$1"
          px="$2.5"
          py="$1"
          borderRadius={6}
          disabled={balanceProps?.loading}
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
          {AmountElement}
        </XStack>
        <XStack alignItems="center">
          {BalanceElement}
          {balanceHelper}
        </XStack>
      </XStack>
    </Stack>
  );
}

export const AmountInput = forwardRef(AmountInputComponent);
