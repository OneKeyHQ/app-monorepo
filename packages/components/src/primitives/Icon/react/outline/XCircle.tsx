import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgXCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-5.707-3.707a1 1 0 1 1 1.414 1.414L13.414 12l2.293 2.293a1 1 0 1 1-1.414 1.414L12 13.414l-2.293 2.293a1 1 0 1 1-1.414-1.414L10.586 12 8.293 9.707a1 1 0 1 1 1.414-1.414L12 10.586zM22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgXCircle;
