import { useEffect, useState } from 'react';

import { Keyboard, Platform } from 'react-native';

import type { EmitterSubscription } from 'react-native';

export default function useIsKeyboardShown() {
  const [isKeyboardShown, setIsKeyboardShown] = useState(false);

  useEffect(() => {
    const handleKeyboardShow = () => setIsKeyboardShown(true);
    const handleKeyboardHide = () => setIsKeyboardShown(false);

    let subscriptions: EmitterSubscription[];

    if (Platform.OS === 'ios') {
      subscriptions = [
        Keyboard.addListener('keyboardWillShow', handleKeyboardShow),
        Keyboard.addListener('keyboardWillHide', handleKeyboardHide),
      ];
    } else {
      subscriptions = [
        Keyboard.addListener('keyboardDidShow', handleKeyboardShow),
        Keyboard.addListener('keyboardDidHide', handleKeyboardHide),
      ];
    }

    return () => {
      subscriptions.forEach((s) => s.remove());
    };
  }, []);

  return isKeyboardShown;
}
