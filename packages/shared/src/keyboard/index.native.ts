import { KeyboardController } from 'react-native-keyboard-controller';

// Do NOT use RN's `Keyboard.dismiss()` here — on both iOS and Android it is
// implemented as `TextInputState.blurTextInput(currentlyFocusedInput())`,
// which only blurs RN-managed TextInputs. Keyboards raised by native inputs
// outside RN's tracking (e.g. UITextField inside @onekeyfe/react-native-
// auto-size-input's Nitro HybridView used by Send amount input) are not
// affected and remain on screen, so `Dialog.show` ends up rendering its
// Sheet behind the still-visible system keyboard (OK-42598).
//
// `KeyboardController.dismiss()` from react-native-keyboard-controller is a
// true global dismiss: on iOS it resigns `UIResponder.current`, on Android
// it calls `InputMethodManager.hideSoftInputFromWindow` on the currently
// focused input's window token. Both code paths dismiss any soft keyboard
// regardless of whether RN tracks the input.
export const dismissKeyboard = () => {
  void KeyboardController.dismiss();
};

export const dismissKeyboardWithDelay = async (delayMs = 80) => {
  await KeyboardController.dismiss();
  await new Promise((resolve) => setTimeout(resolve, delayMs));
};
