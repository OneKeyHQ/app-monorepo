import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';

import { AutoSizeInputView } from '@onekeyfe/react-native-auto-size-input';
import {
  type HybridView,
  callback as nitroCallback,
} from 'react-native-nitro-modules';

import { Stack } from '@onekeyhq/components';

import type {
  IAutoSizeInputProps,
  IAutoSizeInputRef,
} from './AutoSizeInput.types';
import type {
  AutoSizeInputMethods,
  AutoSizeInputProps,
} from '@onekeyfe/react-native-auto-size-input';

const wrapNitroCallback = nitroCallback;
type IAutoSizeNativeRef = HybridView<AutoSizeInputProps, AutoSizeInputMethods>;

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

export const AutoSizeInput = forwardRef<IAutoSizeInputRef, IAutoSizeInputProps>(
  (
    {
      value,
      maxFontSize,
      minFontSize,
      currencyLabel,
      inlineTokenSymbol,
      inlinePrefixGapPx,
      inlineSuffixGapPx,
      onChangeText,
      placeholder,
      editable,
      keyboardType,
      returnKeyType,
      onFocus,
      onBlur,
      textColor,
      placeholderColor,
      selectionColor,
      backgroundColor,
    }: IAutoSizeInputProps,
    ref,
  ) => {
    const nativeInputRef = useRef<IAutoSizeNativeRef | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          nativeInputRef.current?.focus?.();
        },
        blur: () => {
          nativeInputRef.current?.blur();
        },
      }),
      [],
    );

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
          text={value}
          placeholder={placeholder ?? '0'}
          prefix={currencyLabel ?? ''}
          suffix={inlineTokenSymbol ?? ''}
          fontSize={maxFontSize}
          minFontSize={minFontSize}
          textAlign={autoSizeTextAlign}
          fontWeight="500"
          editable={editable ?? true}
          keyboardType={mapAutoSizeKeyboardType(keyboardType ?? 'decimal-pad')}
          returnKeyType={returnKeyType}
          autoCorrect={false}
          autoCapitalize="none"
          textColor={textColor}
          prefixColor={textColor}
          suffixColor={textColor}
          placeholderColor={placeholderColor}
          selectionColor={selectionColor}
          prefixMarginRight={currencyLabel ? inlinePrefixGapPx : 0}
          suffixMarginLeft={inlineTokenSymbol ? inlineSuffixGapPx : 0}
          showBorder={false}
          inputBackgroundColor={backgroundColor}
          contentAutoWidth
          onChangeText={wrapNitroCallback(onChangeText)}
          onFocus={
            wrapNitroCallback(() => {
              onFocus?.({} as never);
            }) as never
          }
          onBlur={
            wrapNitroCallback(() => {
              onBlur?.({} as never);
            }) as never
          }
          hybridRef={wrapNitroCallback((hybridViewRef: IAutoSizeNativeRef) => {
            nativeInputRef.current = hybridViewRef;
          })}
        />
      </Stack>
    );
  },
);

AutoSizeInput.displayName = 'AutoSizeInput';
