import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTargetArrow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 12C2 6.477 6.477 2 12 2a1 1 0 0 1 0 2 8 8 0 1 0 8 8 1 1 0 0 1 2 0c0 5.523-4.477 10-10 10S2 17.523 2 12m4 0a6 6 0 0 1 4.2-5.726 1 1 0 0 1 .6 1.909 4 4 0 1 0 5.018 5.018 1 1 0 0 1 1.908.598A6 6 0 0 1 6 12M16.635 1.967a1.25 1.25 0 0 1 1.877.443l.064.157.714 2.142 2.143.715a1.25 1.25 0 0 1 .488 2.07L19 10.413a2 2 0 0 1-1.414.586h-3.172l-1.707 1.707a1 1 0 1 1-1.414-1.414L13 9.586V6.414A2 2 0 0 1 13.586 5l2.92-2.921zM15 9h2.586l2.062-2.063-1.464-.488a1 1 0 0 1-.632-.633l-.49-1.465L15 6.414z" />
  </Svg>
);
export default SvgTargetArrow;
