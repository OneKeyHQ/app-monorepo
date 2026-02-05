import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgZoomOut = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 11a6 6 0 1 0-12 0 6 6 0 0 0 12 0m-3-1a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2zm5 1c0 1.849-.63 3.549-1.683 4.903l3.39 3.39a1 1 0 1 1-1.414 1.414l-3.39-3.39A7.96 7.96 0 0 1 11 19a8 8 0 1 1 8-8" />
  </Svg>
);
export default SvgZoomOut;
