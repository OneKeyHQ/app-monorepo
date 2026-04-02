import { useMemo, useRef, useState } from 'react';

import { Keyboard } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IOtpInputProps } from './OtpInput.types';
import type {
  NativeSyntheticEvent,
  TargetedEvent,
  TextInput,
} from 'react-native';

const regexMap = {
  alpha: /[^a-zA-Z]/,
  numeric: /[^\d]/,
  alphanumeric: /[^a-zA-Z\d]/,
};

export const useOtpInput = ({
  onTextChange,
  onFilled,
  numberOfDigits = 6,
  disabled,
  autoFocus = true,
  type,
  onFocus,
  onBlur,
  placeholder: _placeholder,
}: IOtpInputProps) => {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(autoFocus);
  const inputRef = useRef<TextInput>(null);
  const focusedInputIndex = text.length;
  const placeholder = useMemo(
    () =>
      _placeholder?.length === 1
        ? _placeholder.repeat(numberOfDigits)
        : _placeholder,
    [_placeholder, numberOfDigits],
  );

  const handlePress = () => {
    // To fix bug when keyboard is not popping up after being dismissed
    if (!Keyboard.isVisible()) {
      Keyboard.dismiss();
    }
    inputRef.current?.focus();
  };

  const handleTextChange = (value: string) => {
    if (type && regexMap[type].test(value)) return;
    if (disabled) return;
    const v = value
      .slice(0, numberOfDigits)
      .replace(/[^A-Za-z0-9]/g, '')
      .replace(/\s/g, '')
      .toUpperCase();
    setText(v);
    onTextChange?.(v);
    if (v.length === numberOfDigits) {
      onFilled?.(v);
    }
  };

  const setTextWithRef = (value: string) => {
    const normalizedValue =
      value.length > numberOfDigits ? value.slice(0, numberOfDigits) : value;
    handleTextChange(normalizedValue);
  };

  const clear = () => {
    setText('');
  };

  const focus = () => {
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = (e?: NativeSyntheticEvent<TargetedEvent>) => {
    // On desktop/web, the hidden OTP input can lose focus unexpectedly
    // (e.g. due to FocusScope trap in Dialog, browser quirks, or cursor
    // interactions). When relatedTarget is null it means no other element
    // is receiving focus, so we auto-refocus to keep the input active.
    if (!platformEnv.isNative) {
      const relatedTarget = (
        e?.nativeEvent as { relatedTarget?: EventTarget | null } | undefined
      )?.relatedTarget;
      if (e && !relatedTarget) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
        return;
      }
    }
    setIsFocused(false);
    onBlur?.();
  };

  return {
    models: { text, inputRef, focusedInputIndex, isFocused, placeholder },
    actions: {
      handlePress,
      handleTextChange,
      clear,
      focus,
      handleFocus,
      handleBlur,
    },
    forms: { setText, setTextWithRef },
  };
};
