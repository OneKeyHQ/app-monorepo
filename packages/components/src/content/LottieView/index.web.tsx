/* eslint-disable  @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import {
  Suspense,
  forwardRef,
  lazy,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';

import type { ILottieViewHandle, ILottieViewProps } from './type';

// Lazy-load the lottie-web player (~600KB) so it leaves the initial bundle and
// is fetched only when an animation actually renders. Web only — the native
// variant (lottie-react-native) is unchanged.
const LottieViewWeb = lazy(() => import('lottie-react'));

export const LottieView = forwardRef<ILottieViewHandle, ILottieViewProps>(
  (
    { source, autoPlay = false, loop, onAnimationFinish, onComplete, ...props },
    ref,
  ) => {
    const [restProps, style] = usePropsAndStyle(props, {
      resolveValues: 'auto',
    });
    const animationRef = useRef<any>(null);
    // A one-shot animation that has played out stays on its last frame.
    const isFinishedRef = useRef(false);
    // Keeps a caller's own lottie-web `onComplete` working alongside it.
    const handleComplete = useCallback<NonNullable<typeof onComplete>>(
      (event) => {
        if (!loop) {
          isFinishedRef.current = true;
        }
        onComplete?.(event);
        onAnimationFinish?.(false);
      },
      [loop, onAnimationFinish, onComplete],
    );
    useEffect(() => {
      isFinishedRef.current = false;
    }, [source]);

    useImperativeHandle(ref, () => ({
      play: () => {
        isFinishedRef.current = false;
        animationRef.current?.play?.();
      },
      // Both are no-ops once a one-shot animation has played out.
      pause: () => {
        if (!isFinishedRef.current) {
          animationRef.current?.pause?.();
        }
      },
      // lottie-web's play continues from the paused frame.
      resume: () => {
        if (!isFinishedRef.current) {
          animationRef.current?.play?.();
        }
      },
      reset: () => {
        isFinishedRef.current = false;
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
          onComplete={handleComplete}
          lottieRef={animationRef}
        />
      </Suspense>
    );
  },
);

LottieView.displayName = 'LottieView';

export * from './type';
