import { useEffect, useState } from 'react';
import { Keyboard, KeyboardEventListener } from 'react-native';

export default function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  const handleKeyboardWillShow: KeyboardEventListener = (e) => {
    setKeyboardHeight(e.endCoordinates.height);
  };
  const handleKeyboardDidShow: KeyboardEventListener = (e) => {};
  const handleKeyboardWillHide: KeyboardEventListener = (e) => {
    setKeyboardHeight(0);
  };
  const handleKeyboardDidHide: KeyboardEventListener = (e) => {};

  useEffect(() => {
    const subscriptions = [
      Keyboard.addListener('keyboardWillShow', handleKeyboardWillShow),
      Keyboard.addListener('keyboardDidShow', handleKeyboardDidShow),
      Keyboard.addListener('keyboardWillHide', handleKeyboardWillHide),
      Keyboard.addListener('keyboardDidHide', handleKeyboardDidHide),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);

  return keyboardHeight;
}
