import {
  dismissKeyboard,
  dismissKeyboardWithDelay,
} from '@onekeyhq/shared/src/keyboard';

export const Keyboard = {
  AvoidingView: (children: React.ReactNode) => children,
  AwareScrollView: (children: React.ReactNode) => children,
  StickyView: (children: React.ReactNode) => children,
  Toolbar: (children: React.ReactNode) => children,
  ControllerView: (children: React.ReactNode) => children,
  dismiss: dismissKeyboard,
  dismissWithDelay: dismissKeyboardWithDelay,
};
