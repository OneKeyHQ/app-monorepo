import { Keyboard } from 'react-native';

export const dismissKeyboard = () => {
  if (Keyboard.isVisible()) {
    Keyboard.dismiss();
  }
};

export const dismissKeyboardWithDelay = async (delayMs = 80) => {
  if (Keyboard.isVisible()) {
    Keyboard.dismiss();
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
};
