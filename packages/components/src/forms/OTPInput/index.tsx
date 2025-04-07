import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useTheme } from '../../hooks';
import { EPasteEventPayloadItemType } from '../Input';

import { OtpInput } from './OtpEntry';

// https://github.com/anday013/react-native-otp-entry
import type { IOtpInputProps, IOtpInputRef } from './OtpEntry';
import type { IPasteEventParams } from '../Input';

export function OTPInput(
  props: IOtpInputProps & {
    status?: 'error' | 'normal';
    value: string;
    onComplete?: (value: string) => void;
  },
) {
  const {
    value,
    onComplete,
    numberOfDigits,
    status = 'normal',
    autoFocus = true,
    textInputProps,
    onTextChange,
    ...rest
  } = props;
  const theme = useTheme();
  const [innerStatus, setInnerStatus] = useState<'error' | 'normal'>(status);
  const ref = useRef<IOtpInputRef>(null);
  const shouldReloadAutoFocus = useMemo(
    () => platformEnv.isRuntimeBrowser && autoFocus,
    [autoFocus],
  );
  useEffect(() => {
    ref.current?.setValue(value);

    if (numberOfDigits === value.length) {
      onComplete?.(value);
    } else {
      setInnerStatus('normal');
    }

    if (autoFocus && value.length === 0) {
      if (shouldReloadAutoFocus) {
        setTimeout(() => {
          if (platformEnv.isRuntimeChrome) {
            // @ts-expect-error
            ref.current?.focus({ preventScroll: true });
          } else {
            ref.current?.focus();
          }
        }, 150);
      } else {
        ref.current?.focus();
      }
    }
  }, [onComplete, numberOfDigits, value, autoFocus, shouldReloadAutoFocus]);

  useEffect(() => {
    setInnerStatus(status);
  }, [status]);

  const handleOnPaste = useCallback(
    (event: IPasteEventParams) => {
      const item = event.nativeEvent?.items?.[0];
      if (
        item &&
        item.type === EPasteEventPayloadItemType.TextPlain &&
        item.data
      ) {
        if (typeof item.data === 'string') {
          onTextChange?.(
            item.data.replace(/\s+/g, '').slice(0, numberOfDigits),
          );
        }
      }
    },
    [numberOfDigits, onTextChange],
  );

  return (
    <OtpInput
      ref={ref}
      theme={{
        pinCodeTextStyle: {
          fontSize: 20,
          fontWeight: 'bold',
          color: theme.text.val,
        },
        pinCodeContainerStyle: {
          width: 50,
          height: 50,
          borderWidth: 1,
          borderColor:
            innerStatus === 'error' ? theme.red9.val : theme.neutral7.val,
        },
        filledPinCodeContainerStyle: {
          borderWidth: 2,
          backgroundColor: theme.gray2.val,
        },
        focusedPinCodeContainerStyle: {
          borderWidth: 2,
          borderColor:
            innerStatus === 'error' ? theme.red9.val : theme.borderActive.val,
        },
      }}
      focusColor={theme.text.val}
      numberOfDigits={numberOfDigits}
      autoFocus={autoFocus}
      onTextChange={onTextChange}
      textInputProps={{
        ...textInputProps,
        onPaste: handleOnPaste,
      }}
      {...rest}
    />
  );
}
