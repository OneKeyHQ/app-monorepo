import { useEffect, useRef } from 'react';

import { OtpInput } from 'react-native-otp-entry';

import { useThemeValue } from '../../hooks';

import type { OtpInputProps, OtpInputRef } from 'react-native-otp-entry';

export function OTPInput(
  props: OtpInputProps & {
    value: string;
  },
) {
  const { value, ...rest } = props;
  const [neutral5Color, textColor] = useThemeValue(['neutral5', 'text']);
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
          color: textColor,
        },
        pinCodeContainerStyle: {
          width: 46,
          height: 46,
          borderWidth: 1,
          borderColor: neutral5Color,
        },
        focusedPinCodeContainerStyle: {
          borderWidth: 2,
          borderColor: neutral5Color,
        },
      }}
      focusColor={textColor}
      {...rest}
    />
  );
}
