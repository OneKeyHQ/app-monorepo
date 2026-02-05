import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChromecast = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 3a2 2 0 0 0-2 2v2.038Q2.496 7 3 7c7.18 0 13 5.82 13 13q0 .505-.038 1H20a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM3 13a1 1 0 1 0 0 2 5 5 0 0 1 5 5 1 1 0 1 0 2 0 7 7 0 0 0-7-7" />
    <Path d="M2 10a1 1 0 0 1 1-1c6.075 0 11 4.925 11 11a1 1 0 1 1-2 0 9 9 0 0 0-9-9 1 1 0 0 1-1-1m1 7a1 1 0 1 0 0 2 1 1 0 0 1 1 1 1 1 0 1 0 2 0 3 3 0 0 0-3-3" />
  </Svg>
);
export default SvgChromecast;
