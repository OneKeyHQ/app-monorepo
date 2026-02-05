import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGrowth = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 8a6 6 0 0 0-6 6 6 6 0 0 0 6-6m2 0a8 8 0 0 1-8 8v4a1 1 0 1 1-2 0v-7a8 8 0 0 1-8-8V4a1 1 0 0 1 1-1h1a8 8 0 0 1 7.749 6.009A7.98 7.98 0 0 1 19 6h1l.102.005A1 1 0 0 1 21 7zM5 5a6 6 0 0 0 6 6 6 6 0 0 0-6-6" />
  </Svg>
);
export default SvgGrowth;
