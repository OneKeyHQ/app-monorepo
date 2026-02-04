import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSwitch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 12a5 5 0 0 0-5-5H8a5 5 0 0 0 0 10h8a5 5 0 0 0 5-5m-3 0a2 2 0 1 0-4 0 2 2 0 0 0 4 0m2 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0m3 0a7 7 0 0 1-7 7H8A7 7 0 1 1 8 5h8a7 7 0 0 1 7 7" />
  </Svg>
);
export default SvgSwitch;
