import { useCallback, useLayoutEffect, useRef, useState } from 'react';

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

const wrapNitroCallback = nitroCallback;
type IAutoSizeInputRef = HybridView<AutoSizeInputProps, AutoSizeInputMethods>;

/** Map React Native keyboard type names to Nitro camelCase equivalents. */
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
  maxFontSize,
  minFontSize,
  prefix,
  suffix,
  prefixGap,
  suffixGap,
  onChangeText,
  placeholder,
  editable,
  keyboardType,
  returnKeyType,
  onFocus,
  onBlur,
  nativeText,
  textColor,
  placeholderColor,
  nativeSelectionColor,
  backgroundColor,
  onHybridRef,
}: IAutoSizeInputProps) {
  // Local state tracks what the native Nitro HybridView currently displays.
  // When sanitization produces a value identical to the parent prop (e.g. "123456a" -> "123456"
  // but form value was already "123456"), Nitro's prop diffing skips the update.
  // By setting localText to the raw input first, then correcting it in useLayoutEffect,
  // we create a real prop change that Nitro will deliver to the native component.
  const [localText, setLocalText] = useState(nativeText);
  const prevPropRef = useRef(nativeText);

  // Sync localText when parent prop changes (e.g. percentage button, token switch)
  if (prevPropRef.current !== nativeText) {
    prevPropRef.current = nativeText;
    if (localText !== nativeText) {
      setLocalText(nativeText);
    }
  }

  // Correct localText back to the canonical value after raw input diverges
  useLayoutEffect(() => {
    if (localText !== nativeText) {
      setLocalText(nativeText);
    }
  }, [localText, nativeText]);

  const handleLocalChangeText = useCallback(
    (raw: string) => {
      setLocalText(raw); // Track what native currently has
      onChangeText(raw); // Parent sanitizes and updates form
    },
    [onChangeText],
  );

  // Text alignment: prefix → left-aligned, suffix → right-aligned, otherwise center
  let textAlign: 'center' | 'left' | 'right' = 'center';
  if (prefix) {
    textAlign = 'left';
  } else if (suffix) {
    textAlign = 'right';
  }

  return (
    <Stack width="100%" alignItems="center" py="$1">
      <AutoSizeInputView
        style={{
          // Width is handled by the native contentAutoWidth layout engine;
          // only height constraints are needed from JS.
          width: '100%',
          height: Math.ceil(maxFontSize * 1.4),
          minHeight: Math.ceil(minFontSize * 1.4),
        }}
        text={localText}
        placeholder={placeholder ?? '0'}
        prefix={prefix ?? ''}
        suffix={suffix ?? ''}
        fontSize={maxFontSize}
        minFontSize={minFontSize}
        textAlign={textAlign}
        fontWeight="500"
        editable={editable ?? true}
        keyboardType={mapAutoSizeKeyboardType(
          keyboardType ?? 'decimal-pad',
        )}
        returnKeyType={returnKeyType}
        autoCorrect={false}
        autoCapitalize="none"
        textColor={textColor}
        prefixColor={textColor}
        suffixColor={textColor}
        placeholderColor={placeholderColor}
        selectionColor={nativeSelectionColor}
        prefixMarginRight={prefix ? prefixGap : 0}
        suffixMarginLeft={suffix ? suffixGap : 0}
        showBorder={false}
        inputBackgroundColor={backgroundColor}
        contentAutoWidth
        onChangeText={wrapNitroCallback(handleLocalChangeText)}
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
        hybridRef={wrapNitroCallback((hybridViewRef: IAutoSizeInputRef) => {
          onHybridRef(hybridViewRef as unknown as { focus?: () => void });
        })}
      />
    </Stack>
  );
}
