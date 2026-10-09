import type { LegacyRef } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import AnimatedLottieView from 'lottie-react-native';
import { AppState } from 'react-native';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ILottieViewHandle, ILottieViewProps } from './type';
import type { LottieViewProps as LottieNativeProps } from 'lottie-react-native';
import type { AppStateStatus } from 'react-native';

export const LottieView = forwardRef<ILottieViewHandle, ILottieViewProps>(
  (
    {
      source,
      loop = true,
      resizeMode,
      autoPlay = true,
      renderMode,
      onAnimationFinish,
      ...props
    },
    ref,
  ) => {
    const animationRef = useRef<AnimatedLottieView | null>(null);
    // Set by pause()/resume(), so returning from background does not restart
    // an animation its owner holds still.
    const isPausedRef = useRef(false);
    // A one-shot animation that has played out stays on its last frame.
    const isFinishedRef = useRef(false);
    const handleAnimationFinish = useCallback(
      (isCancelled: boolean) => {
        if (!isCancelled && !loop) {
          isFinishedRef.current = true;
        }
        onAnimationFinish?.(isCancelled);
      },
      [loop, onAnimationFinish],
    );
    useEffect(() => {
      isFinishedRef.current = false;
    }, [source]);

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
          nextAppState === 'active' &&
          !isPausedRef.current &&
          !isFinishedRef.current
        ) {
          animationRef.current?.play?.();
        }
        appStateRef.current = nextAppState;
      };
      const subscription = AppState.addEventListener(
        'change',
        handleStateChange,
      );
      return () => {
        subscription.remove();
      };
    }, []);

    useImperativeHandle(ref, () => ({
      play: () => {
        isPausedRef.current = false;
        isFinishedRef.current = false;
        animationRef.current?.play?.();
      },
      pause: () => {
        isPausedRef.current = true;
        animationRef.current?.pause?.();
      },
      // Continues from the paused frame; `play` restarts on Android.
      resume: () => {
        isPausedRef.current = false;
        animationRef.current?.resume?.();
      },
      reset: () => {
        isFinishedRef.current = false;
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
        onAnimationFinish={handleAnimationFinish}
        ref={animationRef as LegacyRef<AnimatedLottieView>}
        renderMode={
          renderMode ?? (platformEnv.isNativeIOS ? 'SOFTWARE' : undefined)
        }
      />
    );
  },
);

LottieView.displayName = 'LottieView';

export * from './type';
