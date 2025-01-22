import { OtpInput } from 'react-native-otp-entry';

import { useThemeValue } from '../../hooks';

import type { OtpInputProps } from 'react-native-otp-entry';

export function OTPInput(props: OtpInputProps) {
  const [neutral5Color, textColor] = useThemeValue(['neutral5', 'text']);

  return (
    <OtpInput
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
      {...props}
    />
  );
}
