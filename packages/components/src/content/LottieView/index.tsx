import type { LegacyRef } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import AnimatedLottieView from 'lottie-react-native';
import { AppState } from 'react-native';
import { usePropsAndStyle } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ILottieViewProps } from './type';
import type { LottieViewProps as LottieNativeProps } from 'lottie-react-native';
import type { AppStateStatus } from 'react-native';

export const LottieView = forwardRef<
  typeof AnimatedLottieView,
  ILottieViewProps
>(({ source, loop = true, resizeMode, autoPlay = true, ...props }, ref) => {
  const animationRef = useRef<AnimatedLottieView | null>(null);

  const appStateRef = useRef(AppState.currentState);
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  useEffect(() => {
    // fix animation is stopped after entered background state on iOS
    // https://github.com/lottie-react-native/lottie-react-native/issues/412
    const handleStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current &&
        /inactive|background/.exec(appStateRef.current) &&
        nextAppState === 'active'
      ) {
        animationRef.current?.play?.();
      }
      appStateRef.current = nextAppState;
    };
    const subscription = AppState.addEventListener('change', handleStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  useImperativeHandle(ref as any, () => ({
    play: () => {
      animationRef.current?.play?.();
    },
    pause: () => {
      animationRef.current?.pause?.();
    },
    reset: () => {
      animationRef.current?.reset();
    },
  }));

  return (
    <AnimatedLottieView
      autoPlay={autoPlay}
      resizeMode={resizeMode}
      source={source as LottieNativeProps['source']}
      loop={loop}
      style={style as any}
      {...(restProps as any)}
      ref={animationRef as LegacyRef<AnimatedLottieView>}
      renderMode={platformEnv.isNativeIOS ? 'SOFTWARE' : undefined}
    />
  );
});

LottieView.displayName = 'LottieView';

export * from './type';
