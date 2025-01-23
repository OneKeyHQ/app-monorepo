import { useEffect, useRef } from 'react';

import { OtpInput } from 'react-native-otp-entry';

import { useTheme } from '../../hooks';

import type { OtpInputProps, OtpInputRef } from 'react-native-otp-entry';

export function OTPInput(
  props: OtpInputProps & {
    value: string;
  },
) {
  const { value, ...rest } = props;
  const theme = useTheme();
  const ref = useRef<OtpInputRef>(null);

  useEffect(() => {
    ref.current?.setValue(value);
  }, [value]);

  return (
    <OtpInput
      ref={ref}
      theme={{
        pinCodeTextStyle: {
          fontSize: 18,
          color: theme.text.val,
        },
        pinCodeContainerStyle: {
          width: 46,
          height: 46,
          borderWidth: 1,
          borderColor: theme.neutral6.val,
        },
        filledPinCodeContainerStyle: {
          borderWidth: 2,
        },
        focusedPinCodeContainerStyle: {
          borderWidth: 2,
          borderColor: theme.borderActive.val,
        },
      }}
      focusColor={theme.text.val}
      {...rest}
    />
  );
}
