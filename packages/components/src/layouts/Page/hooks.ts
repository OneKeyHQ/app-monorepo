import { useCallback, useContext, useEffect, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EPageType, usePageType } from '../../hocs';
import {
  updateHeightWhenKeyboardHide,
  updateHeightWhenKeyboardShown,
  useKeyboardEvent,
  useSafeAreaInsets,
} from '../../hooks';

import { PageContext } from './PageContext';

import type { IPageLifeCycle } from './type';

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

export function usePageLifeCycle(params?: IPageLifeCycle) {
  const navigation = useNavigation();
  const { onMounted, onUnmounted } = params || {};
  const onMountedRef = useRef(onMounted);
  if (onMountedRef.current !== onMounted) {
    onMountedRef.current = onMounted;
  }
  const onUnmountedRef = useRef(onUnmounted);
  if (onUnmountedRef.current !== onUnmounted) {
    onUnmountedRef.current = onUnmounted;
  }

  useEffect(() => {
    void Promise.race([
      new Promise<void>((resolve) => setTimeout(resolve, 1000)),
      new Promise<void>((resolve) => {
        const unsubscribe = navigation.addListener(
          'transitionEnd' as any,
          (e) => {
            const {
              data: { closing },
            } = e as {
              data: {
                closing: boolean;
              };
              target: string;
              type: string;
            };

            if (!closing) {
              unsubscribe();
              resolve();
            }
          },
        );
      }),
    ]).then(() => {
      onMountedRef.current?.();
    });
    return () => {
      void Promise.race([
        new Promise<void>((resolve) => setTimeout(resolve, 1000)),
        new Promise<void>((resolve) => {
          const unsubscribe = navigation.addListener(
            'transitionEnd' as any,
            (e) => {
              const {
                data: { closing },
              } = e as {
                data: {
                  closing: boolean;
                };
                target: string;
                type: string;
              };

              if (closing) {
                unsubscribe();
                resolve();
              }
            },
          );
        }),
      ]).then(() => {
        onUnmountedRef.current?.();
      });
    };
  }, [navigation]);
}

export const usePageMounted = (onMounted: IPageLifeCycle['onMounted']) => {
  usePageLifeCycle({ onMounted });
};

export const usePageUnMounted = (
  onUnmounted: IPageLifeCycle['onUnmounted'],
) => {
  usePageLifeCycle({ onUnmounted });
};

export const useSafeAreaBottom = () => {
  const pageType = usePageType();
  const { safeAreaEnabled } = useContext(PageContext);
  const { bottom } = useSafeAreaInsets();
  return safeAreaEnabled && pageType === EPageType.modal ? bottom : 0;
};

export const TAB_BAR_HEIGHT = 54;

export const useTabBarHeight = () => {
  const { bottom } = useSafeAreaInsets();
  const pageType = usePageType();
  return pageType === EPageType.modal ? 0 : TAB_BAR_HEIGHT + bottom;
};

export const useSafeKeyboardAnimationStyle = () => {
  const safeBottomHeight = useSafeAreaBottom();
  const keyboardHeightValue = useSharedValue(0);
  const animatedStyles = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeightValue.value + safeBottomHeight,
  }));

  const tabBarHeight = useTabBarHeight();
  useKeyboardEvent({
    keyboardWillShow: (e) => {
      const keyboardHeight = e.endCoordinates.height;
      keyboardHeightValue.value = updateHeightWhenKeyboardShown(
        keyboardHeight - safeBottomHeight - tabBarHeight,
      );
    },
    keyboardWillHide: () => {
      keyboardHeightValue.value = updateHeightWhenKeyboardHide();
    },
  });
  return platformEnv.isNative ? animatedStyles : undefined;
};
