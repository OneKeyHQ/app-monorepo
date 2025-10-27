import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
  KeyboardControllerView,
  KeyboardStickyView,
  KeyboardToolbar,
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
  dismiss: dismissKeyboard,
  dismissWithDelay: dismissKeyboardWithDelay,
};
