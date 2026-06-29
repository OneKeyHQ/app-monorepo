/* eslint-disable  @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Suspense, forwardRef, lazy, useImperativeHandle, useRef } from 'react';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';

import type { ILottieViewProps } from './type';

// Lazy-load the lottie-web player (~600KB) so it leaves the initial bundle and
// is fetched only when an animation actually renders. Web only — the native
// variant (lottie-react-native) is unchanged.
const LottieViewWeb = lazy(() => import('lottie-react'));

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
      <Suspense fallback={null}>
        <LottieViewWeb
          animationData={source}
          autoPlay={autoPlay}
          loop={loop}
          style={style as any}
          {...(restProps as any)}
          lottieRef={animationRef}
        />
      </Suspense>
    );
  },
);

LottieView.displayName = 'LottieView';

export * from './type';
