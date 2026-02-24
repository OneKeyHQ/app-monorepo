import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCoins = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 7a7 7 0 1 1 0 14 7 7 0 0 1 0-14" />
    <Path d="M9 3c1.938 0 3.692.787 4.959 2.06a9 9 0 0 0-7.613 11.42A7.002 7.002 0 0 1 9 3" />
  </Svg>
);
export default SvgCoins;
