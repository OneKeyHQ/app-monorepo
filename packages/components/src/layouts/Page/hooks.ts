import { useContext, useEffect, useMemo, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { EPageType, useIsOverlayPage, usePageType } from '../../hocs';
import {
  updateHeightWhenKeyboardHide,
  updateHeightWhenKeyboardShown,
  useKeyboardEvent,
} from '../../hooks/useKeyboard';
import { useSafeAreaInsets } from '../../hooks/useLayout';
import { rootNavigationRef } from '../Navigation/Navigator/NavigationContainer';

import { BottomTabBarHeightContext } from './BottomTabBarHeightContext';
import { PageContext } from './PageContext';

import type { IPageLifeCycle } from './type';

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

  const onRedirectedRef = useRef(params?.onRedirected);
  if (onRedirectedRef.current !== params?.onRedirected) {
    onRedirectedRef.current = params?.onRedirected;
  }

  const redirect = useMemo(() => !!params?.shouldRedirect?.(), [params]);
  useEffect(() => {
    if (redirect) {
      setTimeout(async () => {
        if (rootNavigationRef.current?.canGoBack()) {
          rootNavigationRef.current?.goBack();
          await timerUtils.wait(50);
          onRedirectedRef.current?.();
        }
      }, 0);
      return;
    }
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
  }, [navigation, redirect]);
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
  const isModalPage = useIsOverlayPage();
  const { safeAreaEnabled } = useContext(PageContext);
  const { bottom } = useSafeAreaInsets();
  return safeAreaEnabled && isModalPage ? bottom : 0;
};

// Returns native-measured tab bar height (includes safe area on iOS).
// Returns undefined when outside a tab navigator.
const useNativeTabBarHeight = () =>
  useContext(BottomTabBarHeightContext) ?? undefined;

export const useTabBarHeight = () => {
  const { bottom } = useSafeAreaInsets();
  const isModalPage = useIsOverlayPage();
  // Native measured height from react-native-bottom-tabs (includes safe area on iOS)
  const nativeTabBarHeight = useNativeTabBarHeight();
  if (isModalPage) return 0;
  // Prefer native measured value; fall back to constant + safe area
  if (nativeTabBarHeight) {
    return nativeTabBarHeight;
  }
  return bottom || 0;
};

export const useScrollContentTabBarOffset = platformEnv.isNativeIOS
  ? () => {
      const nativeTabBarHeight = useNativeTabBarHeight();
      return nativeTabBarHeight ?? 0;
    }
  : () => undefined;

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
        keyboardHeight - tabBarHeight,
      );
    },
    keyboardWillHide: () => {
      keyboardHeightValue.value = updateHeightWhenKeyboardHide();
    },
  });
  return platformEnv.isNative ? animatedStyles : undefined;
};

export const useIsIpadModalPage = platformEnv.isNativeIOSPad
  ? () => {
      const pageType = usePageType();
      return pageType === EPageType.modal;
    }
  : () => false;
