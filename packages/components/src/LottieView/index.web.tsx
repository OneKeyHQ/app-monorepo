import LottieViewWeb from 'lottie-react';

import type { LottieComponentProps as LottieWebProps } from 'lottie-react';

// Stick props the same as LottieNative by now
type LottieViewProps = Omit<LottieWebProps, 'animationData'> & {
  source: LottieWebProps['animationData'];
  autoPlay?: boolean;
};

const LottieView = ({
  source,
  autoPlay = false,
  loop,
  ...props
}: LottieViewProps) => (
  <LottieViewWeb
    animationData={source}
    autoPlay={autoPlay}
    loop={loop}
    {...props}
  />
);
export default LottieView;
