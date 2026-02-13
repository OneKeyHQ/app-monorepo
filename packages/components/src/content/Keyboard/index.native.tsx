import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
  KeyboardController,
  KeyboardControllerView,
  KeyboardExtender,
  KeyboardStickyView,
  KeyboardToolbar,
  OverKeyboardView,
} from 'react-native-keyboard-controller';

import {
  dismissKeyboard,
  dismissKeyboardWithDelay,
} from '@onekeyhq/shared/src/keyboard';

export const KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET = 80;

export const Keyboard = {
  AvoidingView: KeyboardAvoidingView,
  AwareScrollView: KeyboardAwareScrollView,
  StickyView: KeyboardStickyView,
  Toolbar: KeyboardToolbar,
  Controller: KeyboardController,
  ControllerView: KeyboardControllerView,
  OverKeyboardView,
  Extender: KeyboardExtender,
  dismiss: dismissKeyboard,
  dismissWithDelay: dismissKeyboardWithDelay,
};
