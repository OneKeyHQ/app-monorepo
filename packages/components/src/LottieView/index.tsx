/* eslint-disable @typescript-eslint/no-unsafe-member-access, global-require, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-var-requires */
import React, { LegacyRef, useEffect, useRef } from 'react';

import AnimatedLottieView from 'lottie-react-native';

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

const LottieView = ({ source, autoPlay, loop, ...props }: LottieViewProps) => {
  const animationRef = useRef<AnimatedLottieView | null>();

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
      />
    );
  }

  return null;
};

LottieView.defaultProps = {
  autoPlay: false,
};
export default LottieView;
