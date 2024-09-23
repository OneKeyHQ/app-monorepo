import { Keyboard } from 'react-native';

export const dismissKeyboard = () => {
  if (Keyboard.isVisible()) {
    Keyboard.dismiss();
  }
};
