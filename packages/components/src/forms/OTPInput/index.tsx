import { OtpInput } from 'react-native-otp-entry';

import { useThemeValue } from '../../hooks';

import type { OtpInputProps } from 'react-native-otp-entry';

export function OTPInput(props: OtpInputProps) {
  const [neutral5Color] = useThemeValue(['neutral5']);

  return (
    <OtpInput
      theme={{
        pinCodeTextStyle: {
          fontSize: 18,
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
      focusColor="black"
      {...props}
    />
  );
}
