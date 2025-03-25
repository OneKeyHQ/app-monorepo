import type { IInputProps } from '../../../Input';
import type {
  ColorValue,
  TextInputProps,
  TextStyle,
  ViewStyle,
} from 'react-native';

export interface IOtpInputProps {
  numberOfDigits?: number;
  autoFocus?: boolean;
  focusColor?: ColorValue;
  onTextChange?: (text: string) => void;
  onFilled?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  blurOnFilled?: boolean;
  hideStick?: boolean;
  focusStickBlinkingDuration?: number;
  secureTextEntry?: boolean;
  theme?: IOtpTheme;
  disabled?: boolean;
  textInputProps?: TextInputProps & {
    onPaste?: IInputProps['onPaste'];
  };
  type?: 'alpha' | 'numeric' | 'alphanumeric';
  placeholder?: string;
}

export interface IOtpInputRef {
  clear: () => void;
  focus: () => void;
  setValue: (value: string) => void;
}

export interface IOtpTheme {
  containerStyle?: ViewStyle;
  /**
   * @deprecated Use `containerStyle` instead
   */
  inputsContainerStyle?: ViewStyle;
  pinCodeContainerStyle?: ViewStyle;
  filledPinCodeContainerStyle?: ViewStyle;
  pinCodeTextStyle?: TextStyle;
  focusStickStyle?: ViewStyle;
  focusedPinCodeContainerStyle?: ViewStyle;
  disabledPinCodeContainerStyle?: ViewStyle;
  placeholderTextStyle?: TextStyle;
}
