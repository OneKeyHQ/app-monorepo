import LottieViewWeb from 'lottie-react';
import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { LottieComponentProps as LottieWebProps } from 'lottie-react';

// Stick props the same as LottieNative by now
type LottieViewProps = Omit<LottieWebProps, 'animationData'> & {
  source: LottieWebProps['animationData'];
  autoPlay?: boolean;
};

const LottieView = forwardRef<typeof LottieViewWeb, LottieViewProps>(({
  source,
  autoPlay = false,
  loop,
  ...props
}, ref) => {
  const animationRef = useRef<any>();
  
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

  return <LottieViewWeb
    animationData={source}
    autoPlay={autoPlay}
    loop={loop}
    {...props}
    lottieRef={animationRef}
  />
});

export default LottieView;
