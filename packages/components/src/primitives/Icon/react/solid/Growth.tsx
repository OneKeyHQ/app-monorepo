import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGrowth = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 3a8.004 8.004 0 0 1 7.75 6.006A7.99 7.99 0 0 1 19 6h2v2a8 8 0 0 1-8 8v5h-2v-8a8 8 0 0 1-8-8V3z" />
  </Svg>
);
export default SvgGrowth;
