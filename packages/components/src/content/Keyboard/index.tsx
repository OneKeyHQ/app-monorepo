import {
  dismissKeyboard,
  dismissKeyboardWithDelay,
} from '@onekeyhq/shared/src/keyboard';

const PassThrough = (children: React.ReactNode) => children;

export const Keyboard = {
  AvoidingView: PassThrough,
  AwareScrollView: PassThrough,
  StickyView: PassThrough,
  Toolbar: PassThrough,
  ControllerView: PassThrough,
  dismiss: dismissKeyboard,
  dismissWithDelay: dismissKeyboardWithDelay,
};
