import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEyeOff = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2.293 2.293a1 1 0 0 1 1.414 0l3.64 3.64.004.003L18.064 16.65l.003.002 3.64 3.64a1 1 0 0 1-1.414 1.415l-3.09-3.09c-2.519 1.405-5.333 1.746-8.01.994-2.922-.821-5.601-2.921-7.549-6.193a2.77 2.77 0 0 1-.001-2.834c.988-1.66 2.163-3.018 3.465-4.061L2.293 3.707a1 1 0 0 1 0-1.414ZM8 12c0-.741.203-1.436.554-2.032l1.514 1.514a2 2 0 0 0 2.45 2.45l1.514 1.514A4 4 0 0 1 8 12Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M22.356 13.417a15.941 15.941 0 0 1-2.002 2.695L8.762 4.52A10.394 10.394 0 0 1 11.999 4c3.952 0 7.791 2.272 10.357 6.583a2.77 2.77 0 0 1 0 2.834Z"
    />
  </Svg>
);
export default SvgEyeOff;
