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

/** Estimate text width in pixels based on character categories. */
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

const DEFAULT_MAX_CONTAINER_WIDTH = 320;

export function AutoSizeInput({
  value,
  fontSize,
  maxFontSize,
  minFontSize,
  availableWidth,
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
  const [localText, setLocalText] = useState(value);
  const prevPropRef = useRef(value);

  // Sync localText when parent prop changes (e.g. percentage button, token switch)
  if (prevPropRef.current !== value) {
    prevPropRef.current = value;
    if (localText !== value) {
      setLocalText(value);
    }
  }

  // Correct localText back to the canonical value after raw input diverges
  useLayoutEffect(() => {
    if (localText !== value) {
      setLocalText(value);
    }
  }, [localText, value]);

  const handleLocalChangeText = useCallback(
    (raw: string) => {
      setLocalText(raw); // Track what native currently has
      onChangeText(raw); // Parent sanitizes and updates form
    },
    [onChangeText],
  );

  // --- Container width estimation ---
  // The native contentAutoWidth handles internal prefix/input/suffix layout,
  // but we need a tight container width so the parent can center it.
  const measureText = value || placeholder || '0';
  const amountTextWidthPx = Math.ceil(
    estimateTextWidthPx(measureText, fontSize) +
      Math.max(18, Math.round(fontSize * 0.5)),
  );
  const prefixTextWidthPx = prefix
    ? Math.ceil(estimateTextWidthPx(prefix, fontSize))
    : 0;
  const suffixTextWidthPx = suffix
    ? Math.ceil(estimateTextWidthPx(suffix, fontSize))
    : 0;
  const preferredWidth = Math.ceil(
    amountTextWidthPx +
      prefixTextWidthPx +
      suffixTextWidthPx +
      (prefix ? prefixGap : 0) +
      (suffix ? suffixGap : 0) +
      fontSize * 0.18,
  );
  const containerMinWidth = Math.ceil(maxFontSize * 1.2);
  const effectiveAvailableWidth =
    availableWidth > 0
      ? Math.max(availableWidth - 8, 0)
      : DEFAULT_MAX_CONTAINER_WIDTH;
  const containerWidth = Math.min(
    Math.max(preferredWidth, containerMinWidth),
    effectiveAvailableWidth,
    DEFAULT_MAX_CONTAINER_WIDTH,
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
          width: containerWidth,
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
