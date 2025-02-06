import { useEffect, useRef, useState } from 'react';

import { OtpInput } from 'react-native-otp-entry';

import { useTheme } from '../../hooks';

// https://github.com/anday013/react-native-otp-entry
import type { OtpInputProps, OtpInputRef } from 'react-native-otp-entry';

export function OTPInput(
  props: OtpInputProps & {
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
    ...rest
  } = props;
  const theme = useTheme();
  const [innerStatus, setInnerStatus] = useState<'error' | 'normal'>(status);
  const ref = useRef<OtpInputRef>(null);

  useEffect(() => {
    ref.current?.setValue(value);

    if (numberOfDigits === value.length) {
      onComplete?.(value);
    } else {
      setInnerStatus('normal');
    }
  }, [onComplete, numberOfDigits, value]);

  useEffect(() => {
    setInnerStatus(status);
  }, [status]);

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
            innerStatus === 'error' ? theme.red8.val : theme.neutral7.val,
        },
        filledPinCodeContainerStyle: {
          borderWidth: 2,
          backgroundColor: theme.gray2.val,
        },
        focusedPinCodeContainerStyle: {
          borderWidth: 2,
          borderColor:
            innerStatus === 'error' ? theme.red8.val : theme.borderActive.val,
        },
      }}
      focusColor={theme.text.val}
      numberOfDigits={numberOfDigits}
      {...rest}
    />
  );
}
