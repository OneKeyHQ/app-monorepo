import { useCallback, useContext } from 'react';

import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useKeyboardEvent, useSafeAreaInsets } from '../../hooks';

import { PageContext } from './PageContext';

export const usePage = () => {
  const { pageOffsetRef, pageRef } = useContext(PageContext);
  const getContentOffset = useCallback(
    () => pageOffsetRef?.current,
    [pageOffsetRef],
  );
  return {
    pageRef: pageRef?.current,
    getContentOffset,
  };
};

export const useSafeKeyboardAnimationStyle = () => {
  const { bottom: safeBottomHeight } = useSafeAreaInsets();
  const keyboardHeightValue = useSharedValue(0);
  const animatedStyles = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeightValue.value + safeBottomHeight,
  }));
  useKeyboardEvent({
    keyboardWillShow: (e) => {
      const keyboardHeight = e.endCoordinates.height;
      keyboardHeightValue.value = withTiming(keyboardHeight - safeBottomHeight);
    },
    keyboardWillHide: () => {
      keyboardHeightValue.value = withTiming(0);
    },
  });
  return platformEnv.isNative ? animatedStyles : undefined;
};
