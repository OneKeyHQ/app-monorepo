import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AutoSizeInputView } from '@onekeyfe/react-native-auto-size-input';
import {
  type HybridView,
  callback as nitroCallback,
} from 'react-native-nitro-modules';

import { Stack, useThemeName } from '@onekeyhq/components';

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

// @onekeyfe/react-native-auto-size-input pads the contentAutoWidth input slot
// by 8 (contentAutoWidthPadding, in dp/pt) on both platforms. With the amount
// left-aligned that padding sits between the digits and the suffix symbol, so
// fold it into the suffix gap to keep the visual spacing unchanged.
const NATIVE_CONTENT_AUTO_WIDTH_PADDING = 8;

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
      fontFamily,
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
    const [mostRecentEventCount, setMostRecentEventCount] = useState(0);
    const themeName = useThemeName();

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

    // Keep the caret on the left of the placeholder in both token and fiat
    // mode (OK-63413): a right-aligned suffix layout parked the empty-state
    // caret after the "0" while the fiat prefix layout parked it before.
    const autoSizeTextAlign = useMemo<'center' | 'left'>(() => {
      if (currencyLabel || inlineTokenSymbol) {
        return 'left';
      }
      return 'center';
    }, [currencyLabel, inlineTokenSymbol]);
    const suffixMarginLeft = inlineTokenSymbol
      ? Math.max(inlineSuffixGapPx - NATIVE_CONTENT_AUTO_WIDTH_PADDING, 0)
      : 0;

    return (
      <Stack width="100%" alignItems="center" py="$1" overflow="hidden">
        <AutoSizeInputView
          contentCentered
          style={{
            width: '100%',
            height: 64,
          }}
          mostRecentEventCount={mostRecentEventCount}
          text={value}
          placeholder={placeholder ?? '0'}
          prefix={currencyLabel ?? ''}
          suffix={inlineTokenSymbol ?? ''}
          fontSize={maxFontSize}
          minFontSize={minFontSize}
          textAlign={autoSizeTextAlign}
          fontFamily={fontFamily}
          fontWeight="500"
          editable={editable ?? true}
          keyboardType={mapAutoSizeKeyboardType(keyboardType ?? 'decimal-pad')}
          keyboardAppearance={/dark/.test(themeName) ? 'dark' : 'light'}
          returnKeyType={returnKeyType}
          autoCorrect={false}
          autoCapitalize="none"
          textColor={textColor}
          prefixColor={textColor}
          suffixColor={textColor}
          placeholderColor={placeholderColor}
          selectionColor={selectionColor}
          prefixMarginRight={currencyLabel ? inlinePrefixGapPx : 0}
          suffixMarginLeft={suffixMarginLeft}
          showBorder={false}
          inputBackgroundColor={backgroundColor}
          contentAutoWidth
          onChangeText={wrapNitroCallback((text) => {
            setMostRecentEventCount((eventCount) => eventCount + 1);
            onChangeText(text);
          })}
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
