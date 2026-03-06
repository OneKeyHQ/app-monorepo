import { AutoSizeInputView } from '@onekeyfe/react-native-auto-size-input';
import {
  type HybridView,
  callback as nitroCallback,
} from 'react-native-nitro-modules';

import { Stack } from '@onekeyhq/components';

import type { IAutoSizeInputProps } from './AutoSizeInput.types';
import type {
  AutoSizeInputMethods,
  AutoSizeInputProps,
} from '@onekeyfe/react-native-auto-size-input';

const AutoSizeInput = AutoSizeInputView;
const wrapNitroCallback = nitroCallback;
type IAutoSizeInputRef = HybridView<AutoSizeInputProps, AutoSizeInputMethods>;

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

export function AutoSizeInput({
  displayValue,
  simpleFontSize,
  simpleMaxFontSize,
  simpleMinFontSize,
  availableInlineWidth,
  currencyLabel,
  inlineTokenSymbol,
  inlinePrefixGapPx,
  inlineSuffixGapPx,
  handleSimpleChangeText,
  inputPlaceholder,
  inputEditable,
  inputKeyboardType,
  inputReturnKeyType,
  onInputFocus,
  onInputBlur,
  autoSizeTextValue,
  autoSizeInputTextColor,
  autoSizePlaceholderColor,
  autoSizeSelectionColor,
  autoSizeTransparentColor,
  onHybridRef,
}: IAutoSizeInputProps) {
  const inlineMeasureText = displayValue || inputPlaceholder || '0';
  const inlineAmountTextWidthPx = Math.ceil(
    estimateInlineTextWidthPx(inlineMeasureText, simpleFontSize) +
      Math.max(18, Math.round(simpleFontSize * 0.5)),
  );
  const inlinePrefixTextWidthPx = currencyLabel
    ? Math.ceil(estimateInlineTextWidthPx(currencyLabel, simpleFontSize))
    : 0;
  const inlineSuffixTextWidthPx = inlineTokenSymbol
    ? Math.ceil(estimateInlineTextWidthPx(inlineTokenSymbol, simpleFontSize))
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
  const defaultAutoSizeContainerMaxWidth = 320;
  const autoSizeAvailableWidth =
    availableInlineWidth > 0
      ? Math.max(availableInlineWidth - 8, 0)
      : defaultAutoSizeContainerMaxWidth;
  const autoSizeContainerWidth = Math.min(
    Math.max(autoSizePreferredWidth, autoSizeContainerMinWidth),
    autoSizeAvailableWidth,
    defaultAutoSizeContainerMaxWidth,
  );

  return (
    <Stack width="100%" alignItems="center" py="$1">
      <AutoSizeInput
        style={{
          width: autoSizeContainerWidth,
          height: Math.ceil(simpleMaxFontSize * 1.4),
          minHeight: Math.ceil(simpleMinFontSize * 1.4),
        }}
        text={autoSizeTextValue}
        placeholder={inputPlaceholder ?? '0'}
        prefix={currencyLabel ?? ''}
        suffix={inlineTokenSymbol ?? ''}
        fontSize={simpleMaxFontSize}
        minFontSize={simpleMinFontSize}
        textAlign="center"
        fontWeight="500"
        editable={inputEditable ?? true}
        keyboardType={mapAutoSizeKeyboardType(
          inputKeyboardType ?? 'decimal-pad',
        )}
        returnKeyType={inputReturnKeyType}
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
        onFocus={
          wrapNitroCallback(() => {
            onInputFocus?.({} as never);
          }) as never
        }
        onBlur={
          wrapNitroCallback(() => {
            onInputBlur?.({} as never);
          }) as never
        }
        hybridRef={wrapNitroCallback((hybridViewRef: IAutoSizeInputRef) => {
          onHybridRef(hybridViewRef as unknown as { focus?: () => void });
        })}
      />
    </Stack>
  );
}
