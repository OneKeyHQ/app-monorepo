import {
  dismissKeyboard,
  dismissKeyboardWithDelay,
} from '@onekeyhq/shared/src/keyboard';

import type {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
  KeyboardControllerView,
  KeyboardExtender,
  KeyboardStickyView,
  KeyboardToolbar,
  OverKeyboardView,
} from 'react-native-keyboard-controller';

const PassThrough = ({
  children,
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) => children;

export const Keyboard = {
  AvoidingView: PassThrough as typeof KeyboardAvoidingView,
  AwareScrollView: PassThrough as typeof KeyboardAwareScrollView,
  StickyView: PassThrough as typeof KeyboardStickyView,
  Toolbar: PassThrough as typeof KeyboardToolbar,
  ControllerView: PassThrough as typeof KeyboardControllerView,
  OverKeyboardView: PassThrough as typeof OverKeyboardView,
  Extender: PassThrough as typeof KeyboardExtender,
  dismiss: dismissKeyboard,
  dismissWithDelay: dismissKeyboardWithDelay,
};
