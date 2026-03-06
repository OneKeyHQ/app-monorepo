import { AutoSizeInputView } from '@onekeyfe/react-native-auto-size-input';
import {
  type HybridView,
  callback as nitroCallback,
} from 'react-native-nitro-modules';

import { Stack } from '@onekeyhq/components';
import type { IInputProps } from '@onekeyhq/components';

import type {
  AutoSizeInputMethods,
  AutoSizeInputProps,
} from '@onekeyfe/react-native-auto-size-input';

const AutoSizeInput = AutoSizeInputView;
const wrapNitroCallback = nitroCallback;
type IAutoSizeInputRef = HybridView<AutoSizeInputProps, AutoSizeInputMethods>;

type IAutoSizeProps = {
  displayValue: string;
  simpleFontSize: number;
  currencyLabel?: string;
  inlineTokenSymbol?: string;
  inlinePrefixGapPx: number;
  inlineSuffixGapPx: number;
  desktopAmountTextAlign: 'center' | 'right';
  desktopInlineRowOffsetPx: number;
  desktopPrefixOffset: number;
  desktopInlineSymbolOffset: number;
  inlineInputWidthPx: number;
  inlineInputMaxWidth: string;
  selectionColor: string;
  handleSimpleChangeText: (text: string) => void;
  simpleInputProps: Omit<IInputProps, 'value' | 'onChangeText' | 'onChange'> & {
    loading?: boolean;
  };
  inputRef: React.RefObject<any>;
  autoSizeContainerWidth: number;
  simpleMaxFontSize: number;
  simpleMinFontSize: number;
  autoSizeTextValue: string;
  autoSizeInputTextColor?: string;
  autoSizePlaceholderColor?: string;
  autoSizeSelectionColor?: string;
  autoSizeTransparentColor?: string;
  onHybridRef: (ref: { focus?: () => void } | null) => void;
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
  autoSizeContainerWidth,
  simpleMaxFontSize,
  simpleMinFontSize,
  autoSizeTextValue,
  simpleInputProps,
  currencyLabel,
  inlineTokenSymbol,
  autoSizeInputTextColor,
  autoSizePlaceholderColor,
  autoSizeSelectionColor,
  inlinePrefixGapPx,
  inlineSuffixGapPx,
  autoSizeTransparentColor,
  handleSimpleChangeText,
  onHybridRef,
}: IAutoSizeProps) {
  return (
    <Stack width="100%" alignItems="center" py="$1">
      <AutoSizeInput
        style={{
          width: autoSizeContainerWidth,
          height: Math.ceil(simpleMaxFontSize * 1.4),
          minHeight: Math.ceil(simpleMinFontSize * 1.4),
        }}
        text={autoSizeTextValue}
        placeholder={simpleInputProps?.placeholder ?? '0'}
        prefix={currencyLabel ?? ''}
        suffix={inlineTokenSymbol ?? ''}
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
        onFocus={
          wrapNitroCallback(() => {
            simpleInputProps?.onFocus?.({} as never);
          }) as never
        }
        onBlur={
          wrapNitroCallback(() => {
            simpleInputProps?.onBlur?.({} as never);
          }) as never
        }
        hybridRef={wrapNitroCallback((hybridViewRef: IAutoSizeInputRef) => {
          onHybridRef(hybridViewRef as unknown as { focus?: () => void });
        })}
      />
    </Stack>
  );
}
