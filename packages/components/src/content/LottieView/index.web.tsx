/* eslint-disable  @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { forwardRef, useImperativeHandle, useRef } from 'react';

import LottieViewWeb from 'lottie-react';
import { usePropsAndStyle } from 'tamagui';

import type { ILottieViewProps } from './type';

export const LottieView = forwardRef<typeof LottieViewWeb, ILottieViewProps>(
  ({ source, autoPlay = false, loop, ...props }, ref) => {
    const [restProps, style] = usePropsAndStyle(props, {
      resolveValues: 'auto',
    });
    const animationRef = useRef<any>(null);

    useImperativeHandle(ref as any, () => ({
      play: () => {
        animationRef.current?.play?.();
      },
      pause: () => {
        animationRef.current?.pause?.();
      },
      reset: () => {
        animationRef.current?.goToAndStop?.(0);
      },
    }));

    return (
      <LottieViewWeb
        animationData={source}
        autoPlay={autoPlay}
        loop={loop}
        style={style as any}
        {...restProps}
        lottieRef={animationRef}
      />
    );
  },
);

LottieView.displayName = 'LottieView';

export * from './type';
