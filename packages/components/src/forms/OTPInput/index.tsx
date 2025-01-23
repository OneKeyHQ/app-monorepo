import { useEffect, useRef } from 'react';

import { OtpInput } from 'react-native-otp-entry';

import { useTheme } from '../../hooks';

// https://github.com/anday013/react-native-otp-entry
import type { OtpInputProps, OtpInputRef } from 'react-native-otp-entry';

export function OTPInput(
  props: OtpInputProps & {
    value: string;
    onComplete?: (value: string) => void;
  },
) {
  const { value, onComplete, numberOfDigits, ...rest } = props;
  const theme = useTheme();
  const ref = useRef<OtpInputRef>(null);

  useEffect(() => {
    ref.current?.setValue(value);

    if (numberOfDigits === value.length) {
      onComplete?.(value);
    }
  }, [onComplete, numberOfDigits, value]);

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
          borderColor: theme.neutral7.val,
        },
        filledPinCodeContainerStyle: {
          borderWidth: 2,
          backgroundColor: theme.gray2.val,
        },
        focusedPinCodeContainerStyle: {
          borderWidth: 2,
          borderColor: theme.borderActive.val,
        },
      }}
      focusColor={theme.text.val}
      numberOfDigits={numberOfDigits}
      {...rest}
    />
  );
}
