import { DependencyList, useCallback, useEffect, useState } from 'react';

import { Keyboard } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { KeyboardEventListener } from 'react-native';

export { default as useIsKeyboardShown } from '@react-navigation/bottom-tabs/src/utils/useIsKeyboardShown';

const showEventName = platformEnv.isNativeIOS
  ? 'keyboardWillShow'
  : 'keyboardDidShow';
const hideEventName = platformEnv.isNativeIOS
  ? 'keyboardWillHide'
  : 'keyboardDidHide';

export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  const handleKeyboardWillShow: KeyboardEventListener = useCallback((e) => {
    setKeyboardHeight(e.endCoordinates.height);
  }, []);
  // const handleKeyboardDidShow: KeyboardEventListener = useCallback((e) => {});
  const handleKeyboardWillHide: KeyboardEventListener = useCallback(() => {
    setKeyboardHeight(0);
  }, []);
  // const handleKeyboardDidHide: KeyboardEventListener = useCallback((e) => {});

  useEffect(() => {
    const subscriptions = [
      Keyboard.addListener(showEventName, handleKeyboardWillShow),
      Keyboard.addListener(hideEventName, handleKeyboardWillHide),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [handleKeyboardWillHide, handleKeyboardWillShow]);

  return keyboardHeight;
}

const noop = () => undefined;
export const useKeyboardEvent = (
  {
    keyboardWillShow = noop,
    keyboardWillHide = noop,
  }: {
    keyboardWillShow?: KeyboardEventListener;
    keyboardWillHide?: KeyboardEventListener;
  },
  deps: DependencyList = [],
) => {
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      showEventName,
      keyboardWillShow,
    );

    const hideSubscription = Keyboard.addListener(
      hideEventName,
      keyboardWillHide,
    );
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};
