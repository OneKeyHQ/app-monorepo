/* eslint-disable @typescript-eslint/no-unsafe-member-access, global-require, @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-call */
import React, {
  LegacyRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import AnimatedLottieView from 'lottie-react-native';
import { AppState, AppStateStatus } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { LottieComponentProps as LottieWebProps } from 'lottie-react';
import type { AnimatedLottieViewProps as LottieNativeProps } from 'lottie-react-native';

// A hack for document unfound on native error
let LottieViewNative: typeof import('lottie-react-native').default | undefined;
let LottieViewWeb: typeof import('lottie-react').default | undefined;
try {
  LottieViewNative = require('lottie-react-native');
} catch (e) {
  // Ignore
}
try {
  LottieViewWeb = require('lottie-react').default;
} catch (e) {
  // Ignore
}

// Stick props the same as LottieNative by now
type LottieViewProps = Omit<LottieWebProps, 'animationData'> & {
  source: LottieWebProps['animationData'] | LottieNativeProps['source'];
  style?: LottieNativeProps['style'];
  autoPlay?: boolean;
};

const LottieView = forwardRef<typeof AnimatedLottieView, LottieViewProps>(
  ({ source, autoPlay, loop, ...props }, ref) => {
    const animationRef = useRef<AnimatedLottieView | null>();

    const appStateRef = useRef(AppState.currentState);
    useEffect(() => {
      if (!platformEnv.isNativeIOS) return;
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
      const subscription = AppState.addEventListener(
        'change',
        handleStateChange,
      );
      return () => {
        if (subscription && typeof subscription === 'function') {
          // @ts-expect-error
          subscription();
        } else {
          AppState.removeEventListener('change', handleStateChange);
        }
      };
    }, []);

    useEffect(() => {
      // animation won't work in navigate(), needs delay here
      setTimeout(() => {
        if (autoPlay) {
          animationRef.current?.play?.();
        } else {
          animationRef.current?.pause?.();
        }
      }, 300);
    }, [autoPlay]);

    useImperativeHandle(ref as any, () => ({
      play: () => {
        animationRef.current?.play?.();
      },
      pause: () => {
        animationRef.current?.pause?.();
      },
      reset: () => {
        if (platformEnv.isNative) {
          animationRef.current?.reset();
        } else {
          // @ts-expect-error
          animationRef.current?.goToAndStop?.(0);
        }
      },
    }));

    if (platformEnv.isNative && !!LottieViewNative) {
      return (
        <LottieViewNative
          source={source as LottieNativeProps['source']}
          autoPlay={autoPlay}
          loop={!!loop}
          {...props}
          ref={animationRef as LegacyRef<AnimatedLottieView>}
        />
      );
    }

    if (!platformEnv.isNative && !!LottieViewWeb) {
      return (
        <LottieViewWeb
          animationData={source}
          autoPlay={autoPlay}
          loop={loop}
          {...props}
          lottieRef={animationRef as any}
        />
      );
    }

    return null;
  },
);

LottieView.displayName = 'LottieView';
LottieView.defaultProps = {
  autoPlay: false,
};

export default LottieView;
