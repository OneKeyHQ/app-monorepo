import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGrowth = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5 3a8 8 0 0 1 7.749 6.009A7.98 7.98 0 0 1 19 6h2v2a8 8 0 0 1-8 8v5h-2v-8a8 8 0 0 1-8-8V3zm14 5a6 6 0 0 0-6 6 6 6 0 0 0 6-6M5 5a6 6 0 0 0 6 6 6 6 0 0 0-6-6"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgGrowth;
