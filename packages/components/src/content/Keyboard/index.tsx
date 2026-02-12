import {
  dismissKeyboard,
  dismissKeyboardWithDelay,
} from '@onekeyhq/shared/src/keyboard';
import { ScrollView } from 'react-native';

import type {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
  KeyboardController,
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
  AwareScrollView: ScrollView as unknown as typeof KeyboardAwareScrollView,
  StickyView: PassThrough as typeof KeyboardStickyView,
  Toolbar: PassThrough as typeof KeyboardToolbar,
  ControllerView: PassThrough as typeof KeyboardControllerView,
  OverKeyboardView: PassThrough as typeof OverKeyboardView,
  Extender: PassThrough as typeof KeyboardExtender,
  dismiss: dismissKeyboard,
  Controller: {
    setInputMode: () => {},
    setDefaultMode: () => {},
    preload: () => {},
    dismiss: () => Promise.resolve(),
    isVisible: () => false,
    state: () => ({
      height: 0,
      duration: 0,
      timestamp: 0,
      target: 0,
      type: 'keyboardDidHide' as const,
    }),
    setFocusTo: () => {},
  } as unknown as typeof KeyboardController,
  dismissWithDelay: dismissKeyboardWithDelay,
};
