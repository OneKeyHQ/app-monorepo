import { useEffect, useState, useCallback } from 'react';
import { Keyboard, KeyboardEventListener } from 'react-native';

export default function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  const handleKeyboardWillShow: KeyboardEventListener = useCallback((e) => {
    setKeyboardHeight(e.endCoordinates.height);
  });
  const handleKeyboardDidShow: KeyboardEventListener = useCallback((e) => {});
  const handleKeyboardWillHide: KeyboardEventListener = useCallback((e) => {
    setKeyboardHeight(0);
  });
  const handleKeyboardDidHide: KeyboardEventListener = useCallback((e) => {});

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
