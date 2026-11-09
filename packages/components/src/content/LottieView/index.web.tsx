/* eslint-disable  @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import {
  Suspense,
  forwardRef,
  lazy,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';

import type { ILottieViewHandle, ILottieViewProps } from './type';
import type { LottieRefCurrentProps } from 'lottie-react';

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
    const playerRef = useRef<LottieRefCurrentProps | null>(null);
    const isPlayPendingRef = useRef(false);
    // The player chunk loads lazily, so a play request can arrive before
    // lottie-react attaches the player. Keep it until then.
    const animationRef = useMemo(
      () => ({
        get current() {
          return playerRef.current;
        },
        set current(player: LottieRefCurrentProps | null) {
          playerRef.current = player;
          if (player && isPlayPendingRef.current) {
            isPlayPendingRef.current = false;
            player.play();
          }
        },
      }),
      [],
    );
    const requestPlay = useCallback(() => {
      if (playerRef.current) {
        playerRef.current.play();
      } else {
        isPlayPendingRef.current = true;
      }
    }, []);
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
        requestPlay();
      },
      // Both are no-ops once a one-shot animation has played out.
      pause: () => {
        isPlayPendingRef.current = false;
        if (!isFinishedRef.current) {
          playerRef.current?.pause();
        }
      },
      // lottie-web's play continues from the paused frame.
      resume: () => {
        if (!isFinishedRef.current) {
          requestPlay();
        }
      },
      reset: () => {
        isPlayPendingRef.current = false;
        isFinishedRef.current = false;
        playerRef.current?.goToAndStop(0);
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
