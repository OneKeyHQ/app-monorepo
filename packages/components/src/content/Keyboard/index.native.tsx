import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
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

export const Keyboard = {
  AvoidingView: KeyboardAvoidingView,
  AwareScrollView: KeyboardAwareScrollView,
  StickyView: KeyboardStickyView,
  Toolbar: KeyboardToolbar,
  ControllerView: KeyboardControllerView,
  OverKeyboardView,
  Extender: KeyboardExtender,
  dismiss: dismissKeyboard,
  dismissWithDelay: dismissKeyboardWithDelay,
};
