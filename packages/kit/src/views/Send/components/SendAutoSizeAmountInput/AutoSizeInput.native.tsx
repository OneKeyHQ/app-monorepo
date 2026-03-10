import { AutoSizeInputView } from '@onekeyfe/react-native-auto-size-input';
import { useMemo } from 'react';
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

const wrapNitroCallback = nitroCallback;
type IAutoSizeInputRef = HybridView<AutoSizeInputProps, AutoSizeInputMethods>;

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
  simpleMaxFontSize,
  simpleMinFontSize,
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
  const autoSizeTextAlign = useMemo<'center' | 'left' | 'right'>(() => {
    if (currencyLabel) {
      return 'left';
    }
    if (inlineTokenSymbol) {
      return 'right';
    }
    return 'center';
  }, [currencyLabel, inlineTokenSymbol]);

  return (
    <Stack width="100%" alignItems="center" py="$1">
      <AutoSizeInputView
        contentCentered
        style={{
          width: '100%',
          height: 64,
        }}
        text={autoSizeTextValue}
        placeholder={inputPlaceholder ?? '0'}
        prefix={currencyLabel ?? ''}
        suffix={inlineTokenSymbol ?? ''}
        fontSize={simpleMaxFontSize}
        minFontSize={simpleMinFontSize}
        textAlign={autoSizeTextAlign}
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
